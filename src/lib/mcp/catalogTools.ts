import {
  getPourTypeOptions,
  isPourTypeAvailable,
} from '@/lib/utils/equipmentUtils';
import { MCP_SVG_MAX_BYTES, normalizeEquipmentSvgFields } from './svgAssets';
import {
  buildNoteReferenceCatalog,
  builtinNoteMethodId,
} from '@/lib/notes/catalogReferences';
import { getCommonMethodBaseEquipmentId } from '@/lib/brewing/methodAvailability';
/** Catalog operations use the caller's transaction; never call a Store while it is held. */
import { nanoid } from 'nanoid';
import {
  equipmentList,
  brewingMethods,
  getAnimationTypeFromEquipmentId,
  type CustomEquipment,
  type Method,
  type MethodParams,
} from '@/lib/core/config';
import type { CustomMethodRecord } from '@/lib/data/contracts';
import type { AppSettings, Grinder } from '@/lib/data/models';
import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import {
  decodeCustomEquipment,
  encodeCustomEquipment,
  decodeCustomMethods,
  encodeCustomMethods,
  decodeGrinder,
  encodeGrinder,
} from '@/lib/data/sqlite/codecs';
import type {
  CustomEquipmentRow,
  CustomMethodsRow,
  GrinderRow,
} from '@/lib/data/sqlite/schemaV1';
import {
  canTransferMethod,
  transferMethodToEquipment,
} from '@/lib/brewing/methodTransfer';
import {
  autoMigrateStages,
  isLegacyFormat,
} from '@/lib/brewing/stageMigration';
import {
  getAppSettings,
  saveAppSettings,
} from '@/lib/data/sqlite/repositories/appSettings';
import { defaultSettings } from '@/lib/stores/settingsStore';
import { getCommonMethodsForEquipment } from '@/lib/brewing/methodAvailability';
import { listBrewingNotes } from '@/lib/data/sqlite/repositories/brewingNote';
import { invalid, McpToolError, recordVersion, validate } from './validation';
import {
  getMcpDriver,
  localHistoryGeneration,
  type MutationChange,
  type MutationWork,
} from './storage';
import type { Schema } from './toolDefinitions';

type Args = Record<string, unknown>;
type Kind = 'equipment' | 'method' | 'grinder';
type RecordData = CustomEquipment | Method | Grinder;
const text = (maxLength = 300, minLength = 0): Schema => ({
  type: 'string',
  maxLength,
  minLength,
});
const obj = (
  properties: Record<string, Schema>,
  required: string[] = []
): Schema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const num = (maximum = 1_000_000): Schema => ({
  type: 'number',
  minimum: 0,
  maximum,
});
const id = text(128, 1),
  version = text(64, 64),
  requestId = text(128, 8);
