import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import {
  getCoffeeBean,
  saveCoffeeBean,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import {
  getBrewingNote,
  saveBrewingNote,
} from '@/lib/data/sqlite/repositories/brewingNote';
import { parseCoffeeBeanAmount } from '@/lib/coffee-beans/capacityAdjustment';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';
import type { Schema } from './toolDefinitions';
import { invalid, McpToolError, recordVersion } from './validation';
import type { MutationChange, MutationWork } from './storage';

type Args = Record<string, unknown>;
const text = (maxLength = 300, minLength = 1): Schema => ({
  type: 'string',
  maxLength,
  minLength,
});
const version: Schema = { ...text(64), minLength: 64 };
const number = (minimum = 0): Schema => ({
  type: 'number',
  minimum,
  maximum: 1_000_000,
});
const base = {
  requestId: text(128, 8),
  id: text(128),
  expectedVersion: version,
  beanId: text(128, 0),
  targetExpectedVersion: version,
  brewedAt: { type: 'string', format: 'date-time' } as Schema,
};
const object = (
  properties: Record<string, Schema>,
  required: string[]
): Schema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
export const capacityAdjustmentDefinitions: Array<{
  name: string;
  description: string;
  schema: Schema;
  write?: boolean;
  destructive?: boolean;
}> = [
  {
    name: 'update_brew_note_capacity_adjustment',
    write: true,
    description:
      'Correct a capacity adjustment signed amount or linked bean using current inventory deltas, never a historical balance snapshot. Positive changeGrams adds stock, negative subtracts. Require current note and target bean versions. Reject changes outside available inventory/capacity instead of silently recording a clipped change. Keeps record ID and photos.',
    schema: object({ ...base, changeGrams: number(-1_000_000) }, [
      'requestId',
      'id',
      'expectedVersion',
      'changeGrams',
      'targetExpectedVersion',
    ]),
  },
  {
    name: 'convert_capacity_adjustment_to_brew_note',
    write: true,
    description:
      'Convert an adjustment into an ordinary brew note, reversing its previous signed stock effect and applying coffeeGrams once. Keeps ID/photos/historical fields. Omit beanId to keep link, empty string explicitly unlinks. Linked target requires targetExpectedVersion. Further brew details can be edited with update_brew_note.',
    schema: object({ ...base, coffeeGrams: number(), notes: text(10000, 0) }, [
      'requestId',
      'id',
      'expectedVersion',
      'coffeeGrams',
    ]),
  },
];
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
const amount = (value: unknown) => parseCoffeeBeanAmount(value) ?? 0;
function precise(n: unknown, label: string): number {
  if (
    typeof n !== 'number' ||
    !Number.isFinite(n) ||
    Math.abs(n) > 1_000_000 ||
    Math.abs(Number(fmt(n)) - n) > 1e-9
  )
    invalid(
      `${label} must be a finite gram amount with at most three decimal places`
    );
  return n;
}
async function checkVersion(value: unknown, expected: unknown) {
  if ((await recordVersion(value)) !== expected)
    throw new McpToolError(
      'CONFLICT',
      'Record changed; read its latest version and retry'
    );
}
async function beanView(b: CoffeeBean) {
  return {
    ...stripCoffeeBeanImages(b),
    version: await recordVersion(b),
    remainingGrams: amount(b.remaining),
    capacityGrams: amount(b.capacity),
  };
}
async function noteView(n: BrewingNote) {
  return { ...stripBrewingNoteImages(n), version: await recordVersion(n) };
}
export async function readCapacityAdjustmentTool(
  _tx: SqliteExecutor,
  _name: string,
  _args: Args
): Promise<Args> {
  throw new McpToolError(
    'UNKNOWN_TOOL',
    'Use get_brew_note to read adjustment records'
  );
}
export async function mutateCapacityAdjustmentTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<MutationWork<Args>> {
  const converting = name === 'convert_capacity_adjustment_to_brew_note';
  if (!converting && name !== 'update_brew_note_capacity_adjustment')
    throw new McpToolError(
      'UNKNOWN_TOOL',
      'Unknown capacity adjustment mutation'
    );
  const before = await getBrewingNote(tx, String(args.id));
  if (!before)
    throw new McpToolError('NOT_FOUND', 'Adjustment record not found');
  if (
    before.source !== 'capacity-adjustment' ||
    !before.changeRecord?.capacityAdjustment
  )
    invalid('This command requires a capacity-adjustment record');
  await checkVersion(before, args.expectedVersion);
  const previous = before.changeRecord.capacityAdjustment;
  const oldChange = precise(previous.changeAmount, 'Stored adjustment');
  if (!Number.isFinite(previous.originalAmount) || previous.originalAmount < 0)
    invalid('Stored adjustment original amount is invalid');
  const targetId =
    args.beanId === undefined
      ? before.beanId
      : String(args.beanId) || undefined;
  if (!converting && !targetId)
    invalid('An adjustment must remain linked to a coffee bean');
  const oldBean = before.beanId
    ? await getCoffeeBean(tx, before.beanId)
    : undefined;
  const target = targetId ? await getCoffeeBean(tx, targetId) : undefined;
  if (targetId && !target)
    throw new McpToolError('NOT_FOUND', 'Target coffee bean not found');
  if (target) {
    if (typeof args.targetExpectedVersion !== 'string')
      invalid('targetExpectedVersion is required for a linked target');
    await checkVersion(target, args.targetExpectedVersion);
  }
  for (const bean of [oldBean, target]) {
    if (!bean) continue;
    if (
      bean.remaining !== undefined &&
      parseCoffeeBeanAmount(bean.remaining) === null
    )
      invalid(
        'Existing remaining inventory is invalid; reconcile it before correcting history'
      );
    if (
      bean.capacity !== undefined &&
      parseCoffeeBeanAmount(bean.capacity) === null
    )
      invalid(
        'Existing capacity is invalid; reconcile it before correcting history'
      );
  }
  const nextEffect = converting
    ? -precise(args.coffeeGrams, 'coffeeGrams')
    : precise(args.changeGrams, 'changeGrams');
  if (converting && nextEffect > 0) invalid('coffeeGrams cannot be negative');
  if (converting && target?.beanState === 'green')
    invalid(
      'A brew note cannot consume green beans; use the roasting workflow'
    );
  if (!converting && previous.originalAmount + nextEffect < 0)
    invalid(
      'The corrected historical adjustment cannot have a negative new amount'
    );
  // Conversion is an inverse operation followed by a brew debit in the app.
  // Do not collapse an overflowing inverse with that debit: the app would cap
  // the intermediate restore, producing a different result. Require explicit
  // inventory reconciliation rather than silently losing part of the inverse.
  if (converting && oldBean) {
    const restored = Number(fmt(amount(oldBean.remaining) - oldChange));
    const cap = parseCoffeeBeanAmount(oldBean.capacity);
    if (restored < 0 || (cap !== null && cap > 0 && restored > cap))
      invalid(
        'The adjustment cannot be fully reversed within current inventory bounds; reconcile inventory first'
      );
  }
  const deltas = new Map<string, number>();
  if (oldBean) deltas.set(oldBean.id, -oldChange);
  if (target) deltas.set(target.id, (deltas.get(target.id) ?? 0) + nextEffect);
  const plans: Array<{ before: CoffeeBean; after: CoffeeBean }> = [];
  for (const [id, delta] of deltas) {
    const bean = id === target?.id ? target : oldBean!;
    const remaining = Number(fmt(amount(bean.remaining) + delta));
    if (remaining < 0)
      throw new McpToolError(
        'INSUFFICIENT_INVENTORY',
        'The correction would consume more current inventory than is available'
      );
    const cap = parseCoffeeBeanAmount(bean.capacity);
    if (cap !== null && cap > 0 && remaining > cap)
      invalid(
        'The correction would exceed current bean capacity; reconcile capacity first'
      );
    if (Math.abs(delta) > 1e-9)
      plans.push({
        before: bean,
        after: {
          ...bean,
          remaining: fmt(remaining),
          timestamp: Math.max(Date.now(), bean.timestamp + 1),
        },
      });
  }
  const after: BrewingNote = {
    ...before,
    beanId: targetId,
    updatedAt: Math.max(Date.now(), (before.updatedAt ?? before.timestamp) + 1),
    timestamp:
      args.brewedAt === undefined
        ? before.timestamp
        : Date.parse(String(args.brewedAt)),
    params: { ...before.params, coffee: `${fmt(Math.abs(nextEffect))}g` },
  };
  if (before.beanId !== targetId && target)
    after.coffeeBeanInfo = {
      name: target.name,
      roastLevel: target.roastLevel || '中度烘焙',
      roastDate: target.roastDate,
      roaster: target.roaster,
    };
  // Explicit unlink preserves the historical snapshot, not a live association.
  if (converting) {
    delete after.source;
    delete after.changeRecord;
    delete after.quickDecrementAmount;
    if (args.notes !== undefined) after.notes = String(args.notes);
  } else {
    after.notes = '容量调整(不计入统计)';
    after.changeRecord = {
      ...before.changeRecord,
      capacityAdjustment: {
        ...previous,
        changeAmount: nextEffect,
        newAmount: Number(fmt(previous.originalAmount + nextEffect)),
        changeType:
          nextEffect > 0 ? 'increase' : nextEffect < 0 ? 'decrease' : 'set',
      },
    };
  }
  const changes: MutationChange[] = [];
  for (const plan of plans) {
    await saveCoffeeBean(tx, plan.after);
    changes.push({
      entity: 'bean',
      id: plan.after.id,
      before: await beanView(plan.before),
      after: await beanView(plan.after),
    });
  }
  await saveBrewingNote(tx, after);
  changes.push({
    entity: 'brew_note',
    id: after.id,
    before: await noteView(before),
    after: await noteView(after),
  });
  return {
    result: {
      note: await noteView(after),
      inventoryChanges: await Promise.all(plans.map(p => beanView(p.after))),
    },
    changes,
    summary: converting ? '容量调整记录转为冲煮笔记' : '修改容量调整记录',
  };
}
