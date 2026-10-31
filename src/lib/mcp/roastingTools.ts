import { nanoid } from 'nanoid';
import {
  prepareRoastingBatch,
  roastingInputs,
} from '@/lib/coffee-beans/roastingBatch';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import {
  getCoffeeBean,
  listCoffeeBeans,
  saveCoffeeBean,
  deleteCoffeeBean,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import {
  getBrewingNote,
  listBrewingNotes,
  saveBrewingNote,
  deleteBrewingNote,
} from '@/lib/data/sqlite/repositories/brewingNote';
import {
  parseBeanName,
  getNextAvailableNumber,
} from '@/lib/coffee-beans/repurchaseNaming';
import { formatBeanDisplayName } from '@/lib/utils/beanVarietyUtils';
import { parseCoffeeBeanAmount } from '@/lib/coffee-beans/amount';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';
import type { Schema } from './toolDefinitions';
import { invalid, McpToolError, recordVersion } from './validation';
import {
  localHistoryGeneration,
  type MutationChange,
  type MutationWork,
} from './storage';

type Args = Record<string, unknown>;
const text = (maxLength = 300): Schema => ({
  type: 'string',
  minLength: 1,
  maxLength,
});
const grams: Schema = { type: 'number', minimum: 0.001, maximum: 1_000_000 };
const version: Schema = { ...text(64), minLength: 64 };
const object = (
  properties: Record<string, Schema>,
  required: string[] = []
): Schema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const mutation = { requestId: { ...text(128), minLength: 8 } };
const identity = { id: text(128) };
const outputSchema = object({
  name: text(),
  capacityGrams: grams,
  remainingGrams: { ...grams, minimum: 0 },
  roastDate: { type: 'string', format: 'date' },
  roastLevel: text(),
  roaster: text(),
  price: { type: 'number', minimum: 0, maximum: 1_000_000 },
});
export const roastingDefinitions: Array<{
  name: string;
  description: string;
  schema: Schema;
  write?: boolean;
  destructive?: boolean;
}> = [
  {
    name: 'list_roasting_records',
    description:
      'List roasting records, optionally for one source green bean. Read returned versions before editing.',
    schema: object({
      greenBeanId: text(128),
      offset: { type: 'integer', minimum: 0, maximum: 1_000_000 },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    }),
  },
  {
    name: 'get_roasting_record',
    description:
      'Get a roasting record and its current linked green/roasted bean inventory.',
    schema: object(identity, ['id']),
  },
  {
    name: 'create_roasting_record',
    description:
      'Roast green beans atomically: debit input, optionally create a derived roasted bean and canonical roasting/change records. Output weight defaults to input; specify capacityGrams for actual yield. No image copying; use app to manage photos.',
    write: true,
    schema: object(
      {
        ...mutation,
        greenBeanId: text(128),
        greenExpectedVersion: version,
        roastedAmountGrams: grams,
        createRoastedBean: { type: 'boolean' },
        roastedBean: outputSchema,
        timestamp: { type: 'string', format: 'date-time' },
      },
      ['requestId', 'greenBeanId', 'greenExpectedVersion', 'roastedAmountGrams']
    ),
  },
  {
    name: 'update_roasting_record',
    description:
      'Correct green source/input or date using the original app roasting rules. Adjust current green balances by delta, preserve produced roasted capacity and subsequent use, update source provenance. Does not resize the roasted output.',
    write: true,
    schema: object(
      {
        ...mutation,
        ...identity,
        expectedVersion: version,
        greenBeanId: text(128),
        greenExpectedVersion: version,
        roastedAmountGrams: grams,
        timestamp: { type: 'string', format: 'date-time' },
      },
      ['requestId', 'id', 'expectedVersion', 'greenExpectedVersion']
    ),
  },
  {
    name: 'preview_delete_roasting_record',
    description:
      'Preview cancelling a roasting batch: refund each green input and remove untouched roasted output. Reject missing sources or subsequent consumption/adjustments. Present the returned impact before deletion.',
    schema: object(identity, ['id']),
  },
  {
    name: 'delete_roasting_record',
    description:
      'Cancel exactly the previewed roasting batch atomically, refund green inputs and delete untouched roasted output and the record. Requires fresh preview token.',
    write: true,
    destructive: true,
    schema: object(
      {
        ...mutation,
        ...identity,
        expectedVersion: version,
        confirmationToken: text(128),
      },
      ['requestId', 'id', 'expectedVersion', 'confirmationToken']
    ),
  },
];
const fmt = (n: number) => String(Math.round(n * 1000) / 1000);
const amount = (v: unknown) => parseCoffeeBeanAmount(v) ?? 0;
const nowAfter = (n = 0) => Math.max(Date.now(), n + 1);
async function requireBean(tx: SqliteExecutor, id: string) {
  const bean = await getCoffeeBean(tx, id);
  if (!bean) throw new McpToolError('NOT_FOUND', 'Coffee bean not found');
  return bean;
}
async function requireNote(tx: SqliteExecutor, id: string) {
  const note = await getBrewingNote(tx, id);
  if (!note || note.source !== 'roasting' || !note.changeRecord?.roastingRecord)
    throw new McpToolError('NOT_FOUND', 'Roasting record not found');
  return note;
}
async function checkVersion(record: unknown, expected: unknown) {
  if ((await recordVersion(record)) !== expected)
    throw new McpToolError(
      'CONFLICT',
      'Record changed; read its current version and retry.'
    );
}
function assertGreen(bean: CoffeeBean) {
  if (bean.beanState !== 'green') invalid('Roasting requires a green bean');
}
function assertPositive(n: number) {
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000)
    invalid('Roasting amount must be positive and at most 1000000g');
  if (Math.abs(Number(fmt(n)) - n) > 1e-9)
    invalid('Roasting amounts support at most three decimal places');
}