const page = {
  offset: { type: 'integer', minimum: 0, maximum: 1_000_000 } as Schema,
  limit: { type: 'integer', minimum: 1, maximum: 100 } as Schema,
  query: text(300),
};
const stageSchema = obj(
  {
    label: text(300, 1),
    detail: text(2000),
    pourType: text(128),
    water: text(40),
    duration: num(86400),
    valveStatus: { type: 'string', enum: ['open', 'closed'] },
  },
  ['label', 'detail']
);
export { stageSchema as mcpStageSchema };
const paramsSchema = obj(
  {
    coffee: text(40, 1),
    water: text(40, 1),
    ratio: text(40, 1),
    grindSize: text(300),
    temp: text(40),
    extractionTime: num(86400),
    liquidWeight: text(40),
    stages: {
      type: 'array',
      items: { ...stageSchema, required: ['label', 'detail', 'pourType'] },
      maxItems: 100,
    },
  },
  ['coffee', 'water', 'ratio', 'grindSize', 'temp', 'stages']
);
const svgSchema: Schema = {
  ...text(MCP_SVG_MAX_BYTES),
  description:
    'Only for animationType custom (empty string may clear old data). Editable monochrome DrawingCanvas SVG, up to 256 KiB. Root svg needs viewBox="0 0 width height" (normally 300 300). Only direct path children; each path requires one absolute M followed by absolute L commands (optional Z), stroke="var(--custom-shape-color)", positive numeric stroke-width and fill="none". Approximate curves with polylines. No colors, fills, groups, transforms, gradients, style or SMIL. Empty string clears. Animations use static frames.',
};
const equipmentFields = {
  customShapeSvg: svgSchema,
  customValveSvg: svgSchema,
  customValveOpenSvg: svgSchema,
  customPourAnimations: {
    description:
      'Only for animationType custom. Preset types use fixed system pour animations; use an empty array to clear old overrides.',
    type: 'array',
    maxItems: 100,
    items: obj(
      {
        id,
        name: text(300, 1),
        customAnimationSvg: svgSchema,
        isSystemDefault: { type: 'boolean' },
        pourType: {
          type: 'string',
          enum: ['center', 'circle', 'ice', 'bypass'],
        },
        previewFrames: { type: 'integer', minimum: 0, maximum: 100 },
        frames: {
          type: 'array',
          maxItems: 100,
          items: obj({ id, svgData: svgSchema }, ['id', 'svgData']),
        },
      },
      ['id', 'name', 'customAnimationSvg']
    ),
  } as Schema,
  name: text(300, 1),
  note: text(2000),
  animationType: {
    type: 'string',
    enum: ['v60', 'kalita', 'origami', 'orea', 'clever', 'custom', 'espresso'],
  } as Schema,
  hasValve: { type: 'boolean' } as Schema,
  defaultEnabled: { type: 'boolean' } as Schema,
};
const methodFields = { name: text(300, 1), params: paramsSchema };
const grinderFields = { name: text(300, 1), currentGrindSize: text(300) };
const fieldSchemas = {
  equipment: equipmentFields,
  method: methodFields,
  grinder: grinderFields,
};
export interface CatalogDefinition {
  name: string;
  description: string;
  schema: Schema;
  write?: boolean;
  destructive?: boolean;
}
export const catalogDefinitions: CatalogDefinition[] = (
  ['equipment', 'method', 'grinder'] as const
).flatMap(kind => {
  const identity: Record<string, Schema> =
    kind === 'method' ? { id, equipmentId: id } : { id };
  const requiredIdentity = Object.keys(identity);
  const field = kind;
  return [
    {
      name: `list_${kind}`,
      description: `List ${kind} records with versions. Built-in equipment/methods are read-only. Equipment includes availablePourTypes, resolved by the same rules as the method editor. Paginated; no file or credential access.`,
      schema: obj({
        ...page,
        ...(kind === 'method' ? { equipmentId: id } : {}),
      }),
    },
    {
      name: `get_${kind}`,
      description: `Read one ${kind} and its current version. Equipment includes availablePourTypes for method stages.`,
      schema: obj(identity, requiredIdentity),
    },
    {
      name: `create_${kind}`,
      description:
        kind === 'equipment'
          ? 'Create custom equipment only; does not create recipe stages or pour types. For animationType custom, define customPourAnimations before creating a method that uses them; built-in center/circle/ice/bypass are unavailable. Built-in animationTypes use fixed shapes and system pour types; do not attach custom SVG or customPourAnimations to them. To draw a new brewer, use animationType custom and define its own pour animations. Drawings must follow the monochrome DrawingCanvas SVG contract.'
          : kind === 'method'
            ? 'Create a custom recipe with explicitly supplied stages and per-stage duration/water, never legacy cumulative times. Read get_equipment first. Each pourType must be an availablePourTypes value returned for that equipment; never invent IDs or use system pour types on custom equipment. Recipe stages do not define equipment pour animations.'
            : 'Create a custom grinder. Scale records the latest ten distinct values.',
      write: true,
      schema: obj(
        {
          requestId,
          ...(kind === 'method' ? { equipmentId: id } : {}),
          [field]: obj(
            fieldSchemas[kind],
            kind === 'method'
              ? ['name', 'params']
              : kind === 'equipment'
                ? ['name', 'animationType']
                : ['name']
          ),
        },
        ['requestId', field, ...(kind === 'method' ? ['equipmentId'] : [])]
      ),
    },
    {
      name: `update_${kind}`,
      description: `Update custom ${kind} with optimistic version guard. Historical note snapshots are preserved. Only animationType custom accepts custom SVG or customPourAnimations; preset types have fixed shapes and system pour types. When switching to a preset, explicitly clear custom assets. Equipment SVG follows the monochrome DrawingCanvas contract. Method stages must use the equipment's availablePourTypes; equipment edits cannot invalidate existing method stages.`,
      write: true,
      schema: obj(
        {
          ...identity,
          requestId,
          expectedVersion: version,
          changes: { ...obj(fieldSchemas[kind]), minProperties: 1 },
        },
        [...requiredIdentity, 'requestId', 'expectedVersion', 'changes']
      ),
    },
    {
      name: `preview_delete_${kind}`,
      description: `Preview deletion and obtain a short-lived confirmationToken. Equipment deletion also removes its custom methods, matching the app. Historical notes are preserved.`,
      schema: obj(identity, requiredIdentity),
    },
    {
      name: `delete_${kind}`,
      description: `Delete custom ${kind} using an unchanged preview. Never deletes historical notes.`,
      write: true,
      destructive: true,
      schema: obj(
        {
          ...identity,
          requestId,
          expectedVersion: version,
          confirmationToken: text(128, 1),
        },
        [
          ...requiredIdentity,
          'requestId',
          'expectedVersion',
          'confirmationToken',
        ]
      ),
    },
  ];
});
catalogDefinitions.push(
  {
    name: 'reorder_method',
    description:
      'Reorder all custom methods for one equipment using an exact ID permutation and the collectionVersion returned by list_method. Builtins are unaffected.',
    write: true,
    schema: obj(
      {
        requestId,
        equipmentId: id,
        expectedVersion: version,
        ids: { type: 'array', items: id, maxItems: 1000 },
      },
      ['requestId', 'equipmentId', 'expectedVersion', 'ids']
    ),
  },
  {
    name: 'copy_method',
    description:
      'Copy a method to another equipment with the original app pour-type and valve adaptation. Espresso and pour-over methods cannot cross categories. Source is unchanged.',
    write: true,
    schema: obj(
      {
        requestId,
        id,
        equipmentId: id,
        expectedVersion: version,
        targetEquipmentId: id,
      },
      ['requestId', 'id', 'equipmentId', 'expectedVersion', 'targetEquipmentId']
    ),
  },
  {
    name: 'set_method_override',
    description:
      'Set or reset the app temporary brewing parameter override without editing the original method, including builtin methods. Supply expectedOverrideVersion from get_method.',
    write: true,
    schema: obj(
      {
        requestId,
        id,
        equipmentId: id,
        expectedVersion: version,
        expectedOverrideVersion: version,
        reset: { type: 'boolean' },
        params: {
          ...obj({
            coffee: text(40, 1),
            water: text(40, 1),
            ratio: text(40, 1),
            grindSize: text(300),
            temp: text(40),
            extractionTime: num(86400),
          }),
          minProperties: 1,
        },
      },
      [
        'requestId',
        'id',
        'equipmentId',
        'expectedVersion',
        'expectedOverrideVersion',
      ]
    ),
  }
);
catalogDefinitions.push(
  {
    name: 'get_catalog_preferences',
    description:
      'Read catalog visibility, builtin display-name overrides and equipment display order with a scoped version. No credentials or unrelated settings.',
    schema: obj({}),
  },
  {
    name: 'update_catalog_preferences',
    description:
      'Update catalog presentation. equipmentOrder is a unique ordered list of known equipment IDs. Per-equipment hidden/unhidden follows app enable/order semantics; hiddenMethodIds are builtin MCP method IDs. displayName overrides builtin names (empty resets). Drawings are managed through create_equipment/update_equipment using monochrome DrawingCanvas SVG.',
    write: true,
    schema: obj(
      {
        requestId,
        expectedVersion: version,
        equipmentId: id,
        hidden: { type: 'boolean' },
        displayName: text(300),
        hiddenMethodIds: { type: 'array', items: id, maxItems: 1000 },
        equipmentOrder: { type: 'array', items: id, maxItems: 1000 },
      },
      ['requestId', 'expectedVersion']
    ),
  }
);
export const handlesCatalogTool = (name: string): boolean =>
  catalogDefinitions.some(tool => tool.name === name);
