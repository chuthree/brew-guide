/** Stable optional catalog identity alongside immutable, human-readable note snapshots. */
import {
  equipmentList,
  type BrewingNote,
  type CustomEquipment,
} from '@/lib/core/config';
import type { CustomMethodRecord } from '@/lib/data/contracts';
import {
  getCommonMethodsForEquipment,
  getCommonMethodBaseEquipmentId,
} from '@/lib/brewing/methodAvailability';

export type NoteCatalogSelection = Pick<
  BrewingNote,
  | 'equipment'
  | 'method'
  | 'equipmentId'
  | 'methodId'
  | 'equipmentName'
  | 'methodName'
>;
export interface NoteReferenceEntry {
  id: string | null;
  name: string;
  aliases?: string[];
  idAliases?: string[];
}
export interface NoteReferenceCatalog {
  equipment: NoteReferenceEntry[];
  methods: Array<NoteReferenceEntry & { equipmentId: string }>;
}
export class NoteReferenceError extends Error {}

// Permanent recipe keys, independent of array position and editable display labels.
// Keep these values when changing a preset's title; update the corresponding lookup key.
const PRESET_KEYS: Record<string, Record<string, string>> = {
  V60: {
    一刀流: 'single-pour',
    三段式: 'three-stage',
    '粕谷哲4:6法': 'kasuya-46',
    队长无差别冲煮法: 'captain',
    温水细粉慢冲LtFS: 'ltfs',
    '张师傅1:2:3冲煮法': 'zhang-123',
    冰手冲: 'iced',
    夏季八冲: 'summer-eight',
  },
  CleverDripper: { 简单冲煮方案: 'simple', 夏季八冲: 'summer-eight' },
  Kalita: {
    三段式: 'three-stage',
    温水细粉慢冲LtFS: 'ltfs',
    队长无差别冲煮法: 'captain',
    夏季八冲: 'summer-eight',
  },
  Origami: {
    三段式: 'three-stage',
    温水细粉慢冲LtFS: 'ltfs',
    队长无差别冲煮法: 'captain',
    夏季八冲: 'summer-eight',
  },
  Orea: {
    杜嘉宁十克萃: 'du-ten',
    十二克四段式: 'twelve-four',
    十五克四段式: 'fifteen-four',
    十六克五段式: 'sixteen-five',
    夏季八冲: 'summer-eight',
  },
  Espresso: { 浓缩: 'espresso', 美式: 'americano', 拿铁: 'latte' },
};
export function builtinNoteMethodId(
  baseEquipmentId: string,
  name: string
): string | null {
  const key = PRESET_KEYS[baseEquipmentId]?.[name];
  return key ? `preset:${baseEquipmentId}:${key}` : null;
}
const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';
const normalized = (value: string): string =>
  value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const stableCustomId = (id?: string): string | null =>
  id && !id.startsWith('legacy:') ? id : null;

export function buildNoteReferenceCatalog(
  customEquipments: CustomEquipment[],
  customMethodRecords: CustomMethodRecord[],
  equipmentNameOverrides: Record<string, string> = {}
): NoteReferenceCatalog {
  const equipment = [
    ...equipmentList.map(item => ({
      id: item.id,
      name: text(equipmentNameOverrides[item.id]) || item.name,
      aliases: [item.name],
    })),
    ...customEquipments.map(item => ({ id: item.id, name: item.name })),
  ];
  const methods: NoteReferenceCatalog['methods'] = equipment.flatMap(item => {
    const base = getCommonMethodBaseEquipmentId(item.id, customEquipments);
    return getCommonMethodsForEquipment(item.id, customEquipments).map(
      (method, index) => ({
        id: builtinNoteMethodId(base, method.name),
        name: method.name,
        equipmentId: item.id,
        idAliases: [
          `builtin:${item.id}:${index}`,
          ...(method.id ? [method.id] : []),
        ],
      })
    );
  });
  for (const row of customMethodRecords) {
    for (const method of row.methods)
      methods.push({
        id: stableCustomId(method.id),
        name: method.name,
        equipmentId: row.equipmentId,
      });
  }
  return { equipment, methods };
}

