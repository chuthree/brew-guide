import {
  BEAN_FIELD_DEFINITIONS,
  normalizeBeanFieldConfig,
} from '@/lib/coffee-beans/beanFields';
import { mergeNavigationSettings } from '@/lib/navigation/navigationSettings';
import {
  normalizeEstimatedCupDoseSettings,
  calculateEstimatedCupsFromWeights,
} from '@/lib/settings/estimatedCupDose';
import { buildRecordStatistics } from '@/lib/statistics/recordMetrics';
import { transformRoasterRenameRecords } from '@/lib/data/roasterRename';
import {
  listGrinders,
  upsertGrinders,
} from '@/lib/data/sqlite/repositories/grinder';
import { saveCoffeeBean } from '@/lib/data/sqlite/repositories/coffeeBean';
import { saveBrewingNote } from '@/lib/data/sqlite/repositories/brewingNote';
import { normalizeCoffeeBeanRoaster } from '@/lib/utils/coffeeBeanUtils';
import { nanoid } from 'nanoid';
import type {
  AppSettings,
  CoffeeBeanGroup,
  FlavorDimension,
  RoasterConfig,
} from '@/lib/data/models';
import { DEFAULT_FLAVOR_DIMENSIONS } from '@/lib/data/models';
import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import {
  getAppSettings,
  saveAppSettings,
} from '@/lib/data/sqlite/repositories/appSettings';
import { listCoffeeBeans } from '@/lib/data/sqlite/repositories/coffeeBean';
import { listBrewingNotes } from '@/lib/data/sqlite/repositories/brewingNote';
import { normalizeCoffeeBeanGroups } from '@/lib/utils/coffeeBeanGroupUtils';
import { parseCoffeeBeanAmount } from '@/lib/coffee-beans/capacityAdjustment';
import type { Schema } from './toolDefinitions';
import type { MutationChange, MutationWork } from './storage';
import { getMcpDriver, localHistoryGeneration } from './storage';
import { invalid, McpToolError, recordVersion, validate } from './validation';