function kindOf(name: string): Kind {
  return name === 'set_method_override'
    ? 'method'
    : (name.split('_').at(-1) as Kind);
}
function checkArgs(name: string, args: Args) {
  const def = catalogDefinitions.find(tool => tool.name === name);
  if (!def) throw new McpToolError('UNKNOWN_TOOL', name);
  validate(args, def.schema);
}
async function equipments(tx: SqliteExecutor): Promise<CustomEquipment[]> {
  return (
    await tx.query(
      'SELECT id, record_json FROM custom_equipments ORDER BY id ASC'
    )
  ).map(row => decodeCustomEquipment(row as unknown as CustomEquipmentRow));
}
async function methods(tx: SqliteExecutor): Promise<CustomMethodRecord[]> {
  return (
    await tx.query(
      'SELECT equipment_id, methods_json, extra_json FROM custom_methods ORDER BY equipment_id ASC'
    )
  ).map(row => decodeCustomMethods(row as unknown as CustomMethodsRow));
}
async function grinders(tx: SqliteExecutor): Promise<Grinder[]> {
  return (
    await tx.query('SELECT id, record_json FROM grinders ORDER BY id ASC')
  ).map(row => decodeGrinder(row as unknown as GrinderRow));
}
export async function loadNoteReferenceCatalog(tx: SqliteExecutor) {
  const stored = await getAppSettings(tx);
  return buildNoteReferenceCatalog(
    await equipments(tx),
    await methods(tx),
    stored?.equipmentNameOverrides
  );
}
const builtinMethodId = (equipmentId: string, index: number) =>
  `builtin:${equipmentId}:${index}`;
async function catalogRows(
  tx: SqliteExecutor,
  kind: Kind
): Promise<
  Array<{
    record: RecordData | (typeof equipmentList)[number];
    builtin: boolean;
    equipmentId?: string;
  }>