function match(
  entries: NoteReferenceEntry[],
  value: string
): NoteReferenceEntry | undefined {
  if (!value) return undefined;
  const ids = entries.filter(
    row => row.id === value || row.idAliases?.includes(value)
  );
  if (ids.length) return ids.length === 1 ? ids[0] : undefined;
  const names = entries.filter(row =>
    [row.name, ...(row.aliases ?? [])].some(
      name => normalized(name) === normalized(value)
    )
  );
  return names.length === 1 ? names[0] : undefined;
}
function explicit(
  entries: NoteReferenceEntry[],
  id: string,
  field: string
): NoteReferenceEntry {
  const rows = entries.filter(
    row => row.id === id || row.idAliases?.includes(id)
  );
  if (rows.length !== 1 || !rows[0].id)
    throw new NoteReferenceError(
      `${field} must identify one existing stable catalog entry`
    );
  return rows[0];
}
const fields = [
  'equipment',
  'method',
  'equipmentId',
  'methodId',
  'equipmentName',
  'methodName',
] as const;
function pick(value: NoteCatalogSelection): NoteCatalogSelection {
  const result: NoteCatalogSelection = {};
  for (const key of fields)
    if (Object.prototype.hasOwnProperty.call(value, key))
      Object.assign(result, { [key]: value[key] });
  return result;
}
const has = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

/** Only selection changes resolve again. Metadata edits never rewrite historical identity or labels. */
export function resolveNoteReferences(
  input: Partial<NoteCatalogSelection>,
  catalog: NoteReferenceCatalog,
  previous?: NoteCatalogSelection
): NoteCatalogSelection {
  const equipmentChanged =
    !previous ||
    (has(input, 'equipment') &&
      text(input.equipment) !== text(previous.equipment)) ||
    (input.equipmentId !== undefined &&
      has(input, 'equipmentId') &&
      input.equipmentId !== previous.equipmentId);
  const methodChanged =
    equipmentChanged ||
    !previous ||
    (has(input, 'method') && text(input.method) !== text(previous.method)) ||
    (input.methodId !== undefined &&
      has(input, 'methodId') &&
      input.methodId !== previous.methodId);
  if (!equipmentChanged && !methodChanged) return pick(previous!);
  const current = { ...previous, ...input };
  const result = previous ? pick(previous) : {};
  let equipmentId = previous?.equipmentId ?? null;
  if (equipmentChanged) {
    const explicitId =
      input.equipmentId !== undefined && has(input, 'equipmentId');
    const chosen = explicitId
      ? input.equipmentId === null
        ? undefined
        : explicit(catalog.equipment, text(input.equipmentId), 'equipmentId')
      : match(catalog.equipment, text(current.equipment));
    equipmentId = chosen?.id ?? null;
    result.equipmentId = equipmentId;
    result.equipmentName = chosen?.name ?? text(current.equipment);
    result.equipment = equipmentId ?? text(current.equipment);
  }
  if (methodChanged) {
    // Legacy equipment is resolved for a newly selected method only; untouched labels stay untouched.
    const selectedEquipment =
      equipmentId ??
      (!equipmentChanged && !has(previous ?? {}, 'equipmentId')
        ? match(catalog.equipment, text(current.equipment))?.id
        : null);
    const candidates = catalog.methods.filter(
      row => row.equipmentId === selectedEquipment
    );
    const explicitId = input.methodId !== undefined && has(input, 'methodId');
    const chosen = explicitId
      ? input.methodId === null
        ? undefined
        : explicit(candidates, text(input.methodId), 'methodId')
      : match(candidates, text(current.method));
    result.methodId = chosen?.id ?? null;
    result.methodName = chosen?.name ?? text(current.method);
    result.method = chosen?.name ?? text(current.method);
    if (
      !equipmentChanged &&
      selectedEquipment &&
      !has(previous ?? {}, 'equipmentId')
    ) {
      result.equipmentId = selectedEquipment;
      result.equipmentName =
        match(catalog.equipment, text(current.equipment))?.name ??
        text(current.equipment);
    }
  }
  return result;
}