type Args = Record<string, unknown>;
const obj = (
  properties: Record<string, Schema>,
  required: string[] = []
): Schema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const text: Schema = { type: 'string', minLength: 1, maxLength: 128 };
const version: Schema = { type: 'string', minLength: 64, maxLength: 64 };
const requestId: Schema = { type: 'string', minLength: 8, maxLength: 128 };
const ids: Schema = { type: 'array', items: text, maxItems: 1000 };
const boundedNumber = (minimum: number, maximum: number): Schema => ({
  type: 'number',
  minimum,
  maximum,
});
const bool: Schema = { type: 'boolean' };
export const safePreferenceSchema: Record<string, Schema> = {
  notificationSound: bool,
  hapticFeedback: bool,
  showFlowRate: bool,
  textZoomLevel: boundedNumber(0.8, 1.2),
  radarChartScale: boundedNumber(0.5, 1.1),
  radarChartShape: { type: 'string', enum: ['polygon', 'circle'] },
  radarChartAlign: { type: 'string', enum: ['left', 'center'] },
  decrementPresets: {
    type: 'array',
    items: boundedNumber(0.001, 100000),
    maxItems: 20,
  },
  greenBeanRoastPresets: {
    type: 'array',
    items: boundedNumber(0.001, 100000),
    maxItems: 20,
  },
  enableAllDecrementOption: bool,
  enableCustomDecrementInput: bool,
  enableAllGreenBeanRoastOption: bool,
  enableCustomGreenBeanRoastInput: bool,
  simplifiedViewLabels: bool,
  dateDisplayMode: {
    type: 'string',
    enum: ['date', 'flavorPeriod', 'agingDays'],
  },
  showFlavorInfo: bool,
  showBeanNotes: bool,
  showNoteContent: bool,
  limitNotesLines: bool,
  notesMaxLines: { type: 'integer', minimum: 1, maximum: 5 },
  showPrice: bool,
  showTotalPrice: bool,
  showStatusDots: bool,
  showBeanSummary: bool,
  showEstimatedCups: bool,
};
const write = { requestId, expectedVersion: version };
const period = obj(
  {
    startDay: { type: 'integer', minimum: 0, maximum: 3650 },
    endDay: { type: 'integer', minimum: 0, maximum: 3650 },
  },
  ['startDay', 'endDay']
);
const flavorPeriod = obj({ light: period, medium: period, dark: period }, [
  'light',
  'medium',
  'dark',
]);
Object.assign(safePreferenceSchema, {
  customFlavorPeriod: flavorPeriod,
  estimatedCupDoseSettings: obj(
    {
      filter: boundedNumber(0.1, 100000),
      espresso: boundedNumber(0.1, 100000),
      omni: boundedNumber(0.1, 100000),
    },
    ['filter', 'espresso', 'omni']
  ),
  enableBeanSummaryCapacityLimit: bool,
  beanSummaryMaxDisplayCapacity: boundedNumber(1, 1000000),
  enableBeanSummaryOverflowWrap: bool,
  showFlavorRatingInForm: bool,
  showOverallRatingInForm: bool,
  flavorRatingFollowOverall: bool,
  flavorRatingHalfStep: bool,
  flavorRatingTenthStep: bool,
  overallRatingUseSlider: bool,
  showRatingDimensionsEntry: bool,
  showUnitPriceInNote: bool,
  showBeanAgingDaysInNote: bool,
  showFlavorInNote: bool,
  showNoteTimeInNote: bool,
  showCapacityAdjustmentRecords: bool,
  useClassicNotesListStyle: bool,
  showBeanRating: bool,
  beanRatingTenthStep: bool,
  enableGreenBeanInventory: bool,
  enableConvertToGreen: bool,
  syncNewNoteDateWithSelectedDate: bool,
  syncQuickDecrementDateWithSelectedDate: bool,
});
Object.assign(safePreferenceSchema, {
  username: { type: 'string', maxLength: 128 },
  showUpdatePrompt: bool,
  showBeanReadyReminderPopup: bool,
  enableBeanPrint: bool,
  artisticShareRatingStyle: { type: 'string', enum: ['number', 'dots', 'bar'] },
  artisticShareTags: { type: 'string', maxLength: 4000 },
  autoFillRecognitionImage: bool,
  showEstateField: bool,
  immersiveAdd: bool,
  experimentalBeanSharePackageEnabled: bool,
  showMenuBarIcon: bool,
  showCoffeeBeanSelectionStep: bool,
  showBrewingVisualizer: bool,
  roasterFieldEnabled: bool,
  roasterSeparator: { type: 'string', enum: [' ', '/'] },
  layoutSettings: {
    ...obj({
      progressBarHeight: { type: 'integer', enum: [4, 8, 12, 16, 20] },
      dataFontSize: { type: 'string', enum: ['2xl', '3xl', '4xl'] },
      stepDisplayMode: {
        type: 'string',
        enum: ['independent', 'cumulative', 'time'],
      },
    }),
    minProperties: 1,
  },
  safeAreaMargins: obj(
    { top: boundedNumber(10, 80), bottom: boundedNumber(10, 80) },
    ['top', 'bottom']
  ),
  navigationSettings: {
    ...obj({
      visibleTabs: obj({ brewing: bool, coffeeBean: bool, notes: bool }),
      coffeeBeanViews: obj({ inventory: bool, ranking: bool, stats: bool }),
      pinnedViews: {
        type: 'array',
        items: { type: 'string', enum: ['ranking', 'stats'] },
        maxItems: 2,
      },
    }),
    minProperties: 1,
  },
  randomCoffeeBeans: obj(
    {
      enableLongPressRandomType: bool,
      defaultRandomType: { type: 'string', enum: ['espresso', 'filter'] },
      flavorPeriodRanges: obj(
        {
          aging: bool,
          optimal: bool,
          decline: bool,
          frozen: bool,
          inTransit: bool,
          unknown: bool,
        },
        ['aging', 'optimal', 'decline', 'frozen', 'inTransit', 'unknown']
      ),
    },
    ['enableLongPressRandomType', 'defaultRandomType', 'flavorPeriodRanges']
  ),
  beanFieldConfig: obj(
    {
      version: { type: 'integer', enum: [1] },
      fields: {
        type: 'array',
        minItems: 1,
        maxItems: 9,
        items: obj(
          {
            id: { type: 'string', enum: BEAN_FIELD_DEFINITIONS.map(f => f.id) },
            enabled: bool,
            order: { type: 'integer', minimum: 0, maximum: 1000 },
          },
          ['id', 'enabled', 'order']
        ),
      },
    },
    ['version', 'fields']
  ),
});
const deletion = { ...write, id: text, confirmationToken: version };
export const preferencesDefinitions: Array<{
  name: string;
  description: string;
  schema: Schema;
  write?: boolean;
  destructive?: boolean;
}> = [
  {
    name: 'get_preferences',
    description:
      'Read explicitly safe display and brewing preferences only; credentials, accounts and sync settings are never returned.',
    schema: obj({}),
  },
  {
    name: 'update_preferences',
    description:
      'Update allowlisted preferences; optional clearFields removes stored overrides (application defaults apply). Nested layout/navigation patches merge; other nested values replace. Credentials and unrelated fields are never touched.',
    write: true,
    schema: obj(
      {
        ...write,
        patch: { ...obj(safePreferenceSchema), minProperties: 1 },
        clearFields: {
          type: 'array',
          items: { type: 'string', enum: Object.keys(safePreferenceSchema) },
          minItems: 1,
          maxItems: Object.keys(safePreferenceSchema).length,
        },
      },
      ['requestId', 'expectedVersion']
    ),
  },
  {
    name: 'list_bean_groups',
    description:
      'Read ordered coffee bean groups and versions. Version applies to the complete group collection.',
    schema: obj({}),
  },
  {
    name: 'create_bean_group',
    description: 'Create a named bean group with valid deduplicated bean IDs.',
    write: true,
    schema: obj({ ...write, name: text, beanIds: ids }, [
      'requestId',
      'expectedVersion',
      'name',
    ]),
  },
  {
    name: 'update_bean_group',
    description:
      'Update a bean group without changing its beans or other groups.',
    write: true,
    schema: obj({ ...write, id: text, name: text, beanIds: ids }, [
      'requestId',
      'expectedVersion',
      'id',
    ]),
  },
  {
    name: 'reorder_bean_groups',
    description: 'Reorder all groups. Supply every group ID exactly once.',
    write: true,
    schema: obj({ ...write, ids }, ['requestId', 'expectedVersion', 'ids']),
  },
  {
    name: 'get_flavor_dimensions',
    description:
      'Read flavor rating dimensions and historical labels; historical note ratings are retained when dimensions change.',
    schema: obj({}),
  },
  {
    name: 'upsert_flavor_dimension',
    description:
      'Create a custom rating dimension or edit an existing label. Omitting id creates a dimension.',
    write: true,
    schema: obj({ ...write, id: text, label: text }, [
      'requestId',
      'expectedVersion',
      'label',
    ]),
  },
  {
    name: 'reorder_flavor_dimensions',
    description:
      'Reorder all rating dimensions without changing labels or historical ratings.',
    write: true,
    schema: obj({ ...write, ids }, ['requestId', 'expectedVersion', 'ids']),
  },
  {
    name: 'list_roaster_configs',
    description:
      'Read roaster taste-window configurations without images, credentials or arbitrary settings.',
    schema: obj({}),
  },
  {
    name: 'upsert_roaster_config',
    description:
      'Set a roaster taste window by roast level. This does not rename the roaster or rewrite historical records.',
    write: true,
    schema: obj({ ...write, roasterName: text, flavorPeriod }, [
      'requestId',
      'expectedVersion',
      'roasterName',
      'flavorPeriod',
    ]),
  },
  {
    name: 'preview_delete_preferences_item',
    description:
      'Preview deletion of a group, rating dimension or roaster configuration. Does not delete beans or historical records.',
    schema: obj(
      {
        kind: {
          type: 'string',
          enum: ['group', 'flavor_dimension', 'roaster_config'],
        },
        id: text,
      },
      ['kind', 'id']
    ),
  },
  {
    name: 'delete_bean_group',
    description:
      'Delete only the group, never its beans; requires a current deletion preview.',
    write: true,
    destructive: true,
    schema: obj(deletion, [
      'requestId',
      'expectedVersion',
      'id',
      'confirmationToken',
    ]),
  },
  {
    name: 'delete_flavor_dimension',
    description:
      'Remove a rating dimension but retain historical labels and note scores.',
    write: true,
    destructive: true,
    schema: obj(deletion, [
      'requestId',
      'expectedVersion',
      'id',
      'confirmationToken',
    ]),
  },
  {
    name: 'delete_roaster_config',
    description:
      'Delete only a roaster taste-window configuration, not coffee beans or notes.',
    write: true,
    destructive: true,
    schema: obj(deletion, [
      'requestId',
      'expectedVersion',
      'id',
      'confirmationToken',
    ]),
  },
  {
    name: 'preview_roaster_rename',
    description:
      'Preview canonical roaster rename across beans, note snapshots, grinder history and taste-window configurations.',
    schema: obj({ fromName: text, toName: text }, ['fromName', 'toName']),
  },
  {
    name: 'rename_roaster',
    description:
      'Apply previewed roaster rename atomically across every original-app reference. May merge target configuration according to original application rules.',
    write: true,
    destructive: true,
    schema: obj(
      { ...write, fromName: text, toName: text, confirmationToken: version },
      [
        'requestId',
        'expectedVersion',
        'fromName',
        'toName',
        'confirmationToken',
      ]
    ),
  },
  {
    name: 'get_statistics',
    description:
      'Read inventory, categorized records, consumption/cost and roasting trends using shared original-app metrics. Range is start-inclusive/end-exclusive; no-range falls back to inventory changes only when no valid records exist.',
    schema: obj({
      groupBy: { type: 'string', enum: ['day', 'month'] },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
    }),
  },
];