> {
  if (kind === 'equipment')
    return [
      ...equipmentList.map(record => ({ record, builtin: true })),
      ...(await equipments(tx)).map(record => ({ record, builtin: false })),
    ];
  if (kind === 'grinder')
    return (await grinders(tx)).map(record => ({ record, builtin: false }));
  const customEquipment = await equipments(tx);
  const availableBuiltins = {
    ...brewingMethods,
    ...Object.fromEntries(
      customEquipment.map(equipment => [
        equipment.id,
        getCommonMethodsForEquipment(equipment.id, customEquipment),
      ])
    ),
  };
  return [
    ...Object.entries(availableBuiltins).flatMap(([equipmentId, records]) =>
      records.map((record, index) => ({
        record: { ...record, id: builtinMethodId(equipmentId, index) },
        builtin: true,
        equipmentId,
      }))
    ),
    ...(await methods(tx)).flatMap(row =>
      row.methods.map((record, index) => ({
        record: { ...record, id: record.id || `legacy:${index}` },
        builtin: false,
        equipmentId: row.equipmentId,
      }))
    ),
  ];
}
async function view(
  row: Awaited<ReturnType<typeof catalogRows>>[number]
): Promise<Args> {
  return {
    ...row.record,
    ...(row.equipmentId ? { equipmentId: row.equipmentId } : {}),
    ...(!row.equipmentId && ('animationType' in row.record || row.builtin)
      ? {
          availablePourTypes: getPourTypeOptions(
            equipmentForTransfer(row.record)
          ),
        }
      : {}),
    readOnly: row.builtin,
    version: await recordVersion(row.record),
  };
}
async function requireRow(
  tx: SqliteExecutor,
  kind: Kind,
  args: Args,
  mutable = false
) {
  const row = (await catalogRows(tx, kind)).find(
    row =>
      row.record.id === args.id &&
      (kind !== 'method' || row.equipmentId === args.equipmentId)
  );
  if (!row) throw new McpToolError('NOT_FOUND', `${kind} not found`);
  if (mutable && row.builtin)
    throw new McpToolError(
      'READ_ONLY',
      'Built-in catalog records cannot be changed; create a custom record instead.'
    );
  return row;
}
async function requireEquipment(tx: SqliteExecutor, equipmentId: string) {
  const row = await requireRow(tx, 'equipment', { id: equipmentId });
  return equipmentForTransfer(row.record);
}
async function assertVersion(record: unknown, expected: unknown) {
  if ((await recordVersion(record)) !== expected)
    throw new McpToolError(
      'CONFLICT',
      'Record changed; read it again before editing.'
    );
}
async function saveEquipment(tx: SqliteExecutor, record: CustomEquipment) {
  const row = encodeCustomEquipment(record);
  await tx.execute(
    'INSERT INTO custom_equipments (id, record_json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json',
    [row.id, row.record_json]
  );
}
async function saveMethods(tx: SqliteExecutor, record: CustomMethodRecord) {
  const row = encodeCustomMethods(record);
  await tx.execute(
    'INSERT INTO custom_methods (equipment_id, methods_json, extra_json) VALUES (?, ?, ?) ON CONFLICT(equipment_id) DO UPDATE SET methods_json = excluded.methods_json, extra_json = excluded.extra_json',
    [row.equipment_id, row.methods_json, row.extra_json]
  );
}
async function saveGrinder(tx: SqliteExecutor, record: Grinder) {
  const row = encodeGrinder(record);
  await tx.execute(
    'INSERT INTO grinders (id, record_json) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json',
    [row.id, row.record_json]
  );
}
function validateMethod(method: Method, equipment: CustomEquipment) {
  const amount = (value: string) => Number(value.replace(/\s*g$/i, '').trim());
  if (
    !Number.isFinite(amount(method.params.coffee)) ||
    amount(method.params.coffee) <= 0
  )
    invalid('Coffee amount must be positive grams.');
  if (
    !Number.isFinite(amount(method.params.water)) ||
    amount(method.params.water) < 0
  )
    invalid('Water amount must be nonnegative grams.');
  for (const stage of method.params.stages) {
    if (!isPourTypeAvailable(equipment, stage.pourType))
      invalid(
        `Unavailable pourType ${JSON.stringify(stage.pourType)}. Read get_equipment.availablePourTypes; define custom pour animations before using their IDs.`
      );
    if (stage.valveStatus !== undefined && !equipment.hasValve)
      invalid('Valve status is only supported by equipment with a valve.');
    if (
      stage.water !== undefined &&
      (!Number.isFinite(amount(stage.water)) || amount(stage.water) < 0)
    )
      invalid('Stage water must be nonnegative grams.');
    if (
      !['bypass', 'beverage'].includes(stage.pourType || '') &&
      stage.duration === undefined
    )
      invalid('Stage duration is required except for bypass/beverage.');
  }
}
const previews = new Map<
  string,
  { key: string; fingerprint: string; expiresAt: number; generation: number }