async function beanView(bean: CoffeeBean | undefined) {
  return bean
    ? {
        ...stripCoffeeBeanImages(bean),
        version: await recordVersion(bean),
        remainingGrams: amount(bean.remaining),
        capacityGrams: amount(bean.capacity),
      }
    : null;
}
async function noteView(note: BrewingNote) {
  return {
    ...stripBrewingNoteImages(note),
    version: await recordVersion(note),
  };
}
const previews = new Map<
  string,
  {
    id: string;
    version: string;
    fingerprint: string;
    expiresAt: number;
    generation: number;
  }
>();
async function linked(tx: SqliteExecutor, note: BrewingNote) {
  const r = note.changeRecord!.roastingRecord!;
  return {
    green: r.greenBeanId ? await getCoffeeBean(tx, r.greenBeanId) : undefined,
    roasted: r.roastedBeanId
      ? await getCoffeeBean(tx, r.roastedBeanId)
      : undefined,
  };
}
async function impactFingerprint(tx: SqliteExecutor, note: BrewingNote) {
  return recordVersion({
    note,
    ...(await linked(tx, note)),
    beans: await listCoffeeBeans(tx),
    notes: await listBrewingNotes(tx),
    images: await tx.query(
      'SELECT * FROM brewing_note_images WHERE note_id = ?',
      [note.id]
    ),
  });
}
export async function readRoastingTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<Args> {
  if (name === 'list_roasting_records') {
    const records = (await listBrewingNotes(tx))
      .filter(
        n =>
          n.source === 'roasting' &&
          (!args.greenBeanId ||
            roastingInputs(n.changeRecord?.roastingRecord).some(
              input => input.greenBeanId === args.greenBeanId
            ))
      )
      .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id));
    const offset = Number(args.offset ?? 0),
      limit = Number(args.limit ?? 25);
    return {
      items: await Promise.all(
        records.slice(offset, offset + limit).map(noteView)
      ),
      total: records.length,
      offset,
      limit,
    };
  }
  const note = await requireNote(tx, String(args.id));
  const { green, roasted } = await linked(tx, note);
  if (name === 'get_roasting_record')
    return {
      note: await noteView(note),
      greenBean: await beanView(green),
      greenBeans: await Promise.all(
        roastingInputs(note.changeRecord?.roastingRecord).map(async input => ({
          ...input,
          bean: await beanView(await getCoffeeBean(tx, input.greenBeanId)),
        }))
      ),
      roastedBean: await beanView(roasted),
    };
  if (name === 'preview_delete_roasting_record') {
    const r = note.changeRecord!.roastingRecord!;
    const deletion = prepareRoastingBatch(
      { noteId: note.id, beanId: r.roastedBeanId ?? '', now: Date.now() },
      await listCoffeeBeans(tx),
      note,
      await listBrewingNotes(tx)
    );
    const token = nanoid(),
      currentVersion = await recordVersion(note);
    for (const [key, preview] of previews)
      if (preview.expiresAt < Date.now()) previews.delete(key);
    if (previews.size >= 1000) previews.delete(previews.keys().next().value!);
    previews.set(token, {
      id: note.id,
      version: currentVersion,
      fingerprint: await impactFingerprint(tx, note),
      expiresAt: Date.now() + 300_000,
      generation: localHistoryGeneration,
    });
    return {
      id: note.id,
      version: currentVersion,
      confirmationToken: token,
      impact: {
        greenBeanId: green?.id ?? null,
        remainingBefore: green ? amount(green.remaining) : null,
        remainingAfter: green
          ? amount(deletion.beans.find(bean => bean.id === green.id)?.remaining)
          : null,
        restoredInputs: deletion.beans.map(bean => ({
          id: bean.id,
          remaining: bean.remaining,
        })),
        restoresInventory: true,
        roastedBeanId: roasted?.id ?? null,
        keepsRoastedBean: false,
        deletedRoastedBeanId: deletion.deletedBeanId ?? null,
        preservesSubsequentNotes: true,
      },
    };
  }
  throw new McpToolError('UNKNOWN_TOOL', 'Unknown roasting read tool');
}