function safeProjection(value: unknown, schema: Schema): unknown {
  if (
    schema.type === 'object' &&
    value &&
    typeof value === 'object' &&
    !Array.isArray(value)
  )
    return Object.fromEntries(
      Object.entries(schema.properties ?? {})
        .filter(([key]) => Object.prototype.hasOwnProperty.call(value, key))
        .map(([key, child]) => [
          key,
          safeProjection((value as Args)[key], child),
        ])
    );
  if (schema.type === 'array' && Array.isArray(value) && schema.items)
    return value.map(item => safeProjection(item, schema.items!));
  if (schema.type === 'string' && typeof value === 'string') return value;
  if (schema.type === 'boolean' && typeof value === 'boolean') return value;
  if (
    (schema.type === 'number' || schema.type === 'integer') &&
    typeof value === 'number' &&
    Number.isFinite(value)
  )
    return value;
  return null; // Malformed imported scalars must not expose arbitrary nested data.
}
function safeView(settings: AppSettings): Args {
  return Object.fromEntries(
    Object.keys(safePreferenceSchema)
      .filter(k => settings[k as keyof AppSettings] !== undefined)
      .map(k => [
        k,
        safeProjection(
          settings[k as keyof AppSettings],
          safePreferenceSchema[k]
        ),
      ])
  );
}
function groupView(settings: AppSettings): CoffeeBeanGroup[] {
  return normalizeCoffeeBeanGroups(
    (settings.coffeeBeanGroups ?? []).map(group => ({
      ...group,
      createdAt: group.createdAt ?? 0,
      updatedAt: group.updatedAt ?? 0,
    }))
  );
}
function dimensions(settings: AppSettings): FlavorDimension[] {
  return [...(settings.flavorDimensions ?? DEFAULT_FLAVOR_DIMENSIONS)].sort(
    (a, b) => a.order - b.order
  );
}
function roasters(settings: AppSettings) {
  return (settings.roasterConfigs ?? []).map(
    ({ roasterName, flavorPeriod, updatedAt }) => ({
      roasterName,
      flavorPeriod,
      updatedAt,
    })
  );
}
function domainView(settings: AppSettings, name: string): unknown {
  if (name.includes('group')) return groupView(settings);
  if (name.includes('flavor_dimension'))
    return {
      dimensions: dimensions(settings),
      historicalLabels: settings.flavorDimensionHistoricalLabels ?? {},
    };
  if (name.includes('roaster')) return roasters(settings);
  return safeView(settings);
}
async function settingsAt(tx: SqliteExecutor): Promise<AppSettings> {
  const stored = await getAppSettings(tx);
  if (stored) return stored;
  const { defaultSettings } = await import('@/lib/stores/settingsStore');
  return structuredClone(defaultSettings);
}
async function checkVersion(value: unknown, expected: unknown) {
  if ((await recordVersion(value)) !== expected)
    throw new McpToolError(
      'CONFLICT',
      'Preferences changed; read the collection again.'
    );
}
function reordered<T extends { id: string; order: number }>(
  items: T[],
  order: unknown
): T[] {
  const wanted = order as string[];
  if (
    wanted.length !== items.length ||
    new Set(wanted).size !== items.length ||
    wanted.some(id => !items.some(item => item.id === id))
  )
    invalid('ids must contain every current ID exactly once');
  return wanted.map((id, index) => ({
    ...items.find(item => item.id === id)!,
    order: index,
  }));
}
const previewTokens = new Map<
  string,
  {
    kind: string;
    id: string;
    version: string;
    expires: number;
    generation: number;
  }