>();
async function impact(tx: SqliteExecutor, kind: Kind, args: Args) {
  const row = await requireRow(tx, kind, args, true);
  const child =
    kind === 'equipment'
      ? (await methods(tx)).find(m => m.equipmentId === args.id)
      : undefined;
  const notes = await listBrewingNotes(tx);
  const references = notes
    .filter(note =>
      kind === 'equipment'
        ? note.equipment === row.record.name || note.equipment === row.record.id
        : kind === 'method'
          ? note.method === row.record.name
          : (note.params?.grindSize || '').startsWith(`${row.record.name} `)
    )
    .map(note => note.id)
    .sort();
  return {
    row,
    child,
    references,
    fingerprint: await recordVersion({ record: row.record, child, references }),
  };
}
function catalogPreferences(settings?: AppSettings) {
  return {
    hiddenEquipments: settings?.hiddenEquipments || [],
    hiddenCommonMethods: settings?.hiddenCommonMethods || {},
    equipmentOrder: settings?.equipmentOrder || [],
    equipmentNameOverrides: settings?.equipmentNameOverrides || {},
  };
}
async function updateCatalogPreferences(
  tx: SqliteExecutor,
  args: Args
): Promise<MutationWork<Args>> {
  const stored = await getAppSettings(tx);
  const before = catalogPreferences(stored);
  await assertVersion(before, args.expectedVersion);
  const after = structuredClone(before);
  const hasLocal = ['hidden', 'displayName', 'hiddenMethodIds'].some(
    key => args[key] !== undefined
  );
  if (!hasLocal && args.equipmentOrder === undefined)
    invalid('Provide at least one catalog preference.');
  if (hasLocal && !args.equipmentId)
    invalid('equipmentId is required for equipment-local preferences.');
  if (args.equipmentOrder !== undefined) {
    const order = args.equipmentOrder as string[];
    if (new Set(order).size !== order.length)
      invalid('Equipment order must contain unique IDs.');
    for (const id of order) await requireEquipment(tx, id);
    after.equipmentOrder = order;
  }
  if (hasLocal) {
    const equipmentId = String(args.equipmentId);
    const row = await requireRow(tx, 'equipment', { id: equipmentId });
    if (args.hidden !== undefined) {
      after.hiddenEquipments = after.hiddenEquipments.filter(
        id => id !== equipmentId
      );
      if (args.hidden) after.hiddenEquipments.push(equipmentId);
      else if (!after.equipmentOrder.includes(equipmentId))
        after.equipmentOrder.push(equipmentId);
    }
    if (args.displayName !== undefined) {
      if (!row.builtin)
        invalid('Use update_equipment to rename custom equipment.');
      const name = String(args.displayName).trim();
      if (name) after.equipmentNameOverrides[equipmentId] = name;
      else delete after.equipmentNameOverrides[equipmentId];
    }
    if (args.hiddenMethodIds !== undefined) {
      const ids = args.hiddenMethodIds as string[];
      if (new Set(ids).size !== ids.length)
        invalid('Hidden method IDs must be unique.');
      const rows = (await catalogRows(tx, 'method')).filter(
        row => row.equipmentId === equipmentId
      );
      const names = ids.map(id => {
        const method = rows.find(row => row.builtin && row.record.id === id);
        if (!method)
          invalid(
            'Hidden method IDs must refer to builtin methods of this equipment.'
          );
        return String(method.record.name);
      });
      if (names.length) after.hiddenCommonMethods[equipmentId] = names;
      else delete after.hiddenCommonMethods[equipmentId];
    }
  }
  await saveAppSettings(tx, { ...(stored || defaultSettings), ...after });
  return {
    result: { preferences: after, version: await recordVersion(after) },
    changes: [{ entity: 'settings', id: 'main', before, after }],
    summary: '调整器具与方案显示设置',
  };
}
function overrideKey(
  row: Awaited<ReturnType<typeof catalogRows>>[number]
): string {
  return `${row.equipmentId}:${row.builtin || String(row.record.id).startsWith('legacy:') ? row.record.name : row.record.id}`;
}
async function displayView(
  tx: SqliteExecutor,
  row: Awaited<ReturnType<typeof catalogRows>>[number]
): Promise<Args> {
  const result = await view(row);
  const settings = await getAppSettings(tx);
  if (!row.equipmentId)
    return 'animationType' in row.record || row.builtin
      ? {
          ...result,
          displayName: row.builtin
            ? settings?.equipmentNameOverrides?.[String(row.record.id)] ||
              row.record.name
            : row.record.name,
          hidden:
            (settings?.hiddenEquipments || []).includes(
              String(row.record.id)
            ) ||
            (row.builtin &&
              'defaultEnabled' in row.record &&
              row.record.defaultEnabled === false &&
              !(settings?.equipmentOrder || []).includes(
                String(row.record.id)
              )),
        }
      : result;
  const override = settings?.methodParamOverrides?.[overrideKey(row)] || null;
  const method = row.record as Method;
  const stages = isLegacyFormat(method.params.stages)
    ? autoMigrateStages(method.params.stages)
    : method.params.stages;
  const params = { ...method.params, stages };
  const values = override
    ? Object.fromEntries(
        Object.entries(override).filter(([key]) => key !== 'modifiedAt')
      )
    : {};
  return {
    ...result,
    referenceId: row.builtin
      ? builtinNoteMethodId(
          getCommonMethodBaseEquipmentId(row.equipmentId, await equipments(tx)),
          method.name
        )
      : method.id && !method.id.startsWith('legacy:')
        ? method.id
        : null,
    params,
    effectiveParams: { ...params, ...values },
    hidden:
      row.builtin &&
      (settings?.hiddenCommonMethods?.[row.equipmentId] || []).includes(
        String(row.record.name)
      ),
    parameterOverride: override,
    overrideVersion: await recordVersion(override),
  };
}
export async function loadNoteMethodPreset(
  tx: SqliteExecutor,
  equipmentId: string,
  methodId: string
): Promise<{ params: MethodParams; isEspresso: boolean }> {
  const candidates: MethodParams[] = [];
  for (const row of await catalogRows(tx, 'method')) {
    if (row.equipmentId !== equipmentId) continue;
    const result = await displayView(tx, row);
    if (result.referenceId === methodId || row.record.id === methodId)
      candidates.push(result.effectiveParams as MethodParams);
  }
  if (candidates.length !== 1)
    invalid(
      'Select a unique recipe for this equipment before applying its preset.'
    );
  return {
    params: candidates[0],
    isEspresso:
      getCommonMethodBaseEquipmentId(equipmentId, await equipments(tx)) ===
      'Espresso',
  };
}