export async function mutateRoastingTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<MutationWork<Args>> {
  const changes: MutationChange[] = [];
  async function writeBean(before: CoffeeBean | null, after: CoffeeBean) {
    await saveCoffeeBean(tx, after);
    changes.push({
      entity: 'bean',
      id: after.id,
      before: before ? await beanView(before) : null,
      after: await beanView(after),
    });
  }
  async function writeNote(before: BrewingNote | null, after: BrewingNote) {
    await saveBrewingNote(tx, after);
    changes.push({
      entity: 'brew_note',
      id: after.id,
      before: before ? await noteView(before) : null,
      after: await noteView(after),
    });
  }
  if (name === 'create_roasting_record') {
    const green = await requireBean(tx, String(args.greenBeanId));
    assertGreen(green);
    await checkVersion(green, args.greenExpectedVersion);
    const input = Number(args.roastedAmountGrams);
    assertPositive(input);
    if (input > amount(green.remaining))
      throw new McpToolError(
        'INSUFFICIENT_INVENTORY',
        'Insufficient green inventory'
      );
    const timestamp = args.timestamp
      ? Date.parse(String(args.timestamp))
      : Date.now();
    const output = (args.roastedBean ?? {}) as Args;
    if (args.createRoastedBean === false && Object.keys(output).length)
      invalid('roastedBean cannot be supplied when createRoastedBean is false');
    let roasted: CoffeeBean | undefined;
    let usedNote: BrewingNote | undefined;
    if (args.createRoastedBean !== false) {
      const capacity = Number(output.capacityGrams ?? input),
        remaining = Number(output.remainingGrams ?? capacity);
      assertPositive(capacity);
      if (Math.abs(Number(fmt(remaining)) - remaining) > 1e-9)
        invalid('Remaining amount supports at most three decimal places');
      if (
        !Number.isFinite(remaining) ||
        remaining < 0 ||
        remaining > capacity ||
        capacity > input
      )
        invalid(
          'Roasted yield must not exceed input; remaining must be within output capacity'
        );
      const allBeans = await listCoffeeBeans(tx);
      const { baseName } = parseBeanName(green.name);
      const name =
        typeof output.name === 'string' && output.name !== green.name
          ? output.name
          : allBeans.some(
                b =>
                  (b.beanState ?? 'roasted') === 'roasted' &&
                  parseBeanName(b.name).baseName === baseName
              )
            ? `${baseName} #${getNextAvailableNumber(baseName, allBeans)}`
            : baseName;
      roasted = {
        id: nanoid(),
        timestamp: Date.now(),
        name,
        beanState: 'roasted',
        beanType: green.beanType,
        roaster: String(output.roaster ?? green.roaster ?? ''),
        roastLevel: String(output.roastLevel ?? green.roastLevel ?? ''),
        roastDate: String(
          output.roastDate ??
            (args.timestamp
              ? String(args.timestamp).slice(0, 10)
              : new Date(timestamp).toISOString().slice(0, 10))
        ),
        capacity: fmt(capacity),
        remaining: fmt(remaining),
        sourceGreenBeanId: green.id,
        flavor: green.flavor,
        notes: green.notes,
        brand: green.brand,
        blendComponents: green.blendComponents,
        price:
          output.price !== undefined
            ? String(output.price)
            : amount(green.capacity) > 0 && amount(green.price) > 0
              ? (
                  (amount(green.price) / amount(green.capacity)) *
                  input
                ).toFixed(2)
              : undefined,
      };
      if (capacity !== remaining)
        usedNote = {
          id: nanoid(),
          timestamp: timestamp + 1,
          source: 'quick-decrement',
          beanId: roasted.id,
          quickDecrementAmount: Number(fmt(capacity - remaining)),
          notes: '烘焙时已使用',
          rating: 0,
          taste: {},
          coffeeBeanInfo: {
            name: roasted.name,
            roastLevel: roasted.roastLevel || '未知',
            roastDate: roasted.roastDate,
            roaster: roasted.roaster,
          },
        };
    }
    const afterGreen = {
      ...green,
      remaining: fmt(amount(green.remaining) - input),
      timestamp: nowAfter(green.timestamp),
    };
    const note: BrewingNote = {
      id: nanoid(),
      timestamp,
      beanId: green.id,
      source: 'roasting',
      rating: 0,
      taste: {},
      coffeeBeanInfo: {
        name: green.name,
        roastLevel: green.roastLevel || '未知',
        roastDate: green.roastDate,
        roaster: green.roaster,
      },
      notes: `烘焙了 ${input}g 生豆${roasted ? ` → ${formatBeanDisplayName(roasted)}` : ''}`,
      changeRecord: {
        roastingRecord: {
          greenBeanId: green.id,
          greenBeanName: formatBeanDisplayName(green),
          roastedAmount: input,
          roastedBeanId: roasted?.id,
          outputAmount: roasted ? amount(roasted.capacity) : undefined,
          roastedBeanName: roasted ? formatBeanDisplayName(roasted) : undefined,
        },
      },
    };
    await writeBean(green, afterGreen);
    if (roasted) await writeBean(null, roasted);
    if (usedNote) await writeNote(null, usedNote);
    await writeNote(null, note);
    return {
      result: {
        note: await noteView(note),
        greenBean: await beanView(afterGreen),
        roastedBean: await beanView(roasted),
        usedNote: usedNote ? await noteView(usedNote) : null,
      },
      changes,
      summary: note.notes,
    };
  }
  const note = await requireNote(tx, String(args.id));
  await checkVersion(note, args.expectedVersion);
  const r = note.changeRecord!.roastingRecord!;
  assertPositive(r.roastedAmount);
  const { roasted } = await linked(tx, note);
  if (name === 'update_roasting_record') {
    const greenId = String(args.greenBeanId ?? r.greenBeanId);
    const nextGreen = await requireBean(tx, greenId);
    await checkVersion(nextGreen, args.greenExpectedVersion);
    const inventory = await listCoffeeBeans(tx);
    const result = prepareRoastingBatch(
      {
        noteId: note.id,
        beanId: r.roastedBeanId ?? '',
        now: Date.now(),
        expectedUpdatedAt: note.updatedAt ?? note.timestamp,
        legacyEdit: {
          greenBeanId: greenId,
          amount: Number(args.roastedAmountGrams ?? r.roastedAmount),
          timestamp: args.timestamp
            ? Date.parse(String(args.timestamp))
            : note.timestamp,
        },
      },
      inventory,
      note
    );
    for (const bean of result.beans)
      await writeBean(
        inventory.find(before => before.id === bean.id) ?? null,
        bean
      );
    await writeNote(note, result.note!);
    return {
      result: { note: await noteView(result.note!) },
      changes,
      summary: result.note!.notes,
    };
  }

  if (name === 'delete_roasting_record') {
    const preview = previews.get(String(args.confirmationToken));
    if (
      !preview ||
      preview.id !== note.id ||
      preview.version !== args.expectedVersion ||
      preview.expiresAt < Date.now() ||
      preview.generation !== localHistoryGeneration
    )
      throw new McpToolError(
        'CONFIRMATION_REQUIRED',
        'Obtain and present a fresh roasting deletion preview'
      );
    if (preview.fingerprint !== (await impactFingerprint(tx, note)))
      throw new McpToolError(
        'CONFLICT',
        'Linked inventory changed after preview; preview again'
      );
    const deletion = prepareRoastingBatch(
      { noteId: note.id, beanId: r.roastedBeanId ?? '', now: Date.now() },
      await listCoffeeBeans(tx),
      note,
      await listBrewingNotes(tx)
    );
    for (const bean of deletion.beans)
      await writeBean((await getCoffeeBean(tx, bean.id)) ?? null, bean);
    const imageRows = await tx.query(
      "SELECT relative_path FROM brewing_note_images WHERE note_id = ? AND source_kind = 'file'",
      [note.id]
    );
    const cleanupPaths = imageRows.flatMap(row =>
      typeof row.relative_path === 'string' ? [row.relative_path] : []
    );
    if (deletion.deletedBeanId && roasted) {
      const images = await tx.query(
        "SELECT relative_path FROM coffee_bean_images WHERE bean_id = ? AND source_kind = 'file'",
        [roasted.id]
      );
      cleanupPaths.push(
        ...images.flatMap(row =>
          typeof row.relative_path === 'string' ? [row.relative_path] : []
        )
      );
      await tx.execute('DELETE FROM coffee_bean_images WHERE bean_id = ?', [
        roasted.id,
      ]);
      await deleteCoffeeBean(tx, roasted.id);
      changes.push({
        entity: 'bean',
        id: roasted.id,
        before: await beanView(roasted),
        after: null,
      });
    }
    await tx.execute('DELETE FROM brewing_note_images WHERE note_id = ?', [
      note.id,
    ]);
    await deleteBrewingNote(tx, note.id);
    changes.push({
      entity: 'brew_note',
      id: note.id,
      before: await noteView(note),
      after: null,
    });
    return {
      result: {
        deleted: true,
        id: note.id,
        deletedRoastedBeanId: deletion.deletedBeanId ?? null,
      },
      changes,
      summary: `撤销烘焙并返还生豆：${r.greenBeanName}`,
      cleanupPaths,
    };
  }
  throw new McpToolError('UNKNOWN_TOOL', 'Unknown roasting mutation');
}