>();
const kindTool = (kind: string) =>
  kind === 'group'
    ? 'bean_group'
    : kind === 'flavor_dimension'
      ? 'flavor_dimensions'
      : 'roaster_configs';
function findItem(settings: AppSettings, kind: string, id: string): unknown {
  const value =
    kind === 'group'
      ? groupView(settings).find(g => g.id === id)
      : kind === 'flavor_dimension'
        ? dimensions(settings).find(d => d.id === id)
        : roasters(settings).find(r => r.roasterName === id);
  if (!value) throw new McpToolError('NOT_FOUND', 'Preferences item not found');
  return value;
}
export async function readPreferencesTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<Args> {
  validate(
    args,
    preferencesDefinitions.find(d => d.name === name)?.schema ?? obj({})
  );
  const settings = await settingsAt(tx);
  if (name === 'preview_roaster_rename')
    return previewRename(tx, settings, args);
  if (name === 'preview_delete_preferences_item') {
    const kind = String(args.kind);
    const id = String(args.id);
    const item = findItem(settings, kind, id);
    const version = await recordVersion(domainView(settings, kindTool(kind)));
    const confirmationToken = await recordVersion({
      nonce: nanoid(),
      kind,
      id,
      version,
    });
    if (previewTokens.size >= 500)
      previewTokens.delete(previewTokens.keys().next().value!);
    previewTokens.set(confirmationToken, {
      kind,
      id,
      version,
      expires: Date.now() + 300000,
      generation: localHistoryGeneration,
    });
    for (const [token, preview] of previewTokens)
      if (
        preview.generation !== localHistoryGeneration ||
        preview.expires < Date.now()
      )
        previewTokens.delete(token);
    return {
      item,
      version,
      confirmationToken,
      impact: {
        deletesOnlyConfiguration: true,
        beansDeleted: 0,
        notesDeleted: 0,
        historicalLabelsPreserved: true,
      },
      expiresInSeconds: 300,
    };
  }
  if (name === 'get_statistics') {
    const beans = await listCoffeeBeans(tx);
    const notes = await listBrewingNotes(tx);
    const from = args.from ? Date.parse(String(args.from)) : -Infinity;
    const to = args.to ? Date.parse(String(args.to)) : Infinity;
    if (from > to) invalid('from must not exceed to');
    const selected = notes.filter(n => n.timestamp >= from && n.timestamp < to);
    const counts = {
      brewing: 0,
      quickConsumption: 0,
      capacityAdjustment: 0,
      roasting: 0,
    };
    for (const note of selected) {
      if (note.source === 'capacity-adjustment') counts.capacityAdjustment++;
      else if (note.source === 'quick-decrement') counts.quickConsumption++;
      else if (String(note.source).includes('roast')) counts.roasting++;
      else counts.brewing++;
    }
    const inventory = ['green', 'roasted'].map(state => {
      const matching = beans.filter(b => (b.beanState ?? 'roasted') === state);
      return {
        state,
        beanCount: matching.length,
        capacityGrams: matching.reduce(
          (sum, b) => sum + (parseCoffeeBeanAmount(b.capacity) ?? 0),
          0
        ),
        remainingGrams: matching.reduce(
          (sum, b) => sum + (parseCoffeeBeanAmount(b.remaining) ?? 0),
          0
        ),
      };
    });
    return {
      inventory,
      estimatedCups: calculateEstimatedCupsFromWeights(
        beans
          .filter(b => b.beanState !== 'green')
          .map(b => ({
            beanType: b.beanType,
            remainingWeight: parseCoffeeBeanAmount(b.remaining) ?? 0,
          })),
        settings.estimatedCupDoseSettings
      ),
      records: counts,
      totalRecords: selected.length,
      metrics: buildRecordStatistics(beans, notes, {
        from: args.from ? from : undefined,
        to: args.to ? to : undefined,
        groupBy: args.groupBy as 'day' | 'month' | undefined,
      }),
      scope:
        'Current inventory plus original-app record consumption/cost rules; quick consumption is included in usage but not ordinary brewing count.',
      from: args.from ?? null,
      to: args.to ?? null,
    };
  }
  const value = domainView(settings, name);
  return {
    ...(name === 'get_preferences'
      ? { preferences: value }
      : name === 'get_flavor_dimensions'
        ? (value as Args)
        : { items: value }),
    version: await recordVersion(value),
  };
}
export async function mutatePreferencesTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<MutationWork<Args>> {
  validate(
    args,
    preferencesDefinitions.find(d => d.name === name)?.schema ?? obj({})
  );
  const before = await settingsAt(tx);
  if (name === 'rename_roaster') return applyRename(tx, before, args);
  const next = structuredClone(before);
  const view = domainView(before, name);
  await checkVersion(view, args.expectedVersion);
  if (name.startsWith('delete_')) {
    const kind =
      name === 'delete_bean_group'
        ? 'group'
        : name === 'delete_flavor_dimension'
          ? 'flavor_dimension'
          : 'roaster_config';
    const preview = previewTokens.get(String(args.confirmationToken));
    if (
      !preview ||
      preview.kind !== kind ||
      preview.id !== args.id ||
      preview.version !== args.expectedVersion ||
      preview.generation !== localHistoryGeneration ||
      preview.expires < Date.now()
    )
      throw new McpToolError(
        'CONFIRMATION_REQUIRED',
        'Get a fresh matching deletion preview.'
      );
    findItem(before, kind, String(args.id));
    if (kind === 'group')
      next.coffeeBeanGroups = groupView(before).filter(g => g.id !== args.id);
    else if (kind === 'flavor_dimension') {
      next.flavorDimensions = dimensions(before).filter(d => d.id !== args.id);
      next.flavorDimensionHistoricalLabels = {
        ...Object.fromEntries(dimensions(before).map(d => [d.id, d.label])),
        ...before.flavorDimensionHistoricalLabels,
      };
    } else
      next.roasterConfigs = (before.roasterConfigs ?? []).filter(
        r => r.roasterName !== args.id
      );
  } else if (name === 'update_preferences') {
    const patch = (args.patch ?? {}) as Partial<AppSettings>;
    const clearFields = (args.clearFields ?? []) as Array<keyof AppSettings>;
    if (!Object.keys(patch).length && !clearFields.length)
      invalid('Supply patch or clearFields');
    if (
      clearFields.some(key => Object.prototype.hasOwnProperty.call(patch, key))
    )
      invalid('Cannot patch and clear the same preference');
    for (const key of clearFields) delete next[key];
    if (
      patch.customFlavorPeriod &&
      Object.values(patch.customFlavorPeriod).some(p => p.startDay > p.endDay)
    )
      invalid('Taste-window startDay must not exceed endDay');
    if (
      patch.flavorRatingHalfStep === true &&
      patch.flavorRatingTenthStep === true
    )
      invalid('Half-step and tenth-step ratings are mutually exclusive');
    Object.assign(next, patch);
    if (patch.beanFieldConfig) {
      if (
        new Set(patch.beanFieldConfig.fields.map(f => f.id)).size !==
        patch.beanFieldConfig.fields.length
      )
        invalid('Duplicate bean field IDs');
      next.beanFieldConfig = normalizeBeanFieldConfig(patch.beanFieldConfig);
    }
    if (patch.layoutSettings)
      next.layoutSettings = {
        ...before.layoutSettings,
        ...patch.layoutSettings,
      };
    if (patch.navigationSettings) {
      next.navigationSettings = mergeNavigationSettings(
        before.navigationSettings,
        patch.navigationSettings
      );
      if (!Object.values(next.navigationSettings.visibleTabs).some(Boolean))
        invalid('At least one main navigation tab must remain visible');
    }
    if (patch.flavorRatingHalfStep === true) next.flavorRatingTenthStep = false;
    if (patch.flavorRatingTenthStep === true) next.flavorRatingHalfStep = false;
    for (const key of ['decrementPresets', 'greenBeanRoastPresets'] as const) {
      if (patch[key]) {
        const normalized = patch[key].map(value => Number(value.toFixed(1)));
        if (normalized.some(value => value <= 0))
          invalid('Preset must remain positive after rounding to one decimal');
        next[key] = [...new Set(normalized)].sort((a, b) => a - b);
      }
    }
    if (patch.estimatedCupDoseSettings)
      next.estimatedCupDoseSettings = normalizeEstimatedCupDoseSettings(
        patch.estimatedCupDoseSettings
      );
  } else if (name === 'create_bean_group' || name === 'update_bean_group') {
    const groups = groupView(before);
    const old = groups.find(g => g.id === args.id);
    if (name === 'update_bean_group' && !old)
      throw new McpToolError('NOT_FOUND', 'Group not found');
    const beanIds = Array.from(
      new Set((args.beanIds ?? old?.beanIds ?? []) as string[])
    );
    const valid = new Set((await listCoffeeBeans(tx)).map(b => b.id));
    if (beanIds.some(id => !valid.has(id)))
      invalid('beanIds contains an unknown bean');
    const now = Date.now();
    const group: CoffeeBeanGroup = {
      id: old?.id ?? nanoid(),
      name: String(args.name ?? old?.name).trim(),
      beanIds,
      order: old?.order ?? groups.length,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
    };
    next.coffeeBeanGroups = old
      ? groups.map(g => (g.id === old.id ? group : g))
      : [...groups, group];
  } else if (name === 'reorder_bean_groups')
    next.coffeeBeanGroups = reordered(groupView(before), args.ids);
  else if (name === 'upsert_flavor_dimension') {
    const list = dimensions(before);
    const old = list.find(d => d.id === args.id);
    if (args.id && !old)
      throw new McpToolError('NOT_FOUND', 'Rating dimension not found');
    const dimension: FlavorDimension = {
      id: old?.id ?? `custom_${nanoid()}`,
      label: String(args.label).trim(),
      order: old?.order ?? list.length,
      isDefault: old?.isDefault ?? false,
    };
    next.flavorDimensions = old
      ? list.map(d => (d.id === old.id ? dimension : d))
      : [...list, dimension];
    next.flavorDimensionHistoricalLabels = {
      ...before.flavorDimensionHistoricalLabels,
      [dimension.id]: dimension.label,
    };
  } else if (name === 'reorder_flavor_dimensions')
    next.flavorDimensions = reordered(dimensions(before), args.ids);
  else if (name === 'upsert_roaster_config') {
    const flavorPeriod = args.flavorPeriod as NonNullable<
      RoasterConfig['flavorPeriod']
    >;
    if (Object.values(flavorPeriod).some(p => p.startDay > p.endDay))
      invalid('Taste-window startDay must not exceed endDay');
    const list = before.roasterConfigs ?? [];
    const old = list.find(
      r => r.roasterName === String(args.roasterName).trim()
    );
    const config: RoasterConfig = {
      ...old,
      roasterName: String(args.roasterName).trim(),
      flavorPeriod,
      updatedAt: Date.now(),
    };
    next.roasterConfigs = old
      ? list.map(r => (r === old ? config : r))
      : [...list, config];
  } else throw new McpToolError('UNKNOWN_TOOL', 'Unknown preferences mutation');
  await saveAppSettings(tx, next);
  const afterView = domainView(next, name);
  return {
    result: {
      ...(Array.isArray(afterView)
        ? { items: afterView }
        : { value: afterView }),
      version: await recordVersion(afterView),
    },
    changes: [
      { entity: 'settings', id: 'main', before: view, after: afterView },
    ],
    summary: `Updated ${name.replaceAll('_', ' ')}`,
  };
}
export async function publishPreferencesChanges(
  changes: MutationChange[]
): Promise<void> {
  if (
    typeof window === 'undefined' ||
    !changes.some(change => change.entity === 'settings')
  )
    return;
  const { useSettingsStore, defaultSettings } =
    await import('@/lib/stores/settingsStore');
  const stored = await settingsAt(await getMcpDriver());
  const settings = { ...useSettingsStore.getState().settings, ...stored };
  // Cleared overrides must not survive in the existing in-memory store.
  for (const key of Object.keys(safePreferenceSchema) as Array<
    keyof AppSettings
  >) {
    if (!Object.prototype.hasOwnProperty.call(stored, key)) {
      delete settings[key];
      if (Object.prototype.hasOwnProperty.call(defaultSettings, key))
        Object.assign(settings, { [key]: defaultSettings[key] });
    }
  }
  useSettingsStore.setState({ settings, isLoading: false, error: null });
  {
    window.dispatchEvent(
      new CustomEvent('settingsChanged', {
        detail: { source: 'local', settings },
      })
    );
    window.dispatchEvent(
      new CustomEvent('flavorDimensionsChanged', {
        detail: { dimensions: dimensions(settings) },
      })
    );
  }
}