function equipmentForTransfer(
  record: Awaited<ReturnType<typeof catalogRows>>[number]['record']
): CustomEquipment {
  return 'animationType' in record
    ? (record as CustomEquipment)
    : {
        ...record,
        id: record.id!,
        animationType: getAnimationTypeFromEquipmentId(record.id),
        isCustom: true,
        hasValve: record.id === 'CleverDripper',
      };
}
async function mutateMethodLifecycle(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<MutationWork<Args>> {
  const equipmentId = String(args.equipmentId);
  await requireEquipment(tx, equipmentId);
  const parent = (await methods(tx)).find(
    row => row.equipmentId === equipmentId
  );
  if (name === 'reorder_method') {
    await assertVersion(
      parent || { equipmentId, methods: [] },
      args.expectedVersion
    );
    const list = parent?.methods || [];
    const ids = list.map((method, index) => method.id || `legacy:${index}`);
    const order = args.ids as string[];
    if (
      order.length !== ids.length ||
      new Set(order).size !== ids.length ||
      order.some(id => !ids.includes(id))
    )
      invalid('ids must be an exact permutation of all custom method IDs.');
    const after = {
      ...parent,
      equipmentId,
      methods: order.map(id => list[ids.indexOf(id)]),
    };
    if (list.length) await saveMethods(tx, after);
    return {
      result: {
        equipmentId,
        collectionVersion: await recordVersion(after),
        ids: order,
      },
      changes: list.length
        ? [{ entity: 'method', id: equipmentId, before: parent || null, after }]
        : [],
      summary: '调整方案排序',
    };
  }
  const source = await requireRow(tx, 'method', args);
  await assertVersion(source.record, args.expectedVersion);
  if (name === 'copy_method') {
    const targetEquipmentId = String(args.targetEquipmentId);
    const sourceEquipment = await requireRow(tx, 'equipment', {
      id: equipmentId,
    });
    const targetEquipment = await requireRow(tx, 'equipment', {
      id: targetEquipmentId,
    });
    const sourceMethod = source.record as Method;
    const normalized = {
      ...sourceMethod,
      params: {
        ...sourceMethod.params,
        stages: autoMigrateStages(sourceMethod.params.stages),
      },
    };
    if (
      !canTransferMethod(
        normalized,
        equipmentForTransfer(sourceEquipment.record),
        equipmentForTransfer(targetEquipment.record)
      )
    )
      invalid(
        'Espresso and pour-over methods cannot be transferred across categories.'
      );
    const method = {
      ...transferMethodToEquipment(
        normalized,
        equipmentForTransfer(sourceEquipment.record),
        equipmentForTransfer(targetEquipment.record)
      ),
      id: `method-${Date.now()}-${nanoid(7)}`,
      timestamp: Date.now(),
    };
    validateMethod(method, equipmentForTransfer(targetEquipment.record));
    const before = (await methods(tx)).find(
      row => row.equipmentId === targetEquipmentId
    );
    const after = {
      ...before,
      equipmentId: targetEquipmentId,
      methods: [...(before?.methods || []), method],
    };
    await saveMethods(tx, after);
    return {
      result: {
        method: await displayView(tx, {
          record: method,
          equipmentId: targetEquipmentId,
          builtin: false,
        }),
      },
      changes: [
        {
          entity: 'method',
          id: targetEquipmentId,
          before: before || null,
          after,
        },
      ],
      summary: `复制方案：${method.name}`,
    };
  }
  if ((args.reset === true) === Boolean(args.params))
    invalid('Provide params to set an override, or reset:true without params.');
  const before = await getAppSettings(tx);
  const settings = before || defaultSettings;
  const key = overrideKey(source);
  await assertVersion(
    settings.methodParamOverrides?.[key] || null,
    args.expectedOverrideVersion
  );
  const overrides = { ...settings.methodParamOverrides };
  if (args.reset) delete overrides[key];
  else {
    const params = args.params as Record<string, string | number>;
    const method = source.record as Method;
    validateMethod(
      {
        ...method,
        params: {
          ...method.params,
          stages: autoMigrateStages(method.params.stages),
          ...params,
        },
      },
      await requireEquipment(tx, equipmentId)
    );
    overrides[key] = { ...params, modifiedAt: Date.now() };
  }
  const after = { ...settings, methodParamOverrides: overrides };
  await saveAppSettings(tx, after);
  return {
    result: { method: await displayView(tx, source) },
    changes: [
      {
        entity: 'settings',
        id: 'main',
        before: {
          methodParamOverrides: {
            [key]: before?.methodParamOverrides?.[key] || null,
          },
        },
        after: { methodParamOverrides: { [key]: overrides[key] || null } },
      },
    ],
    summary: args.reset ? '还原方案参数' : '调整方案参数',
  };
}
export async function readCatalogTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<Args> {
  checkArgs(name, args);
  if (name === 'get_catalog_preferences') {
    const preferences = catalogPreferences(await getAppSettings(tx));
    return { preferences, version: await recordVersion(preferences) };
  }
  const kind = kindOf(name);
  if (name.startsWith('list_')) {
    const query = String(args.query || '').toLocaleLowerCase();
    const rows = (await catalogRows(tx, kind)).filter(
      row =>
        (!args.equipmentId || row.equipmentId === args.equipmentId) &&
        (!query || row.record.name.toLocaleLowerCase().includes(query))
    );
    const offset = Number(args.offset || 0),
      limit = Number(args.limit || 50);
    return {
      items: await Promise.all(
        rows.slice(offset, offset + limit).map(row => displayView(tx, row))
      ),
      ...(kind === 'method' && args.equipmentId
        ? {
            collectionVersion: await recordVersion(
              (await methods(tx)).find(
                row => row.equipmentId === args.equipmentId
              ) || { equipmentId: args.equipmentId, methods: [] }
            ),
          }
        : {}),
      total: rows.length,
      offset,
      limit,
      hasMore: offset + limit < rows.length,
    };
  }
  if (name.startsWith('preview_delete_')) {
    const data = await impact(tx, kind, args);
    const confirmationToken = nanoid(32);
    const expiresAt = Date.now() + 300_000;
    for (const [key, preview] of previews)
      if (preview.expiresAt < Date.now()) previews.delete(key);
    if (previews.size >= 500) previews.delete(previews.keys().next().value!);
    previews.set(confirmationToken, {
      key: `${kind}:${args.equipmentId || ''}:${args.id}`,
      fingerprint: data.fingerprint,
      expiresAt,
      generation: localHistoryGeneration,
    });
    return {
      id: args.id,
      version: await recordVersion(data.row.record),
      confirmationToken,
      expiresAt,
      impact: {
        deletedCustomMethodCount: data.child?.methods.length || 0,
        preservedHistoricalNoteCount: data.references.length,
      },
    };
  }
  return { [kind]: await displayView(tx, await requireRow(tx, kind, args)) };
}
export async function mutateCatalogTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<MutationWork<Args>> {
  checkArgs(name, args);
  if (name === 'update_catalog_preferences')
    return updateCatalogPreferences(tx, args);
  if (['reorder_method', 'copy_method', 'set_method_override'].includes(name))
    return mutateMethodLifecycle(tx, name, args);
  const kind = kindOf(name);
  const creating = name.startsWith('create_');
  const deleting = name.startsWith('delete_');
  if (!creating && !deleting && !name.startsWith('update_'))
    invalid('Not a catalog mutation.');
  const old = creating ? undefined : await requireRow(tx, kind, args, true);
  if (old) await assertVersion(old.record, args.expectedVersion);
  const changes: MutationChange[] = [];
  const stamp = Math.max(
    Date.now(),
    Number(old && 'timestamp' in old.record ? old.record.timestamp || 0 : 0) + 1
  );
  const equipmentId = String(args.equipmentId || '');
  const methodEquipment =
    kind === 'method' ? await requireEquipment(tx, equipmentId) : undefined;
  const parent =
    kind === 'method'
      ? (await methods(tx)).find(row => row.equipmentId === equipmentId)
      : undefined;
  if (deleting) {
    const data = await impact(tx, kind, args);
    const token = previews.get(String(args.confirmationToken));
    if (
      !token ||
      token.expiresAt < Date.now() ||
      token.generation !== localHistoryGeneration ||
      token.key !== `${kind}:${equipmentId}:${args.id}` ||
      token.fingerprint !== data.fingerprint
    )
      throw new McpToolError(
        'CONFIRMATION_REQUIRED',
        'Deletion preview expired or changed; preview again.'
      );
    if (kind === 'equipment') {
      if (data.child) {
        await tx.execute('DELETE FROM custom_methods WHERE equipment_id = ?', [
          String(args.id),
        ]);
        changes.push({
          entity: 'method',
          id: String(args.id),
          before: data.child,
          after: null,
        });
      }
      await tx.execute('DELETE FROM custom_equipments WHERE id = ?', [
        String(args.id),
      ]);
    } else if (kind === 'grinder')
      await tx.execute('DELETE FROM grinders WHERE id = ?', [String(args.id)]);
    else {
      const remaining = parent!.methods.filter(
        (method, index) => (method.id || `legacy:${index}`) !== args.id
      );
      const after = remaining.length
        ? { ...parent!, methods: remaining }
        : null;
      if (after) await saveMethods(tx, after);
      else
        await tx.execute('DELETE FROM custom_methods WHERE equipment_id = ?', [
          equipmentId,
        ]);
      changes.push({
        entity: 'method',
        id: equipmentId,
        before: parent!,
        after,
      });
    }
    if (kind !== 'method')
      changes.push({
        entity: kind,
        id: String(args.id),
        before: old!.record,
        after: null,
      });
    return {
      result: { deleted: true, id: args.id },
      changes,
      summary: `删除${kind === 'equipment' ? '器具' : kind === 'method' ? '方案' : '磨豆机'}：${old!.record.name}`,
    };
  }
  const inputFields = (creating ? args[kind] : args.changes) as Args;
  const fields =
    kind === 'equipment'
      ? (normalizeEquipmentSvgFields(inputFields) as Args)
      : inputFields;
  const generatedId =
    kind === 'equipment'
      ? `custom-${fields.animationType}-${Date.now()}-${nanoid(7)}`
      : kind === 'method'
        ? `method-${Date.now()}-${nanoid(7)}`
        : nanoid();
  const record = {
    ...(old?.record || {}),
    ...fields,
    name: String(fields.name ?? old?.record.name).trim(),
    id: creating ? generatedId : String(args.id),
  } as RecordData;
  if (kind === 'equipment') {
    const equipment = {
      ...record,
      timestamp: stamp,
      isCustom: true,
    } as CustomEquipment;
    if (
      equipment.animationType !== 'custom' &&
      (equipment.customShapeSvg?.trim() ||
        equipment.customValveSvg?.trim() ||
        equipment.customValveOpenSvg?.trim() ||
        equipment.customPourAnimations?.length)
    ) {
      invalid(
        'Preset equipment types use fixed shapes and system pour animations. Custom SVG and customPourAnimations require animationType="custom". When changing types, explicitly clear incompatible assets and update method stages first.'
      );
    }
    if (
      !creating &&
      ['customPourAnimations', 'animationType', 'hasValve'].some(key =>
        Object.hasOwn(fields, key)
      )
    ) {
      const childMethods =
        (await methods(tx)).find(row => row.equipmentId === equipment.id)
          ?.methods || [];
      for (const method of childMethods) {
        validateMethod(
          {
            ...method,
            params: {
              ...method.params,
              stages: autoMigrateStages(method.params.stages),
            },
          },
          equipment
        );
      }
    }
    await saveEquipment(tx, equipment);
    changes.push({
      entity: kind,
      id: equipment.id,
      before: old?.record || null,
      after: equipment,
    });
    return {
      result: { equipment: await view({ record: equipment, builtin: false }) },
      changes,
      summary: `${creating ? '新增' : '修改'}器具：${equipment.name}`,
    };
  }
  if (kind === 'method') {
    const method = {
      ...record,
      ...(String(record.id).startsWith('legacy:')
        ? { id: `method-${Date.now()}-${nanoid(7)}` }
        : {}),
      timestamp: stamp,
    } as Method;
    method.params = {
      ...method.params,
      stages: autoMigrateStages(method.params.stages),
    };
    validateMethod(method, methodEquipment!);
    const next = creating
      ? [...(parent?.methods || []), method]
      : parent!.methods.map((item, index) =>
          (item.id || `legacy:${index}`) === args.id ? method : item
        );
    const after = { ...parent, equipmentId, methods: next };
    await saveMethods(tx, after);
    changes.push({
      entity: 'method',
      id: equipmentId,
      before: parent || null,
      after,
    });
    return {
      result: {
        method: await view({ record: method, equipmentId, builtin: false }),
      },
      changes,
      summary: `${creating ? '新增' : '修改'}方案：${method.name}`,
    };
  }
  const grinder = record as Grinder;
  if (Object.prototype.hasOwnProperty.call(fields, 'currentGrindSize')) {
    grinder.currentGrindSize = String(fields.currentGrindSize).trim();
    if (grinder.currentGrindSize)
      grinder.grindSizeHistory = [
        { grindSize: grinder.currentGrindSize, timestamp: stamp },
        ...(grinder.grindSizeHistory || []).filter(
          item => item.grindSize !== grinder.currentGrindSize
        ),
      ].slice(0, 10);
  }
  await saveGrinder(tx, grinder);
  changes.push({
    entity: 'grinder',
    id: grinder.id,
    before: old?.record || null,
    after: grinder,
  });
  return {
    result: { grinder: await view({ record: grinder, builtin: false }) },
    changes,
    summary: `${creating ? '新增' : '修改'}磨豆机：${grinder.name}`,
  };
}

export async function publishCatalogChanges(
  changes: MutationChange[]
): Promise<void> {
  if (typeof window === 'undefined') return;
  const driver = await getMcpDriver();
  const [currentEquipment, currentMethods, currentGrinders] = await Promise.all(
    [equipments(driver), methods(driver), grinders(driver)]
  );
  if (changes.some(change => change.entity === 'equipment')) {
    const { useCustomEquipmentStore } =
      await import('@/lib/stores/customEquipmentStore');
    useCustomEquipmentStore.setState({
      equipments: currentEquipment,
      initialized: true,
    });
  }
  if (changes.some(change => change.entity === 'method')) {
    const { useCustomMethodStore } =
      await import('@/lib/stores/customMethodStore');
    useCustomMethodStore.setState({
      methodsByEquipment: Object.fromEntries(
        currentMethods.map(record => [record.equipmentId, record.methods])
      ),
      initialized: true,
    });
  }
  if (changes.some(change => change.entity === 'grinder')) {
    const { useGrinderStore } = await import('@/lib/stores/grinderStore');
    useGrinderStore.setState({ grinders: currentGrinders, initialized: true });
  }
  for (const change of changes) {
    if (change.entity === 'equipment') {
      const equipment = currentEquipment.find(item => item.id === change.id);
      window.dispatchEvent(
        new CustomEvent('customEquipmentDataChanged', {
          detail: {
            action: equipment ? 'update' : 'delete',
            equipmentId: change.id,
            equipment,
            source: 'local',
          },
        })
      );
    }
    if (change.entity === 'method') {
      const record = currentMethods.find(
        item => item.equipmentId === change.id
      );
      window.dispatchEvent(
        new CustomEvent('customMethodDataChanged', {
          detail: {
            action: record ? 'update' : 'delete',
            equipmentId: change.id,
            methods: record?.methods || [],
            source: 'local',
          },
        })
      );
      window.dispatchEvent(
        new CustomEvent('customMethodsChanged', {
          detail: { equipmentId: change.id },
        })
      );
    }
    if (change.entity === 'grinder')
      window.dispatchEvent(
        new CustomEvent('grinderDataChanged', { detail: { source: 'local' } })
      );
  }
}
