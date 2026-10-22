import {
  DATA_DOMAINS,
  hasDataAccess,
  parseAccessScopes,
  type AccessScopes,
} from '@/lib/permissions/access';
import {
  publishThroughBusinessHost,
  isBusinessActivityVisible,
} from './runtimeHost';
import {
  beanConversionDefinitions,
  readBeanConversionTool,
  mutateBeanConversionTool,
} from './beanConversionTools';
import { applyBrewGrinderScale } from '@/lib/grinder/scaleHistory';
import {
  resolveMcpNoteGrinder,
  normalizeMcpGrinderScale,
  isLatestMcpGrinderNote,
} from './noteGrinder';
import {
  listGrinders,
  saveGrinder,
} from '@/lib/data/sqlite/repositories/grinder';
import {
  archiveDefinitions,
  readArchiveTool,
  mutateArchiveTool,
} from './archiveTools';
import { imageReadDefinitions, readImageTool } from './imageReadTools';
import {
  capacityAdjustmentDefinitions,
  readCapacityAdjustmentTool,
  mutateCapacityAdjustmentTool,
} from './capacityAdjustmentTools';
import { DEFAULT_FLAVOR_DIMENSIONS } from '@/lib/data/models';
import {
  roasterLogoDefinitions,
  readRoasterLogoTool,
  mutateRoasterLogoTool,
} from './roasterLogoTools';
import {
  prepareMcpNoteImageMutation,
  getMcpNoteImageInfo,
  type McpNoteImageOperation,
} from './noteImageTools';
import { getAppSettings } from '@/lib/data/sqlite/repositories/appSettings';
import {
  normalizeCoffeeBeanForFieldConfig,
  normalizeCoffeeBeanFieldUpdate,
  resolveBeanFieldConfig,
  BEAN_FIELD_DEFINITIONS,
} from '@/lib/coffee-beans/beanFields';
import {
  prepareMcpBeanImageMutation,
  getMcpBeanImageInfo,
  cleanupMcpBeanImageFiles,
  MCP_BEAN_IMAGE_MAX_BYTES,
} from './beanImageTools';
import {
  resolveNoteReferences,
  NoteReferenceError,
  type NoteCatalogSelection,
} from '@/lib/notes/catalogReferences';
import { loadNoteReferenceCatalog, loadNoteMethodPreset } from './catalogTools';
import { applyNoteMethodPreset } from './notePreset';
import {
  preferencesDefinitions,
  readPreferencesTool,
  mutatePreferencesTool,
  publishPreferencesChanges,
} from './preferencesTools';
import {
  handlesCatalogTool,
  readCatalogTool,
  mutateCatalogTool,
  publishCatalogChanges,
} from './catalogTools';
import {
  roastingDefinitions,
  readRoastingTool,
  mutateRoastingTool,
} from './roastingTools';
import {
  MCP_DOMAIN_LABELS,
  mcpToolDomain,
  requiredMcpDomains,
  hasMcpDomainAccess,
  assertMutationScopeAccess,
} from './permissions';
import { nanoid } from 'nanoid';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import {
  getCoffeeBean,
  listCoffeeBeans,
  saveCoffeeBean,
  deleteCoffeeBean,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import {
  getBrewingNote,
  listBrewingNotes,
  listBrewingNotesByBeanId,
  saveBrewingNote,
  deleteBrewingNote,
} from '@/lib/data/sqlite/repositories/brewingNote';
import { normalizeCoffeeBean } from '@/lib/utils/coffeeBeanUtils';
import { normalizeBrewingNote } from '@/lib/notes/cleanup';
import {
  calculateFlavorInfo,
  getDefaultFlavorPeriodByRoastLevelSync,
} from '@/lib/utils/flavorPeriodUtils';
import { parseCoffeeBeanAmount } from '@/lib/coffee-beans/amount';
import {
  buildCapacityAdjustmentRecord,
  buildQuickDecrementRecord,
  getCapacityAdjustmentReversal,
} from '@/lib/coffee-beans/inventoryRecords';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';
import {
  commitMcpMutation,
  acknowledgeMcpPublication,
  flushMcpPublications,
  getMcpDriver,
  localHistoryGeneration,
  type MutationChange,
  type MutationWork,
} from './storage';
import { MCP_TOOLS, TOOL_SCHEMAS } from './toolDefinitions';
import {
  canonicalJson,
  invalid,
  McpToolError,
  recordVersion,
  validate,
} from './validation';
import type { McpPermissions, McpDomain } from './types';

export { MCP_TOOLS, McpToolError };

type Arguments = Record<string, unknown>;
type Entity = 'bean' | 'brew_note';
type DataView = Record<string, unknown>;
interface DeletePreview {
  entity: Entity | 'bean_image' | 'brew_note_image';
  imageId?: string;
  side?: 'front' | 'back';
  id: string;
  version: string;
  impactFingerprint: string;
  expiresAt: number;
  generation: number;
}
const deletePreviews = new Map<string, DeletePreview>();
const beanTextFields = [
  'name',
  'roaster',
  'roastLevel',
  'roastDate',
  'purchaseDate',
  'price',
  'notes',
  'brand',
  'ratingNotes',
] as const;
const beanValueFields = [
  'startDay',
  'endDay',
  'isFrozen',
  'isInTransit',
  'beanType',
  'beanState',
  'overallRating',
] as const;
const blendFields = [
  'percentage',
  'origin',
  'country',
  'region',
  'estate',
  'processingStation',
  'altitude',
  'process',
  'batch',
  'variety',
] as const;
const noteTextFields = ['equipment', 'method', 'notes'] as const;
const gramText = (value: number): string =>
  String(Math.round(value * 1000) / 1000);
const timestampAfter = (previous = 0): number =>
  Math.max(Date.now(), previous + 1);
const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;
const optionalNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const pageArgs = (args: Arguments) => ({
  offset: (args.offset as number | undefined) ?? 0,
  limit: (args.limit as number | undefined) ?? 25,
});

function amount(value: unknown): number | null {
  return parseCoffeeBeanAmount(value);
}

function noteDose(note: BrewingNote): number {
  if (note.source === 'quick-decrement') {
    const quick = amount(note.quickDecrementAmount);
    if (quick !== null && quick > 0) return quick;
  }
  return amount(note.params?.coffee) ?? 0;
}

function safeTaste(taste: BrewingNote['taste']): Record<string, number> {
  return Object.fromEntries(
    Object.entries(taste ?? {}).filter(
      ([key, value]) =>
        !['__proto__', 'constructor', 'prototype'].includes(key) &&
        typeof value === 'number' &&
        Number.isFinite(value)
    )
  );
}

async function beanView(
  bean: CoffeeBean,
  tx?: SqliteExecutor
): Promise<DataView> {
  const view: DataView = {
    id: bean.id,
    version: await recordVersion(bean),
    updatedAt: new Date(bean.timestamp).toISOString(),
    sourceGreenBeanId: bean.sourceGreenBeanId ?? null,
    capacityGrams: amount(bean.capacity),
    remainingGrams: amount(bean.remaining),
    flavor: Array.isArray(bean.flavor)
      ? bean.flavor.filter(value => typeof value === 'string')
      : [],
    flavorPeriod:
      bean.beanState === 'green'
        ? { phase: '生豆', remainingDays: 0 }
        : calculateFlavorInfo(bean),
  };
  for (const key of beanTextFields)
    if (typeof bean[key] === 'string') view[key] = bean[key];
  for (const key of beanValueFields) {
    if (['string', 'boolean', 'number'].includes(typeof bean[key]))
      view[key] = bean[key];
  }
  if (Array.isArray(bean.blendComponents)) {
    view.blendComponents = bean.blendComponents.map(component =>
      Object.fromEntries(
        blendFields.flatMap(key =>
          ['string', 'number'].includes(typeof component[key]) ||
          (Array.isArray(component[key]) &&
            (component[key] as unknown[]).every(
              value => typeof value === 'string'
            ))
            ? [[key, component[key]]]
            : []
        )
      )
    );
  }
  if (tx) {
    view.images = await getMcpBeanImageInfo(tx, bean.id);
    view.imageVersion = await deleteImpactFingerprint(tx, 'bean', bean);
  }
  return view;
}

async function noteView(
  note: BrewingNote,
  tx?: SqliteExecutor
): Promise<DataView> {
  const adjustment =
    note.source === 'capacity-adjustment'
      ? note.changeRecord?.capacityAdjustment
      : undefined;
  return {
    ...(tx
      ? {
          images: await getMcpNoteImageInfo(tx, note.id),
          imageVersion: await noteImageFingerprint(tx, note),
        }
      : {}),
    id: note.id,
    version: await recordVersion(note),
    brewedAt: new Date(note.timestamp).toISOString(),
    updatedAt: new Date(note.updatedAt ?? note.timestamp).toISOString(),
    beanId: optionalText(note.beanId),
    beanName: optionalText(note.coffeeBeanInfo?.name),
    beanSnapshot: note.coffeeBeanInfo
      ? {
          name: note.coffeeBeanInfo.name,
          roastLevel: note.coffeeBeanInfo.roastLevel ?? '',
          roastDate: note.coffeeBeanInfo.roastDate ?? null,
          roaster: note.coffeeBeanInfo.roaster ?? null,
        }
      : null,
    stages: note.stages ?? null,
    roaster: optionalText(note.coffeeBeanInfo?.roaster),
    equipment: optionalText(note.equipment),
    method: optionalText(note.method),
    equipmentId: note.equipmentId ?? null,
    methodId: note.methodId ?? null,
    equipmentName: note.equipmentName ?? null,
    methodName: note.methodName ?? null,
    source: optionalText(note.source) ?? 'brew',
    coffeeGrams: noteDose(note),
    waterGrams: amount(note.params?.water),
    extractionTimeSeconds: optionalNumber(note.params?.extractionTime) ?? null,
    liquidWeightGrams: amount(note.params?.liquidWeight),
    temperatureCelsius: amount(note.params?.temp),
    grindSize: optionalText(note.params?.grindSize),
    ratio: optionalText(note.params?.ratio),
    totalTimeSeconds: optionalNumber(note.totalTime),
    rating: optionalNumber(note.rating) ?? 0,
    taste: safeTaste(note.taste),
    notes: optionalText(note.notes) ?? '',
    ...(adjustment
      ? {
          inventoryAdjustment: {
            originalGrams: optionalNumber(adjustment.originalAmount),
            newGrams: optionalNumber(adjustment.newAmount),
            deltaGrams: optionalNumber(adjustment.changeAmount),
          },
        }
      : {}),
  };
}

async function requireBean(
  tx: SqliteExecutor,
  id: string
): Promise<CoffeeBean> {
  const bean = await getCoffeeBean(tx, id);
  if (!bean)
    throw new McpToolError(
      'NOT_FOUND',
      'Coffee bean not found. Query the current list before retrying.'
    );
  return bean;
}

async function requireNote(
  tx: SqliteExecutor,
  id: string
): Promise<BrewingNote> {
  const note = await getBrewingNote(tx, id);
  if (!note)
    throw new McpToolError(
      'NOT_FOUND',
      'Brew note not found. Query the current list before retrying.'
    );
  return note;
}

async function checkVersion(record: unknown, expected: unknown): Promise<void> {
  if ((await recordVersion(record)) !== expected)
    throw new McpToolError(
      'CONFLICT',
      'The record changed after it was read. Read it again, show the current values, and retry with its new version and a new requestId.'
    );
}

function checkOrdinaryNote(note: BrewingNote): void {
  if (note.source === 'capacity-adjustment' || note.source === 'roasting') {
    throw new McpToolError(
      'USE_APP',
      'Capacity-adjustment and roasting history have specialized reversal rules. Edit or delete this record in Brew Guide.'
    );
  }
}

function checkDeletableNote(note: BrewingNote): void {
  if (note.source === 'roasting') {
    throw new McpToolError(
      'USE_APP',
      'Roasting history has linked green/roasted bean effects. Delete it in Brew Guide.'
    );
  }
  if (
    note.source === 'capacity-adjustment' &&
    getCapacityAdjustmentReversal(note) === null
  )
    invalid(
      'The capacity-adjustment record has no valid signed change. Repair it in the app before deleting.'
    );
}

function noteStockReversal(note: BrewingNote): number {
  return note.source === 'capacity-adjustment'
    ? (getCapacityAdjustmentReversal(note) ?? 0)
    : noteDose(note);
}

function hasBrewDetails(fields: Arguments): boolean {
  return (
    fields.applyMethodPreset === true ||
    (Array.isArray(fields.stages) && fields.stages.length > 0) ||
    ['extractionTimeSeconds', 'liquidWeightGrams'].some(
      key => fields[key] !== undefined && fields[key] !== null
    ) ||
    [
      'equipment',
      'method',
      'equipmentId',
      'methodId',
      'waterGrams',
      'temperatureCelsius',
      'totalTimeSeconds',
      'grindSize',
      'ratio',
      'rating',
    ].some(key => Boolean(fields[key])) ||
    Object.values(
      (fields.taste as Record<string, unknown> | undefined) ?? {}
    ).some(Boolean)
  );
}

function validateBean(bean: CoffeeBean): void {
  if (!bean.name.trim()) invalid('bean.name cannot be blank');
  const capacity = amount(bean.capacity);
  const remaining = amount(bean.remaining);
  if (
    capacity !== null &&
    remaining !== null &&
    remaining > capacity + 0.000001
  )
    invalid('Remaining inventory cannot exceed package capacity');
  if (bean.endDay !== undefined && (bean.startDay ?? 0) > bean.endDay)
    invalid('startDay cannot exceed endDay');
  const blendTotal =
    bean.blendComponents?.reduce(
      (sum, component) => sum + (component.percentage ?? 0),
      0
    ) ?? 0;
  if (blendTotal > 100.000001)
    invalid('Blend percentages cannot total more than 100');
}

function buildBean(fields: Arguments, previous?: CoffeeBean): CoffeeBean {
  const base: CoffeeBean = previous
    ? stripCoffeeBeanImages(previous)
    : {
        id: nanoid(),
        timestamp: Date.now(),
        name: '',
        beanState: 'roasted',
        flavor: [],
      };
  const bean = { ...base };
  for (const key of beanTextFields) {
    if (Object.prototype.hasOwnProperty.call(fields, key))
      bean[key] = (fields[key] as string).trim();
  }
  // Each field was checked against the matching schema before this copy.
  for (const key of beanValueFields) {
    if (Object.prototype.hasOwnProperty.call(fields, key))
      Object.assign(bean, { [key]: fields[key] });
  }
  if (fields.flavor !== undefined)
    bean.flavor = (fields.flavor as string[])
      .map(value => value.trim())
      .filter(Boolean);
  if (fields.blendComponents !== undefined)
    bean.blendComponents =
      fields.blendComponents as CoffeeBean['blendComponents'];
  if (fields.capacityGrams !== undefined)
    bean.capacity = gramText(fields.capacityGrams as number);
  if (!previous) {
    bean.remaining = gramText(
      (fields.remainingGrams ?? fields.capacityGrams ?? 0) as number
    );
    const period = getDefaultFlavorPeriodByRoastLevelSync(
      bean.roastLevel,
      undefined,
      bean.roaster
    );
    bean.startDay ??= period.startDay;
    bean.endDay ??= period.endDay;
  }
  bean.timestamp = timestampAfter(previous?.timestamp);
  validateBean(bean);
  return normalizeCoffeeBean(bean, { ensureFlavorArray: true });
}

function buildNote(fields: Arguments, previous?: BrewingNote): BrewingNote {
  const now = Date.now();
  const note: BrewingNote = previous
    ? { ...stripBrewingNoteImages(previous), params: { ...previous.params } }
    : {
        id: nanoid(),
        timestamp: now,
        updatedAt: now,
        notes: '',
        rating: 0,
        taste: {},
        params: { coffee: '', water: '', temp: '', ratio: '', grindSize: '' },
      };
  for (const key of noteTextFields)
    if (fields[key] !== undefined) note[key] = (fields[key] as string).trim();
  if (fields.beanId !== undefined)
    note.beanId = (fields.beanId as string).trim() || undefined;
  if (fields.brewedAt !== undefined)
    note.timestamp = Date.parse(fields.brewedAt as string);
  if (fields.beanSnapshot !== undefined) {
    if (fields.beanSnapshot === null) delete note.coffeeBeanInfo;
    else
      note.coffeeBeanInfo = {
        ...(fields.beanSnapshot as NonNullable<BrewingNote['coffeeBeanInfo']>),
        roastLevel:
          (
            fields.beanSnapshot as Partial<
              NonNullable<BrewingNote['coffeeBeanInfo']>
            >
          ).roastLevel ?? '',
      };
  }
  if (fields.stages !== undefined)
    note.stages = fields.stages as BrewingNote['stages'];
  if (fields.rating !== undefined) note.rating = fields.rating as number;
  if (fields.taste !== undefined)
    note.taste = { ...note.taste, ...(fields.taste as Record<string, number>) };
  if (fields.totalTimeSeconds !== undefined)
    note.totalTime = fields.totalTimeSeconds as number;
  const params = note.params ?? {};
  if (fields.coffeeGrams !== undefined) {
    params.coffee = `${gramText(fields.coffeeGrams as number)}g`;
    if (note.source === 'quick-decrement') {
      note.quickDecrementAmount = amount(params.coffee) ?? 0;
      note.changeRecord = {
        ...note.changeRecord,
        quickDecrementAmount: amount(params.coffee) ?? 0,
      };
    }
  }
  if (fields.waterGrams !== undefined)
    params.water = `${gramText(fields.waterGrams as number)}g`;
  if (fields.extractionTimeSeconds !== undefined) {
    if (fields.extractionTimeSeconds === null) delete params.extractionTime;
    else params.extractionTime = fields.extractionTimeSeconds as number;
  }
  if (fields.liquidWeightGrams !== undefined) {
    if (fields.liquidWeightGrams === null) delete params.liquidWeight;
    else
      params.liquidWeight = `${gramText(fields.liquidWeightGrams as number)}g`;
  }
  if (fields.temperatureCelsius !== undefined)
    params.temp = `${gramText(fields.temperatureCelsius as number)}°C`;
  if (fields.grindSize !== undefined)
    params.grindSize = fields.grindSize as string;
  if (fields.ratio !== undefined) params.ratio = fields.ratio as string;
  note.params = params;
  const wantsQuick =
    fields.recordType === 'quick-decrement' ||
    (!previous &&
      fields.recordType !== 'brew' &&
      Boolean(note.beanId) &&
      noteDose(note) > 0 &&
      !hasBrewDetails(fields));
  if (wantsQuick) {
    if (!note.beanId || noteDose(note) <= 0)
      invalid(
        'A quick-decrement record requires a beanId and positive coffeeGrams'
      );
    if (hasBrewDetails(fields))
      invalid(
        'Quick-decrement records cannot contain brewing parameters or ratings. Use recordType brew.'
      );
    note.source = 'quick-decrement';
    note.quickDecrementAmount = amount(params.coffee) ?? 0;
    note.equipment = '';
    note.method = '';
    delete note.equipmentId;
    delete note.methodId;
    delete note.equipmentName;
    delete note.methodName;
    note.rating = 0;
    note.taste = {};
    note.totalTime = 0;
    note.params = {
      coffee: params.coffee,
      water: '',
      ratio: '',
      grindSize: '',
      temp: '',
    };
    delete note.changeRecord;
  } else if (
    fields.recordType === 'brew' ||
    (previous?.source === 'quick-decrement' &&
      (hasBrewDetails(fields) || !note.beanId))
  ) {
    delete note.source;
    delete note.quickDecrementAmount;
    delete note.changeRecord;
  }
  note.updatedAt = timestampAfter(previous?.updatedAt ?? previous?.timestamp);
  return normalizeBrewingNote(note).note;
}

function remainingAfterDelta(bean: CoffeeBean, delta: number): number {
  const current = amount(bean.remaining);
  if (current === null)
    throw new McpToolError(
      'INVALID_INVENTORY',
      'The linked bean has no valid remaining grams. Correct its inventory first.'
    );
  const capacity = amount(bean.capacity);
  const next = Math.max(0, current + delta);
  return Number(
    gramText(
      delta > 0 && capacity !== null && capacity > 0
        ? Math.min(next, capacity)
        : next
    )
  );
}

/** Uses current persisted data and composes note + all affected stock in the same transaction. */
async function changeStock(
  tx: SqliteExecutor,
  deltas: Map<string, number>,
  clampDecrement = false
): Promise<MutationChange[]> {
  const changes: MutationChange[] = [];
  for (const [id, delta] of deltas) {
    if (Math.abs(delta) < 0.000001) continue;
    const before = await requireBean(tx, id);
    const current = amount(before.remaining);
    if (current === null)
      throw new McpToolError(
        'INVALID_INVENTORY',
        'The linked bean has no valid remaining grams. Correct its inventory before recording consumption.'
      );
    const next = current + delta;
    if (next < -0.000001 && !clampDecrement)
      throw new McpToolError(
        'INSUFFICIENT_INVENTORY',
        `The linked bean has ${current}g remaining and cannot consume ${Math.abs(delta)}g.`
      );
    const after = {
      ...stripCoffeeBeanImages(before),
      remaining: gramText(remainingAfterDelta(before, delta)),
      timestamp: timestampAfter(before.timestamp),
    };
    await saveCoffeeBean(tx, after);
    changes.push({
      entity: 'bean',
      id,
      before: await beanView(before),
      after: await beanView(after),
    });
  }
  return changes;
}

function addDelta(
  deltas: Map<string, number>,
  id: string | undefined,
  delta: number
): void {
  if (id && delta) deltas.set(id, (deltas.get(id) ?? 0) + delta);
}

async function linkNote(
  tx: SqliteExecutor,
  note: BrewingNote,
  previous?: BrewingNote | null
): Promise<void> {
  if (!note.beanId) {
    // Historical unlinked snapshots survive ordinary edits and explicit unlinking.
    return;
  }
  const bean = await getCoffeeBean(tx, note.beanId);
  if (
    !bean &&
    previous?.beanId === note.beanId &&
    noteDose(previous) === noteDose(note)
  ) {
    // Imported history can retain the name of a bean that no longer exists.
    // A text/rating edit must not destroy that history or invent inventory.
    return;
  }
  if (!bean)
    throw new McpToolError(
      'NOT_FOUND',
      'The linked bean no longer exists. Metadata-only edits are allowed; change the link to an existing bean before changing the dose.'
    );
  if (bean.beanState === 'green')
    invalid('Brew notes can only consume roasted beans');
  if (previous?.beanId === note.beanId && previous.coffeeBeanInfo) return;
  note.coffeeBeanInfo = {
    name: bean.name,
    roastLevel: bean.roastLevel ?? '',
    roastDate: bean.roastDate,
    roaster: bean.roaster,
  };
}

async function recordChange(
  entity: Entity,
  before: CoffeeBean | BrewingNote | null,
  after: CoffeeBean | BrewingNote | null
): Promise<MutationChange> {
  const view =
    entity === 'bean'
      ? (value: CoffeeBean | BrewingNote) => beanView(value as CoffeeBean)
      : (value: CoffeeBean | BrewingNote) => noteView(value as BrewingNote);
  return {
    entity,
    id: (after ?? before)!.id,
    before: before ? await view(before) : null,
    after: after ? await view(after) : null,
  };
}

/** Publish only after commit; sync listeners receive the existing event shapes. */
export async function publishMcpChanges(
  changes: MutationChange[],
  suppliedDriver?: import('@/lib/data/sqlite/driver').SqliteDriver,
  source = 'mcp'
): Promise<void> {
  if (await publishThroughBusinessHost(changes)) return;
  await publishCatalogChanges(
    changes,
    suppliedDriver,
    source === 'remote' ? 'remote' : 'local'
  );
  await publishPreferencesChanges(
    changes,
    suppliedDriver,
    source === 'remote' ? 'remote' : 'local'
  );
  if (!changes.length || typeof window === 'undefined') return;
  const [
    { useCoffeeBeanStore },
    { useBrewingNoteStore },
    repositories,
    integrity,
  ] = await Promise.all([
    import('@/lib/stores/coffeeBeanStore'),
    import('@/lib/stores/brewingNoteStore'),
    import('@/lib/data/repositories'),
    import('@/lib/app/dataIntegrity'),
  ]);
  const driver = suppliedDriver ?? (await getMcpDriver());
  for (const change of changes) {
    if (change.entity === 'bean') {
      const current = await getCoffeeBean(driver, change.id);
      const store = useCoffeeBeanStore.getState();
      store.setBeans(
        current
          ? [
              ...store.beans.filter(bean => bean.id !== change.id),
              stripCoffeeBeanImages(current),
            ]
          : store.beans.filter(bean => bean.id !== change.id)
      );
      if (current) {
        // The sync payload retains existing images; MCP never reads or returns them.
        const bean =
          await repositories.coffeeBeanImageRepository.mergeBean(current);
        window.dispatchEvent(
          new CustomEvent('coffeeBeanDataChanged', {
            detail: {
              action: change.before ? 'update' : 'create',
              beanId: change.id,
              bean,
              source,
            },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('coffeeBeanDataChanged', {
            detail: { action: 'delete', beanId: change.id, source },
          })
        );
      }
    } else if (change.entity === 'brew_note') {
      const current = await getBrewingNote(driver, change.id);
      const store = useBrewingNoteStore.getState();
      store.setNotes(
        current
          ? [
              stripBrewingNoteImages(current),
              ...store.notes.filter(note => note.id !== change.id),
            ]
          : store.notes.filter(note => note.id !== change.id)
      );
      if (current) {
        const note =
          await repositories.brewingNoteImageRepository.mergeNote(current);
        window.dispatchEvent(
          new CustomEvent('brewingNoteDataChanged', {
            detail: {
              action: change.before ? 'update' : 'create',
              noteId: change.id,
              note,
              source,
            },
          })
        );
      } else {
        window.dispatchEvent(
          new CustomEvent('brewingNoteDataChanged', {
            detail: { action: 'delete', noteId: change.id, source },
          })
        );
      }
    }
  }
  if (changes.some(change => change.after !== null))
    await integrity.clearExpectedCoreDataDeletion();
  if (changes.some(change => change.after === null))
    await integrity.markExpectedCoreDataDeletionIfEmpty();
}

/** Recover notifications after a crash/failure without replaying business writes. */
export async function recoverMcpPublications(): Promise<void> {
  await flushMcpPublications(publishMcpChanges);
}

async function mutate(
  name: string,
  args: Arguments,
  grants: McpDomain[],
  scopes: AccessScopes
): Promise<DataView> {
  const createdImagePaths: string[] = [];
  let committed: Awaited<ReturnType<typeof commitMcpMutation<DataView>>>;
  try {
    committed = await commitMcpMutation(
      name,
      args,
      tx => performMutation(tx, name, args, grants, createdImagePaths),
      changes => assertMutationScopeAccess(name, changes, scopes),
      domains => {
        if (domains.some(domain => !hasDataAccess(scopes, domain, 'read')))
          throw new McpToolError(
            'PERMISSION_DENIED',
            'Read access to one or more stored response scopes has been revoked.'
          );
      }
    );
  } catch (error) {
    if (createdImagePaths.length) {
      try {
        await cleanupMcpBeanImageFiles(
          await getMcpDriver(),
          createdImagePaths,
          error
        );
      } catch {
        /* Retain files if rollback/reference safety cannot be established. */
      }
    }
    throw error;
  }
  if (committed.cleanupPaths.length) {
    try {
      await cleanupDeletedImages(committed.cleanupPaths);
    } catch {
      // Like existing image persistence, retain files when references cannot be verified.
      // The metadata deletion and the domain operation are already committed.
    }
  }
  if (committed.changes.length) {
    try {
      await publishMcpChanges(committed.changes);
      await acknowledgeMcpPublication(String(args.requestId));
    } catch {
      // Committed writes must not be reported as failures and retried as new operations.
      // A later reload reads the durable state; the activity record remains authoritative.
      return {
        ...committed.result,
        notificationWarning:
          'Saved successfully; refresh Brew Guide if its interface has not updated.',
      };
    }
  }
  return committed.result;
}

async function cleanupDeletedImages(paths: string[]): Promise<void> {
  const [{ createTauriImageFileStore }, { parseImageRelativePath }] =
    await Promise.all([
      import('@/lib/data/images/tauriImageFileStore'),
      import('@/lib/data/images/nativeImageFileStore'),
    ]);
  const fileStore = await createTauriImageFileStore();
  const driver = await getMcpDriver();
  for (const path of new Set(paths)) {
    // Hold the SQLite mutation queue during each check/delete, so another transaction
    // cannot introduce a reference after the check. Existing object keys are immutable.
    await driver.transaction(async tx => {
      const references = await tx.query(
        `SELECT relative_path FROM coffee_bean_images WHERE relative_path = ?
        UNION ALL SELECT relative_path FROM brewing_note_images WHERE relative_path = ? LIMIT 1`,
        [path, path]
      );
      if (!references.length)
        await fileStore.delete(parseImageRelativePath(path));
    });
  }
}

async function imagePaths(
  tx: SqliteExecutor,
  entity: Entity,
  id: string
): Promise<string[]> {
  const rows =
    entity === 'bean'
      ? await tx.query(
          "SELECT relative_path FROM coffee_bean_images WHERE bean_id = ? AND source_kind = 'file'",
          [id]
        )
      : await tx.query(
          "SELECT relative_path FROM brewing_note_images WHERE note_id = ? AND source_kind = 'file'",
          [id]
        );
  return rows.flatMap(row =>
    typeof row.relative_path === 'string' ? [row.relative_path] : []
  );
}

async function assertBeanUnreferenced(
  tx: SqliteExecutor,
  id: string
): Promise<void> {
  const [notes, beans] = await Promise.all([
    listBrewingNotes(tx),
    listCoffeeBeans(tx),
  ]);
  const referenced =
    notes.some(
      note =>
        note.beanId === id ||
        note.changeRecord?.roastingRecord?.greenBeanId === id ||
        note.changeRecord?.roastingRecord?.roastedBeanId === id
    ) || beans.some(bean => bean.sourceGreenBeanId === id);
  if (referenced)
    throw new McpToolError(
      'BEAN_IN_USE',
      'This bean is referenced by brewing/roasting history or roasted beans. Manage those links in Brew Guide before deleting it.'
    );
}

async function deleteImpactFingerprint(
  tx: SqliteExecutor,
  entity: Entity,
  record: CoffeeBean | BrewingNote
): Promise<string> {
  const images =
    entity === 'bean'
      ? await tx.query(
          'SELECT * FROM coffee_bean_images WHERE bean_id = ? ORDER BY image_id',
          [record.id]
        )
      : await tx.query(
          'SELECT * FROM brewing_note_images WHERE note_id = ? ORDER BY image_id',
          [record.id]
        );
  const beanId =
    entity === 'brew_note' ? (record as BrewingNote).beanId : undefined;
  const linkedBean = beanId
    ? ((await getCoffeeBean(tx, beanId)) ?? null)
    : null;
  return recordVersion({ record, images, linkedBean });
}

async function noteImageFingerprint(
  tx: SqliteExecutor,
  note: BrewingNote
): Promise<string> {
  const images = await tx.query(
    'SELECT * FROM brewing_note_images WHERE note_id = ? ORDER BY image_id',
    [note.id]
  );
  return recordVersion({ note, images });
}

async function performMutation(
  tx: SqliteExecutor,
  name: string,
  args: Arguments,
  grants: McpDomain[],
  createdImagePaths: string[]
): Promise<MutationWork<DataView>> {
  if (beanConversionDefinitions.some(tool => tool.name === name))
    return mutateBeanConversionTool(tx, name, args);
  if (archiveDefinitions.some(tool => tool.name === name))
    return mutateArchiveTool(tx, name, args);
  if (capacityAdjustmentDefinitions.some(tool => tool.name === name))
    return mutateCapacityAdjustmentTool(tx, name, args);
  if (roasterLogoDefinitions.some(tool => tool.name === name))
    return mutateRoasterLogoTool(tx, name, args);
  if (preferencesDefinitions.some(tool => tool.name === name))
    return mutatePreferencesTool(tx, name, args);
  if (handlesCatalogTool(name)) return mutateCatalogTool(tx, name, args);
  if (roastingDefinitions.some(tool => tool.name === name))
    return mutateRoastingTool(tx, name, args);
  const id = args.id as string;
  if (name === 'set_bean_image' || name === 'delete_bean_image') {
    const before = await requireBean(tx, id);
    await checkVersion(before, args.expectedVersion);
    const side = args.side as 'front' | 'back';
    const beforeImages = await getMcpBeanImageInfo(tx, id);
    if (
      name === 'set_bean_image' &&
      args.expectedImageVersion !==
        (await deleteImpactFingerprint(tx, 'bean', before))
    )
      throw new McpToolError(
        'CONFLICT',
        'The bean image changed. Read the bean again and use its current imageVersion.'
      );
    if (name === 'delete_bean_image') {
      const preview = deletePreviews.get(args.confirmationToken as string);
      if (
        !preview ||
        preview.entity !== 'bean_image' ||
        preview.side !== side ||
        preview.id !== id ||
        preview.version !== args.expectedVersion ||
        preview.expiresAt < Date.now() ||
        preview.generation !== localHistoryGeneration
      )
        throw new McpToolError(
          'CONFIRMATION_REQUIRED',
          'Obtain a fresh preview_delete for this bean image side before deleting.'
        );
      if (
        preview.impactFingerprint !==
        (await deleteImpactFingerprint(tx, 'bean', before))
      )
        throw new McpToolError(
          'CONFLICT',
          'The bean or its images changed after the preview. Obtain a new preview.'
        );
      if (!beforeImages.some(image => image.side === side))
        throw new McpToolError(
          'NOT_FOUND',
          'This bean image side does not exist.'
        );
    }
    const prepared = await prepareMcpBeanImageMutation(
      tx,
      { ...before, timestamp: Math.max(Date.now(), before.timestamp + 1) },
      side,
      name === 'delete_bean_image' ? null : (args.dataUrl as string)
    );
    createdImagePaths.push(...prepared.created.map(file => file.relativePath));
    await prepared.apply(tx);
    const after = await requireBean(tx, id);
    const change = await recordChange('bean', before, after);
    change.before = { ...(change.before as DataView), images: beforeImages };
    change.after = {
      ...(change.after as DataView),
      images: await getMcpBeanImageInfo(tx, id),
    };
    return {
      result: {
        bean: await beanView(after, tx),
        side,
        ...(name === 'delete_bean_image' ? { deleted: true } : {}),
      },
      changes: [change],
      cleanupPaths: prepared.supersededPaths,
      summary: `${name === 'delete_bean_image' ? '删除' : '保存'}咖啡豆${side === 'front' ? '正面' : '背面'}图片：${before.name}`,
    };
  }
  if (name === 'create_bean') {
    let bean = normalizeCoffeeBeanForFieldConfig(
      buildBean(args.bean as Arguments),
      await getAppSettings(tx)
    );
    let cleanupPaths: string[] = [];
    if (args.image) {
      const image = args.image as { side: 'front' | 'back'; dataUrl: string };
      const prepared = await prepareMcpBeanImageMutation(
        tx,
        bean,
        image.side,
        image.dataUrl
      );
      createdImagePaths.push(
        ...prepared.created.map(file => file.relativePath)
      );
      await prepared.apply(tx);
      bean = await requireBean(tx, bean.id);
      cleanupPaths = prepared.supersededPaths;
    } else await saveCoffeeBean(tx, bean);
    const changes = [await recordChange('bean', null, bean)];
    const capacity = amount(bean.capacity);
    const remaining = amount(bean.remaining);
    let adjustmentNote: BrewingNote | undefined;
    if (
      capacity !== null &&
      remaining !== null &&
      Math.abs(remaining - capacity) >= 0.01
    ) {
      adjustmentNote = {
        id: nanoid(),
        ...buildCapacityAdjustmentRecord(bean, capacity, remaining),
      };
      await saveBrewingNote(tx, adjustmentNote);
      changes.push(await recordChange('brew_note', null, adjustmentNote));
    }
    return {
      result: {
        bean: await beanView(bean, tx),
        ...(adjustmentNote
          ? { adjustmentNote: await noteView(adjustmentNote) }
          : {}),
      },
      changes,
      cleanupPaths,
      summary: `添加咖啡豆：${bean.name}`,
    };
  }
  if (name === 'update_bean') {
    const before = await requireBean(tx, id);
    await checkVersion(before, args.expectedVersion);
    const built = buildBean(args.changes as Arguments, before);
    const patch: Partial<CoffeeBean> = { ...built };
    if (!Object.hasOwn(args.changes as Arguments, 'notes')) delete patch.notes;
    if (!Object.hasOwn(args.changes as Arguments, 'blendComponents'))
      delete patch.blendComponents;
    let after: CoffeeBean;
    try {
      after = normalizeCoffeeBeanFieldUpdate(
        before,
        patch,
        await getAppSettings(tx)
      );
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'INVALID_ARGUMENT'
      )
        invalid(error.message);
      throw error;
    }
    if (
      before.beanState !== after.beanState &&
      (await listBrewingNotesByBeanId(tx, id)).length
    )
      invalid('Cannot change bean state while brewing records reference it');
    await saveCoffeeBean(tx, after);
    return {
      result: { bean: await beanView(after) },
      changes: [await recordChange('bean', before, after)],
      summary: `修改咖啡豆：${after.name}`,
    };
  }
  if (name === 'adjust_bean_inventory') {
    if ((args.remainingGrams === undefined) === (args.deltaGrams === undefined))
      invalid('Supply exactly one of remainingGrams and deltaGrams');
    const before = await requireBean(tx, id);
    await checkVersion(before, args.expectedVersion);
    const current = amount(before.remaining);
    if (current === null)
      invalid(
        'Existing inventory is invalid; correct the bean in the app first'
      );
    const next = (args.remainingGrams ??
      current + (args.deltaGrams as number)) as number;
    if (next < 0 || next > 1_000_000)
      invalid('New inventory must be between 0 and 1000000 grams');
    if (Math.abs(next - current) < 0.01)
      return {
        result: { bean: await beanView(before), adjustmentNote: null },
        changes: [],
        summary: `库存未变化：${before.name}`,
      };
    const after = {
      ...stripCoffeeBeanImages(before),
      remaining: gramText(next),
      timestamp: timestampAfter(before.timestamp),
    };
    validateBean(after);
    await saveCoffeeBean(tx, after);
    const persistedNext = amount(after.remaining)!;
    const delta = Number((persistedNext - current).toFixed(3));
    const quick =
      args.recordType === 'quick-decrement' ||
      (args.recordType !== 'capacity-adjustment' &&
        args.deltaGrams !== undefined &&
        delta < 0);
    if (quick && before.beanState === 'green')
      throw new McpToolError(
        'USE_APP',
        'Green bean consumption requires the app roasting workflow. Use capacity-adjustment only for an inventory correction.'
      );
    if (quick && (args.deltaGrams === undefined || delta >= 0))
      invalid('Quick decrement requires a negative deltaGrams');
    const note: BrewingNote = {
      id: nanoid(),
      ...(quick
        ? buildQuickDecrementRecord(after, -delta)
        : buildCapacityAdjustmentRecord(after, current, persistedNext)),
    };
    await saveBrewingNote(tx, note);
    return {
      result: {
        bean: await beanView(after),
        adjustmentNote: await noteView(note),
      },
      changes: [
        await recordChange('bean', before, after),
        await recordChange('brew_note', null, note),
      ],
      summary: `调整库存：${after.name}，${current}g → ${persistedNext}g`,
    };
  }
  if (name === 'create_brew_note' || name === 'update_brew_note') {
    const before =
      name === 'update_brew_note' ? await requireNote(tx, id) : null;
    if (before) {
      if (args.changes !== undefined) checkOrdinaryNote(before);
      await checkVersion(before, args.expectedVersion);
    }
    if (
      ['appendImages', 'replaceImage', 'reorderImageIds'].filter(
        key => args[key] !== undefined
      ).length > 1
    )
      invalid('Supply only one photo operation.');
    const fields = ((before ? args.changes : args.note) ?? {}) as Arguments;
    const photoOperation: McpNoteImageOperation | undefined = before
      ? args.appendImages !== undefined
        ? { kind: 'append', dataUrls: args.appendImages as string[] }
        : args.replaceImage !== undefined
          ? {
              kind: 'replace',
              ...(args.replaceImage as { imageId: string; dataUrl: string }),
            }
          : args.reorderImageIds !== undefined
            ? { kind: 'reorder', imageIds: args.reorderImageIds as string[] }
            : undefined
      : args.images !== undefined
        ? { kind: 'append', dataUrls: args.images as string[] }
        : undefined;
    if (before && !Object.keys(fields).length && !photoOperation)
      invalid('Supply note changes or an image operation.');
    if (
      before &&
      photoOperation &&
      args.expectedImageVersion !== (await noteImageFingerprint(tx, before))
    )
      throw new McpToolError(
        'CONFLICT',
        'Read the current note and supply its imageVersion before modifying photos.'
      );
    if (fields.taste !== undefined) {
      const settings = await getAppSettings(tx);
      const known = new Set(
        (settings?.flavorDimensions ?? DEFAULT_FLAVOR_DIMENSIONS).map(
          dimension => dimension.id
        )
      );
      for (const key of Object.keys(fields.taste as Record<string, unknown>))
        if (!known.has(key))
          invalid(
            'taste keys must identify currently configured flavor dimensions; historical scores are preserved when omitted.'
          );
    }
    const after =
      before && !Object.keys(fields).length
        ? {
            ...stripBrewingNoteImages(before),
            updatedAt: Math.max(
              Date.now(),
              (before.updatedAt ?? before.timestamp) + 1
            ),
          }
        : buildNote(fields, before ?? undefined);
    if (after.beanId && fields.beanSnapshot !== undefined)
      invalid(
        'beanSnapshot is only writable for unlinked notes; a linked bean supplies its canonical snapshot.'
      );
    if (after.source !== 'quick-decrement') {
      try {
        const selection: Partial<NoteCatalogSelection> = {};
        for (const key of [
          'equipment',
          'method',
          'equipmentId',
          'methodId',
        ] as const) {
          if (Object.prototype.hasOwnProperty.call(fields, key))
            Object.assign(selection, { [key]: fields[key] });
        }
        const catalog = await loadNoteReferenceCatalog(tx);
        if (!grants.includes('brewing')) {
          catalog.equipment = [];
          catalog.methods = [];
        }
        Object.assign(
          after,
          resolveNoteReferences(selection, catalog, before ?? undefined)
        );
        if (fields.applyMethodPreset === true) {
          if (!grants.includes('brewing'))
            throw new McpToolError(
              'PERMISSION_DENIED',
              'Applying a recipe requires the brewing data scope.'
            );
          if (!after.equipmentId || !after.methodId)
            invalid(
              'No unique recipe matches this equipment and method. Query list_method and select a matching recipe before applying a preset; do not substitute another equipment.'
            );
          const preset = await loadNoteMethodPreset(
            tx,
            after.equipmentId,
            after.methodId
          );
          applyNoteMethodPreset(
            after,
            preset.params,
            fields,
            preset.isEspresso
          );
        }
      } catch (error) {
        if (error instanceof NoteReferenceError) invalid(error.message);
        throw error;
      }
    }
    if (!before && after.beanId && fields.coffeeGrams === undefined)
      invalid('coffeeGrams is required for a linked brew note');
    if (
      after.beanId &&
      (!before || before.beanId !== after.beanId || !before.coffeeBeanInfo) &&
      !grants.includes('beans')
    )
      throw new McpToolError(
        'PERMISSION_DENIED',
        'Populating a linked bean snapshot requires coffee bean read access.'
      );
    if (!before || Object.keys(fields).length)
      await linkNote(tx, after, before);
    const grinders = grants.includes('settings') ? await listGrinders(tx) : [];
    if (
      !after.source &&
      after.params?.grindSize &&
      (!before ||
        fields.grindSize !== undefined ||
        fields.applyMethodPreset === true)
    ) {
      const resolved = resolveMcpNoteGrinder(after.params.grindSize, grinders);
      if (resolved) {
        const scale = normalizeMcpGrinderScale(
          resolved.grinder,
          resolved.scale
        );
        // Use the same name/scale format as the app's grinder input.
        after.params.grindSize = `${resolved.grinder.name} ${scale}`;
      }
    }
    const deltas = new Map<string, number>();
    if (before) addDelta(deltas, before.beanId, noteDose(before));
    addDelta(deltas, after.beanId, -noteDose(after));
    const changes = await changeStock(tx, deltas);
    let saved = after;
    let cleanupPaths: string[] = [];
    if (photoOperation) {
      const prepared = await prepareMcpNoteImageMutation(
        tx,
        after,
        photoOperation
      );
      createdImagePaths.push(
        ...prepared.created.map(file => file.relativePath)
      );
      await prepared.apply(tx);
      saved = await requireNote(tx, after.id);
      cleanupPaths = prepared.supersededPaths;
    } else await saveBrewingNote(tx, after);
    changes.push(await recordChange('brew_note', before, saved));
    if (
      grants.includes('settings') &&
      args.syncGrinder !== false &&
      !saved.source &&
      saved.equipment &&
      saved.method &&
      saved.params?.grindSize &&
      (!before ||
        fields.grindSize !== undefined ||
        fields.equipment !== undefined ||
        fields.method !== undefined ||
        fields.equipmentId !== undefined ||
        fields.methodId !== undefined ||
        fields.beanId !== undefined ||
        fields.brewedAt !== undefined ||
        fields.applyMethodPreset === true)
    ) {
      const parsed = resolveMcpNoteGrinder(saved.params.grindSize, grinders);
      if (
        parsed &&
        isLatestMcpGrinderNote(
          saved,
          await listBrewingNotes(tx),
          grinders,
          parsed.grinder.id
        )
      ) {
        const previousGrinder = parsed.grinder;
        const nextGrinder = applyBrewGrinderScale(
          previousGrinder,
          parsed.scale,
          saved.equipment,
          saved.method,
          saved.coffeeBeanInfo,
          Date.now()
        );
        await saveGrinder(tx, nextGrinder);
        changes.push({
          entity: 'grinder',
          id: nextGrinder.id,
          before: previousGrinder,
          after: nextGrinder,
        });
      }
    }

    return {
      cleanupPaths,
      result: {
        note: await noteView(saved, tx),
        inventoryChanges: changes
          .filter(change => change.entity === 'bean')
          .map(change => change.after),
      },
      changes,
      summary: `${before ? '修改' : '添加'}冲煮记录：${after.coffeeBeanInfo?.name ?? after.equipment ?? '未关联咖啡豆'}`,
    };
  }
  if (name === 'delete_brew_note_image') {
    const before = await requireNote(tx, id);
    await checkVersion(before, args.expectedVersion);
    const preview = deletePreviews.get(args.confirmationToken as string);
    if (
      !preview ||
      preview.entity !== 'brew_note_image' ||
      preview.imageId !== args.imageId ||
      preview.id !== id ||
      preview.version !== args.expectedVersion ||
      preview.expiresAt < Date.now() ||
      preview.generation !== localHistoryGeneration
    )
      throw new McpToolError(
        'CONFIRMATION_REQUIRED',
        'Obtain a fresh preview_delete for this exact note image.'
      );
    if (preview.impactFingerprint !== (await noteImageFingerprint(tx, before)))
      throw new McpToolError(
        'CONFLICT',
        'The note or its photos changed after the preview.'
      );
    const prepared = await prepareMcpNoteImageMutation(
      tx,
      {
        ...before,
        updatedAt: Math.max(
          Date.now(),
          (before.updatedAt ?? before.timestamp) + 1
        ),
      },
      { kind: 'remove', imageId: args.imageId as string }
    );
    createdImagePaths.push(...prepared.created.map(file => file.relativePath));
    await prepared.apply(tx);
    const after = await requireNote(tx, id);
    return {
      result: {
        deleted: true,
        imageId: args.imageId,
        note: await noteView(after, tx),
      },
      changes: [await recordChange('brew_note', before, after)],
      cleanupPaths: prepared.supersededPaths,
      summary: '删除笔记图片',
    };
  }
  if (name === 'delete_bean' || name === 'delete_brew_note') {
    const entity: Entity = name === 'delete_bean' ? 'bean' : 'brew_note';
    const preview = deletePreviews.get(args.confirmationToken as string);
    if (
      !preview ||
      preview.expiresAt < Date.now() ||
      preview.generation !== localHistoryGeneration ||
      preview.entity !== entity ||
      preview.id !== id ||
      preview.version !== args.expectedVersion
    ) {
      throw new McpToolError(
        'CONFIRMATION_REQUIRED',
        'Obtain a fresh preview_delete for this record and present its impact before deleting.'
      );
    }
    if (entity === 'bean') {
      const before = await requireBean(tx, id);
      await checkVersion(before, args.expectedVersion);
      if (
        (await deleteImpactFingerprint(tx, entity, before)) !==
        preview.impactFingerprint
      )
        throw new McpToolError(
          'CONFLICT',
          'The record or its images changed after the deletion preview. Obtain a new preview before deletion.'
        );
      await assertBeanUnreferenced(tx, id);
      const cleanupPaths = await imagePaths(tx, 'bean', id);
      await tx.execute('DELETE FROM coffee_bean_images WHERE bean_id = ?', [
        id,
      ]);
      await deleteCoffeeBean(tx, id);
      return {
        result: { deleted: true, id },
        changes: [await recordChange('bean', before, null)],
        cleanupPaths,
        summary: `删除咖啡豆：${before.name}`,
      };
    }
    const before = await requireNote(tx, id);
    checkDeletableNote(before);
    await checkVersion(before, args.expectedVersion);
    if (
      (await deleteImpactFingerprint(tx, entity, before)) !==
      preview.impactFingerprint
    )
      throw new McpToolError(
        'CONFLICT',
        'The note, its images or the linked inventory changed after the deletion preview. Obtain a new preview before deletion.'
      );
    const deltas = new Map<string, number>();
    if (before.beanId && (await getCoffeeBean(tx, before.beanId)))
      addDelta(deltas, before.beanId, noteStockReversal(before));
    const changes = await changeStock(
      tx,
      deltas,
      before.source === 'capacity-adjustment'
    );
    const cleanupPaths = await imagePaths(tx, 'brew_note', id);
    await tx.execute('DELETE FROM brewing_note_images WHERE note_id = ?', [id]);
    await deleteBrewingNote(tx, id);
    changes.push(await recordChange('brew_note', before, null));
    return {
      result: {
        deleted: true,
        id,
        inventoryChanges: changes
          .filter(change => change.entity === 'bean')
          .map(change => change.after),
      },
      changes,
      cleanupPaths,
      summary: `删除冲煮记录：${before.coffeeBeanInfo?.name ?? before.equipment ?? id}`,
    };
  }
  throw new McpToolError('UNKNOWN_TOOL', 'Unknown mutation tool');
}

function matchesSearch(search: unknown, record: unknown): boolean {
  return (
    !search ||
    canonicalJson(record)
      .toLocaleLowerCase()
      .includes((search as string).trim().toLocaleLowerCase())
  );
}

async function readTool(
  name: string,
  args: Arguments,
  grants: McpDomain[]
): Promise<unknown> {
  const driver = await getMcpDriver();
  if (beanConversionDefinitions.some(tool => tool.name === name))
    return readBeanConversionTool(driver, name, args);
  if (archiveDefinitions.some(tool => tool.name === name))
    return readArchiveTool(driver, name, args);
  if (imageReadDefinitions.some(tool => tool.name === name))
    return readImageTool(driver, name, args);
  if (capacityAdjustmentDefinitions.some(tool => tool.name === name))
    return readCapacityAdjustmentTool(driver, name, args);
  if (roasterLogoDefinitions.some(tool => tool.name === name))
    return readRoasterLogoTool(driver, name, args);
  if (preferencesDefinitions.some(tool => tool.name === name))
    return readPreferencesTool(driver, name, args);
  if (handlesCatalogTool(name)) return readCatalogTool(driver, name, args);
  if (roastingDefinitions.some(tool => tool.name === name))
    return readRoastingTool(driver, name, args);
  if (name === 'get_bean')
    return {
      bean: await beanView(
        await requireBean(driver, args.id as string),
        driver
      ),
    };
  if (name === 'get_brew_note')
    return {
      note: await noteView(
        await requireNote(driver, args.id as string),
        driver
      ),
    };
  if (name === 'list_beans') {
    let beans = (await listCoffeeBeans(driver)).filter(
      bean =>
        (!args.beanType || bean.beanType === args.beanType) &&
        (!args.beanState || (bean.beanState ?? 'roasted') === args.beanState) &&
        (!args.inStockOnly || (amount(bean.remaining) ?? 0) > 0) &&
        matchesSearch(args.search, {
          name: bean.name,
          roaster: bean.roaster,
          flavor: bean.flavor,
          notes: bean.notes,
        })
    );
    beans = beans.sort((a, b) => {
      if (args.sort === 'name')
        return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      if (args.sort === 'remaining')
        return (
          (amount(a.remaining) ?? 0) - (amount(b.remaining) ?? 0) ||
          a.id.localeCompare(b.id)
        );
      return b.timestamp - a.timestamp || b.id.localeCompare(a.id);
    });
    const { offset, limit } = pageArgs(args);
    return {
      total: beans.length,
      offset,
      limit,
      hasMore: offset + limit < beans.length,
      items: await Promise.all(
        beans.slice(offset, offset + limit).map(bean => beanView(bean, driver))
      ),
    };
  }
  if (name === 'list_brew_notes') {
    const from = args.from ? Date.parse(args.from as string) : -Infinity;
    const to = args.to ? Date.parse(args.to as string) : Infinity;
    if (from > to) invalid('from must not be later than to');
    let notes = args.beanId
      ? await listBrewingNotesByBeanId(driver, args.beanId as string)
      : await listBrewingNotes(driver);
    notes = notes.filter(
      note =>
        note.timestamp >= from &&
        note.timestamp <= to &&
        note.rating >= ((args.minimumRating as number | undefined) ?? 0) &&
        matchesSearch(args.search, {
          notes: note.notes,
          beanName: note.coffeeBeanInfo?.name,
          equipment: note.equipment,
          method: note.method,
        })
    );
    notes.sort((a, b) => {
      if (args.sort === 'oldest')
        return a.timestamp - b.timestamp || a.id.localeCompare(b.id);
      if (args.sort === 'rating')
        return (
          b.rating - a.rating ||
          b.timestamp - a.timestamp ||
          b.id.localeCompare(a.id)
        );
      return b.timestamp - a.timestamp || b.id.localeCompare(a.id);
    });
    const { offset, limit } = pageArgs(args);
    return {
      total: notes.length,
      offset,
      limit,
      hasMore: offset + limit < notes.length,
      items: await Promise.all(
        notes.slice(offset, offset + limit).map(note => noteView(note, driver))
      ),
    };
  }
  if (name === 'get_inventory_summary') {
    const days = (args.days as number | undefined) ?? 30;
    const [beans, notes] = await Promise.all([
      listCoffeeBeans(driver),
      listBrewingNotes(driver),
    ]);
    const recent = notes.filter(
      note =>
        !note.source &&
        note.timestamp >= Date.now() - days * 86_400_000 &&
        note.timestamp <= Date.now()
    );
    const rated = recent.filter(note => note.rating > 0);
    const phases: Record<string, number> = {};
    for (const bean of beans) {
      if (bean.beanState === 'green' || (amount(bean.remaining) ?? 0) <= 0)
        continue;
      const phase = calculateFlavorInfo(bean).phase;
      phases[phase] = (phases[phase] ?? 0) + 1;
    }
    return {
      asOf: new Date().toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      beans: {
        total: beans.length,
        inStock: beans.filter(bean => (amount(bean.remaining) ?? 0) > 0).length,
        roastedRemainingGrams: beans
          .filter(bean => bean.beanState !== 'green')
          .reduce((sum, bean) => sum + (amount(bean.remaining) ?? 0), 0),
        greenRemainingGrams: beans
          .filter(bean => bean.beanState === 'green')
          .reduce((sum, bean) => sum + (amount(bean.remaining) ?? 0), 0),
        flavorPeriodCounts: phases,
      },
      ...(grants.includes('notes')
        ? {
            recentBrews: {
              days,
              count: recent.length,
              coffeeGrams: recent.reduce(
                (sum, note) => sum + noteDose(note),
                0
              ),
              averageRating: rated.length
                ? rated.reduce((sum, note) => sum + note.rating, 0) /
                  rated.length
                : null,
            },
          }
        : {}),
    };
  }
  if (name === 'preview_delete') {
    return driver.transaction(async tx => {
      if (args.entity === 'brew_note_image') {
        if (typeof args.imageId !== 'string' || args.side !== undefined)
          invalid('A note image preview requires imageId, not side.');
        const note = await requireNote(tx, args.id as string);
        const image = (await getMcpNoteImageInfo(tx, note.id)).find(
          image => image.imageId === args.imageId
        );
        if (!image)
          throw new McpToolError(
            'NOT_FOUND',
            'This note image does not exist.'
          );
        const version = await recordVersion(note);
        const token = nanoid(32);
        const expiresAt = Date.now() + 5 * 60_000;
        for (const [key, preview] of deletePreviews)
          if (preview.expiresAt < Date.now()) deletePreviews.delete(key);
        while (deletePreviews.size >= 100)
          deletePreviews.delete(deletePreviews.keys().next().value!);
        deletePreviews.set(token, {
          entity: 'brew_note_image',
          imageId: args.imageId,
          id: note.id,
          version,
          impactFingerprint: await noteImageFingerprint(tx, note),
          expiresAt,
          generation: localHistoryGeneration,
        });
        return {
          entity: 'brew_note_image',
          id: note.id,
          imageId: args.imageId,
          version,
          confirmationToken: token,
          expiresAt: new Date(expiresAt).toISOString(),
          record: { id: note.id, image },
          impact: {
            recordsDeleted: 0,
            imageVariantsRemoved: image.hasThumbnail ? 2 : 1,
            inventoryChangeGrams: 0,
          },
        };
      }
      if (args.imageId !== undefined)
        invalid('imageId is only valid for brew_note_image previews.');

      if (args.entity === 'bean_image') {
        if (args.side !== 'front' && args.side !== 'back')
          invalid('A bean image deletion preview requires side.');
        const side = args.side as 'front' | 'back';
        const bean = await requireBean(tx, args.id as string);
        const images = await getMcpBeanImageInfo(tx, bean.id);
        const image = images.find(image => image.side === side);
        if (!image)
          throw new McpToolError(
            'NOT_FOUND',
            'This bean image side does not exist.'
          );
        const version = await recordVersion(bean);
        const token = nanoid(32);
        const expiresAt = Date.now() + 5 * 60_000;
        for (const [key, preview] of deletePreviews)
          if (preview.expiresAt < Date.now()) deletePreviews.delete(key);
        while (deletePreviews.size >= 100)
          deletePreviews.delete(deletePreviews.keys().next().value!);
        deletePreviews.set(token, {
          entity: 'bean_image',
          side,
          id: bean.id,
          version,
          impactFingerprint: await deleteImpactFingerprint(tx, 'bean', bean),
          expiresAt,
          generation: localHistoryGeneration,
        });
        return {
          entity: 'bean_image',
          side,
          id: bean.id,
          version,
          confirmationToken: token,
          expiresAt: new Date(expiresAt).toISOString(),
          record: { id: bean.id, name: bean.name, image },
          impact: {
            recordsDeleted: 0,
            imageVariantsRemoved: image.hasThumbnail ? 2 : 1,
            inventoryChangeGrams: 0,
          },
        };
      }
      if (args.side !== undefined)
        invalid('side is only valid for bean_image previews.');

      const entity = args.entity as Entity;
      const id = args.id as string;
      const record =
        entity === 'bean'
          ? await requireBean(tx, id)
          : await requireNote(tx, id);
      if (entity === 'bean') {
        await assertBeanUnreferenced(tx, id);
      } else checkDeletableNote(record as BrewingNote);
      if (
        entity === 'brew_note' &&
        (record as BrewingNote).beanId &&
        !grants.includes('beans')
      )
        throw new McpToolError(
          'PERMISSION_DENIED',
          'Previewing linked inventory requires coffee bean read access.'
        );
      const version = await recordVersion(record);
      const token = nanoid(32);
      const expiresAt = Date.now() + 5 * 60_000;
      for (const [key, preview] of deletePreviews)
        if (preview.expiresAt < Date.now()) deletePreviews.delete(key);
      while (deletePreviews.size >= 100)
        deletePreviews.delete(deletePreviews.keys().next().value!);
      deletePreviews.set(token, {
        entity,
        id,
        version,
        impactFingerprint: await deleteImpactFingerprint(tx, entity, record),
        expiresAt,
        generation: localHistoryGeneration,
      });
      const imageCount =
        entity === 'bean'
          ? await tx.query(
              'SELECT count(*) AS count FROM coffee_bean_images WHERE bean_id = ?',
              [id]
            )
          : await tx.query(
              'SELECT count(*) AS count FROM brewing_note_images WHERE note_id = ?',
              [id]
            );
      const note = entity === 'brew_note' ? (record as BrewingNote) : undefined;
      const linkedBean = note?.beanId
        ? await getCoffeeBean(tx, note.beanId)
        : undefined;
      return {
        entity,
        id,
        version,
        confirmationToken: token,
        expiresAt: new Date(expiresAt).toISOString(),
        record:
          entity === 'bean'
            ? await beanView(record as CoffeeBean)
            : await noteView(record as BrewingNote),
        impact: {
          recordsDeleted: 1,
          imageVariantsRemoved: Number(imageCount[0]?.count ?? 0),
          inventoryRestoration:
            note && linkedBean
              ? {
                  beanId: linkedBean.id,
                  recordedDoseGrams:
                    note.source === 'capacity-adjustment' ? 0 : noteDose(note),
                  deltaGrams: noteStockReversal(note),
                  resultingRemainingGrams: remainingAfterDelta(
                    linkedBean,
                    noteStockReversal(note)
                  ),
                  currentRemainingGrams: amount(linkedBean.remaining),
                  cappedAtCapacityGrams: amount(linkedBean.capacity),
                }
              : null,
        },
        instruction:
          'Present this exact impact to the user before deletion. A token authorizes this single unchanged record only.',
      };
    });
  }
  if (name === 'list_mcp_activity') {
    const { offset, limit } = pageArgs(args);
    const all = await driver.query(
      'SELECT request_id, tool, timestamp_ms, summary, snapshots_json FROM mcp_activity ORDER BY timestamp_ms DESC, request_id DESC'
    );
    const rows = all
      .filter(row => isBusinessActivityVisible(String(row.request_id)))
      .filter(row => {
        const domain = mcpToolDomain(String(row.tool));
        return (
          domain !== undefined &&
          (domain === null || grants.includes(domain)) &&
          requiredMcpDomains(String(row.tool)).every(required =>
            grants.includes(required)
          )
        );
      })
      .slice(offset, offset + limit + 1);
    return {
      offset,
      limit,
      hasMore: rows.length > limit,
      items: rows.slice(0, limit).map(row => ({
        requestId: row.request_id,
        tool: row.tool,
        timestamp: row.timestamp_ms,
        summary: row.summary,
        changes: (
          JSON.parse(String(row.snapshots_json)) as MutationChange[]
        ).filter(change => {
          const domain =
            change.entity === 'settings'
              ? row.tool === 'convert_roasted_to_green'
                ? 'settings'
                : mcpToolDomain(String(row.tool))
              : (
                  {
                    bean: 'beans',
                    brew_note: 'notes',
                    equipment: 'brewing',
                    method: 'brewing',
                    grinder: 'settings',
                    settings: 'settings',
                    historical_report: 'beans',
                  } as const
                )[change.entity];
          return (
            domain !== undefined && domain !== null && grants.includes(domain)
          );
        }),
      })),
    };
  }
  throw new McpToolError('UNKNOWN_TOOL', 'Unknown read tool');
}

export async function executeMcpTool(
  name: string,
  args: unknown,
  permissions: McpPermissions | (() => Promise<McpPermissions>)
): Promise<unknown> {
  const schema = TOOL_SCHEMAS.get(name);
  const tool = MCP_TOOLS.find(tool => tool.name === name);
  if (!schema || !tool) {
    if (typeof permissions === 'function') await permissions();
    throw new McpToolError('UNKNOWN_TOOL', 'Unknown tool');
  }
  const execute = async () => {
    // A queued request obtains its one-use native authorization only when it
    // reaches the actual operation boundary. Validate afterwards so the native
    // reply ticket also permits returning an ordinary argument error.
    const activePermissions =
      typeof permissions === 'function' ? await permissions() : permissions;
    const domain =
      name === 'preview_delete'
        ? ['bean', 'bean_image'].includes(String((args as Arguments)?.entity))
          ? 'beans'
          : 'notes'
        : mcpToolDomain(name);
    let scopes: AccessScopes;
    try {
      if (Object.keys(activePermissions).some(key => key !== 'scopes'))
        throw new Error('Unknown permissions');
      scopes = parseAccessScopes(activePermissions.scopes);
    } catch {
      throw new McpToolError('PERMISSION_DENIED', 'Invalid permission scopes.');
    }
    const grants = DATA_DOMAINS.filter(domain => hasDataAccess(scopes, domain));
    const access = tool._meta['brewGuide/access'];
    if (
      domain === undefined ||
      (domain !== null && !hasDataAccess(scopes, domain, access)) ||
      !hasMcpDomainAccess(name, scopes, access)
    )
      throw new McpToolError(
        'PERMISSION_DENIED',
        'The requested access to this data scope has not been authorized.'
      );
    validate(args, schema);
    const argumentsRecord = args as Arguments;
    if (name === 'create_brew_note' || name === 'update_brew_note') {
      const selection = (argumentsRecord.note ??
        argumentsRecord.changes ??
        {}) as Arguments;
      if (
        !grants.includes('brewing') &&
        (typeof selection.equipmentId === 'string' ||
          typeof selection.methodId === 'string' ||
          selection.applyMethodPreset === true)
      ) {
        throw new McpToolError(
          'PERMISSION_DENIED',
          'Explicit catalog linking requires the corresponding catalog data scope.'
        );
      }
    }
    if (name === 'get_capabilities')
      return {
        transport: 'Streamable HTTP',
        desktopOnly: true,
        ...(grants.includes('beans')
          ? {
              beanInput: {
                fieldConfig: resolveBeanFieldConfig(
                  await getAppSettings(await getMcpDriver())
                ),
                fields: BEAN_FIELD_DEFINITIONS,
                multipleValues:
                  'Use an array of separate values; never split a slash inside a value such as SL28/34.',
                disabledFields:
                  'Stored in notes using the app field labels; arrays preserve boundaries as JSON array values.',
                images: {
                  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
                  maxSourceBytes: MCP_BEAN_IMAGE_MAX_BYTES,
                  maxPixels: 32000000,
                  compression: {
                    targetSizeMB: 0.1,
                    maxWidthOrHeight: 1200,
                    initialQuality: 0.8,
                  },
                  note: 'Target byte size is best effort; decoded images are recompressed and stored with thumbnails. Explicit get_bean_image reads can return bounded pixels; list/activity never include them.',
                },
              },
            }
          : {}),
        scopes,
        domains: Object.entries(MCP_DOMAIN_LABELS).map(([id, label]) => ({
          id,
          label,
          enabled: grants.includes(id as (typeof grants)[number]),
        })),
        tools: MCP_TOOLS.filter(t => {
          return hasMcpDomainAccess(
            t.name,
            scopes,
            t._meta['brewGuide/access']
          );
        }).map(t => ({ name: t.name, readOnly: t.annotations.readOnlyHint })),
        excluded: [
          'External account credentials and sync configuration',
          'Whole-database import/reset and arbitrary files',
          'Interactive timer, camera and platform permissions',
          'System-managed sync queues/migration markers and credentials are not arbitrary CRUD data',
          'Graphical editor gestures; persisted safe SVG/frame assets and historical report archives use explicit tools',
        ],
      };

    const result = tool.annotations.readOnlyHint
      ? await readTool(name, argumentsRecord, grants)
      : await mutate(name, argumentsRecord, grants, scopes);
    if (name.startsWith('delete_') && !(result as DataView).replayed)
      deletePreviews.delete(argumentsRecord.confirmationToken as string);
    return result;
  };
  return tool.annotations.readOnlyHint ? execute() : withDataMutation(execute);
}