const renamePreviews = new Map<
  string,
  {
    fingerprint: string;
    fromName: string;
    toName: string;
    expires: number;
    generation: number;
  }
>();
async function renameInput(
  tx: SqliteExecutor,
  settings: AppSettings,
  args: Args
) {
  const fromName = normalizeCoffeeBeanRoaster(String(args.fromName));
  const toName = normalizeCoffeeBeanRoaster(String(args.toName));
  if (!fromName || !toName || fromName === toName)
    invalid('Source and target roaster names must differ and be non-empty');
  const beans = await listCoffeeBeans(tx);
  const notes = await listBrewingNotes(tx);
  const grinders = await listGrinders(tx);
  const fingerprint = await recordVersion({
    beans,
    notes,
    grinders,
    roasters: settings.roasterConfigs ?? [],
    fromName,
    toName,
  });
  const transformed = transformRoasterRenameRecords({
    beans,
    notes,
    grinders,
    settings,
    renames: new Map([[fromName, toName]]),
    now: Date.now(),
  });
  const impact = {
    beans: transformed.updatedBeans.length,
    notes: transformed.updatedNotes.length,
    grinders: transformed.updatedGrinderCount,
    configurations: transformed.updatedConfigCount,
  };
  if (!Object.values(impact).some(Boolean))
    throw new McpToolError('NOT_FOUND', 'No matching roaster references');
  return {
    beans,
    notes,
    grinders,
    fingerprint,
    fromName,
    toName,
    transformed,
    impact,
  };
}
async function previewRename(
  tx: SqliteExecutor,
  settings: AppSettings,
  args: Args
): Promise<Args> {
  const input = await renameInput(tx, settings, args);
  const confirmationToken = await recordVersion({
    nonce: nanoid(),
    fingerprint: input.fingerprint,
  });
  if (renamePreviews.size >= 500)
    renamePreviews.delete(renamePreviews.keys().next().value!);
  renamePreviews.set(confirmationToken, {
    fingerprint: input.fingerprint,
    fromName: input.fromName,
    toName: input.toName,
    expires: Date.now() + 300000,
    generation: localHistoryGeneration,
  });
  return {
    version: input.fingerprint,
    confirmationToken,
    impact: input.impact,
    expiresInSeconds: 300,
  };
}
async function applyRename(
  tx: SqliteExecutor,
  settings: AppSettings,
  args: Args
): Promise<MutationWork<Args>> {
  const input = await renameInput(tx, settings, args);
  const preview = renamePreviews.get(String(args.confirmationToken));
  if (
    !preview ||
    preview.generation !== localHistoryGeneration ||
    preview.expires < Date.now() ||
    preview.fromName !== input.fromName ||
    preview.toName !== input.toName
  )
    throw new McpToolError(
      'CONFIRMATION_REQUIRED',
      'Preview this roaster rename first'
    );
  if (
    preview.fingerprint !== input.fingerprint ||
    args.expectedVersion !== input.fingerprint
  )
    throw new McpToolError(
      'CONFLICT',
      'Roaster references changed; preview again'
    );
  const changes: MutationChange[] = [];
  for (const bean of input.transformed.updatedBeans) {
    await saveCoffeeBean(tx, bean);
    changes.push({
      entity: 'bean',
      id: bean.id,
      before: input.beans.find(b => b.id === bean.id)!,
      after: bean,
    });
  }
  for (const note of input.transformed.updatedNotes) {
    await saveBrewingNote(tx, note);
    changes.push({
      entity: 'brew_note',
      id: note.id,
      before: input.notes.find(n => n.id === note.id)!,
      after: note,
    });
  }
  for (const grinder of input.transformed.grinders) {
    const previous = input.grinders.find(g => g.id === grinder.id)!;
    if ((await recordVersion(previous)) !== (await recordVersion(grinder))) {
      await upsertGrinders(tx, [grinder]);
      changes.push({
        entity: 'grinder',
        id: grinder.id,
        before: previous,
        after: grinder,
      });
    }
  }
  if (input.transformed.updatedConfigCount) {
    await saveAppSettings(tx, input.transformed.settings);
    changes.push({
      entity: 'settings',
      id: 'main',
      before: roasters(settings),
      after: roasters(input.transformed.settings),
    });
  }
  return {
    result: { renamed: true, impact: input.impact },
    changes,
    summary: 'Renamed roaster and all related records',
  };
}
