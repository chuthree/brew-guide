import type { BlendComponent, CoffeeBean } from '@/types/app';
import type { AppSettings } from '@/lib/data/models';
import { ROAST_LEVELS } from '@/lib/utils/roastProfileUtils';
import {
  BEAN_FIELD_DEFINITIONS,
  getComponentFieldValue,
  normalizeCoffeeBeanFieldUpdate,
  normalizeCoffeeBeanForFieldConfig,
  resolveBeanFieldConfig,
  splitBeanFieldNotes,
} from './beanFields';

type FieldSettings = Pick<AppSettings, 'beanFieldConfig' | 'showEstateField'>;
const strictNotes = { strictFieldNotes: true };
const owns = (value: object, key: PropertyKey) =>
  Object.prototype.hasOwnProperty.call(value, key);
const key = (value: string) => value.trim().normalize('NFKC').toLowerCase();

const ROAST_ALIASES: readonly (readonly string[])[] = [
  ['极浅', '极浅烘', '极浅度烘焙', 'ultra light', 'very light', 'extra light'],
  ['浅', '浅烘', '浅烘焙', '浅度', 'light'],
  ['中浅', '中浅烘', '中浅度烘焙', 'medium light', 'light medium'],
  ['中', '中烘', '中烘焙', '中度', 'medium'],
  ['中深', '中深烘', '中深度烘焙', 'medium dark', 'dark medium'],
  ['深', '深烘', '深烘焙', '深度', 'dark'],
];
const roastKey = (value: string) =>
  key(value)
    .replace(/[-_]/g, ' ')
    .replace(/\s+roast(?:ed)?$/, '')
    .replace(/\s+/g, ' ');

/** Normalize stated roast labels, never infer roast from color, type or packaging. */
export function normalizeImportedRoastLevel(value: unknown): string {
  if (typeof value !== 'string') return '';
  const normalized = roastKey(value);
  const index = ROAST_LEVELS.findIndex(
    (level, index) =>
      normalized === roastKey(level) ||
      ROAST_ALIASES[index].some(alias => normalized === roastKey(alias))
  );
  return index < 0 ? '' : ROAST_LEVELS[index];
}

const normalizeFlavors = (value: unknown): string[] => {
  if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      const decoded: unknown = JSON.parse(value);
      value =
        Array.isArray(decoded) &&
        decoded.every(item => typeof item === 'string')
          ? decoded
          : [value];
    } catch {
      value = [value];
    }
  }
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,，、;；]+/)
      : [];
  const seen = new Set<string>();
  return values
    .filter((item): item is string => typeof item === 'string')
    .flatMap(item => {
      const text = item.trim();
      const identity = key(text);
      if (!text || seen.has(identity)) return [];
      seen.add(identity);
      return [text];
    });
};

const NOTE_FIELDS = {
  名称: 'name',
  品名: 'name',
  豆名: 'name',
  烘焙商: 'roaster',
  烘焙度: 'roastLevel',
  烘焙程度: 'roastLevel',
  烘焙日期: 'roastDate',
  购买日期: 'purchaseDate',
  价格: 'price',
  风味: 'flavor',
} as const;
const NOTE_LABELS = [
  ...Object.keys(NOTE_FIELDS),
  ...BEAN_FIELD_DEFINITIONS.map(field => field.noteLabel),
  '净含量',
  '容量',
  '剩余量',
  '赏味期',
  '生豆商',
  '供应商',
  '系列',
];
const missingValue =
  /^(?:未知|未标注|未注明|未提供|未显示|未识别|不详|暂无|无法确定|unknown|n\/?a|not specified|not provided|not visible)[。.]?$/i;
const missingNote = new RegExp(
  `^(?:(?:${NOTE_LABELS.join('|')})(?:未标注|未注明|未提供|未知)|(?:未标注|未注明|未提供)(?:${NOTE_LABELS.join('|')}))[。.]?$`
);
const isMissingNote = (note: string) => {
  const value = note.replace(
    /^(?:成分\s*\d+\s*)?([^：:]+)\s*[:：]\s*/,
    (prefix, label: string) =>
      NOTE_LABELS.includes(label.trim()) ? '' : prefix
  );
  return missingValue.test(value.trim()) || missingNote.test(note);
};
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;

const unknownRoast = (input: Partial<CoffeeBean>): string | undefined => {
  const value =
    typeof input.roastLevel === 'string' ? input.roastLevel.trim() : '';
  return value &&
    !normalizeImportedRoastLevel(value) &&
    !missingValue.test(value)
    ? value
    : undefined;
};
const withUnknownRoastNote = <T extends Partial<CoffeeBean>>(
  input: T,
  raw: string | undefined
): T => {
  if (!raw) return input;
  const exists = splitBeanFieldNotes(input.notes, NOTE_LABELS).some(note => {
    const match = note.match(/^(?:烘焙度|烘焙程度)\s*[:：]\s*(.+)$/);
    return match && key(match[1]) === key(raw);
  });
  if (exists) return input;
  return {
    ...input,
    notes: [input.notes, `烘焙度：${raw}`].filter(Boolean).join(' / '),
  };
};

/** Only explicitly supplied fields are cleaned. This is also safe before stock/default calculations. */
export function normalizeImportedCoffeeBeanFields<
  T extends Partial<CoffeeBean>,
>(input: T, previous?: Partial<CoffeeBean>): T {
  const next: Partial<CoffeeBean> = { ...input };
  if (owns(input, 'roastLevel')) {
    const normalized = normalizeImportedRoastLevel(input.roastLevel);
    next.roastLevel =
      previous &&
      typeof input.roastLevel === 'string' &&
      input.roastLevel.trim() &&
      !normalized
        ? previous.roastLevel
        : normalized;
  }
  if (owns(input, 'flavor')) next.flavor = normalizeFlavors(input.flavor);
  if (
    owns(input, 'beanType') &&
    !['filter', 'espresso', 'omni'].includes(input.beanType ?? '')
  )
    delete next.beanType;
  for (const field of ['roastDate', 'purchaseDate'] as const) {
    if (!owns(input, field)) continue;
    const value = typeof input[field] === 'string' ? input[field].trim() : '';
    next[field] = validDate(value) ? value : '';
  }
  if (Array.isArray(input.blendComponents)) {
    next.blendComponents = input.blendComponents.map(component => {
      const clean = { ...component };
      for (const { id } of BEAN_FIELD_DEFINITIONS) {
        const value = clean[id];
        if (typeof value === 'string' && missingValue.test(value.trim()))
          clean[id] = '';
        else if (Array.isArray(value))
          clean[id] = value.filter(
            item => typeof item === 'string' && !missingValue.test(item.trim())
          );
      }
      return clean;
    });
  }
  const rawRoast = unknownRoast(input);
  if (!owns(input, 'notes'))
    return withUnknownRoastNote(
      rawRoast && previous
        ? ({ ...next, notes: previous.notes } as T)
        : (next as T),
      rawRoast
    );

  const notes: string[] = [];
  for (const note of splitBeanFieldNotes(input.notes, NOTE_LABELS)) {
    if (isMissingNote(note)) continue;
    const match = note.match(/^([^：:]+)\s*[:：]\s*(.+)$/);
    const label = match?.[1].trim();
    const field =
      label && owns(NOTE_FIELDS, label)
        ? NOTE_FIELDS[label as keyof typeof NOTE_FIELDS]
        : undefined;
    if (!field || !match) {
      notes.push(note);
      continue;
    }
    const text = match[2].trim();
    const value =
      field === 'roastLevel'
        ? normalizeImportedRoastLevel(text)
        : field === 'flavor'
          ? normalizeFlavors(text)
          : text;
    if (
      !value.length ||
      ((field === 'roastDate' || field === 'purchaseDate') && !validDate(text))
    ) {
      notes.push(note);
      continue;
    }
    const current = owns(next, field) ? next[field] : previous?.[field];
    const empty =
      current === undefined ||
      current === null ||
      (typeof current === 'string' && !current.trim()) ||
      (Array.isArray(current) && !current.length);
    if (empty && !owns(input, field)) {
      Object.assign(next, { [field]: value });
      continue;
    }
    const comparable = (candidate: unknown) =>
      Array.isArray(candidate)
        ? JSON.stringify(candidate.map(item => key(String(item))))
        : typeof candidate === 'string'
          ? key(candidate)
          : '';
    if (comparable(current) !== comparable(value)) notes.push(note);
  }
  next.notes = notes.join(' / ');
  return withUnknownRoastNote(next as T, rawRoast);
}

const allFields: FieldSettings = {
  beanFieldConfig: {
    version: 1,
    fields: BEAN_FIELD_DEFINITIONS.map((field, order) => ({
      id: field.id,
      enabled: true,
      order,
    })),
  },
};

function withLegacyOrigin<T extends Partial<CoffeeBean>>(
  input: T,
  settings?: FieldSettings | null,
  explicitComponents?: BlendComponent[]
): T {
  const enabled = new Set(
    resolveBeanFieldConfig(settings)
      .fields.filter(field => field.enabled)
      .map(field => field.id)
  );
  if (!enabled.has('origin') || enabled.has('country') || enabled.has('region'))
    return input;
  return {
    ...input,
    blendComponents: input.blendComponents?.map((component, index) => {
      const source = [component.country, component.region];
      const values = source.flatMap(value =>
        Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
      );
      const seen = new Set<string>();
      const unique = values
        .map(value => value.trim())
        .filter(value => {
          if (!value || seen.has(key(value))) return false;
          seen.add(key(value));
          return true;
        });
      if (!unique.length) return component;
      const origin = source.some(Array.isArray) ? unique : unique.join(' · ');
      const comparable = (value: string | string[] | undefined) =>
        Array.isArray(value)
          ? JSON.stringify(value.map(key))
          : key(value ?? '');
      if (getComponentFieldValue(component, 'origin')) {
        const clean = { ...component };
        if (comparable(component.origin) === comparable(origin)) {
          delete clean.country;
          delete clean.region;
        } else {
          for (const field of ['country', 'region'] as const) {
            if (comparable(component[field]) === comparable(component.origin))
              delete clean[field];
          }
        }
        return clean;
      }
      // A deliberately cleared origin must not be filled from other fields.
      if (explicitComponents && owns(explicitComponents[index] ?? {}, 'origin'))
        return component;
      const { country: _country, region: _region, ...other } = component;
      return { ...other, origin };
    }),
  };
}

export function normalizeImportedCoffeeBeanCreate<
  T extends Partial<CoffeeBean>,
>(input: T, settings?: FieldSettings | null): T {
  const extracted = normalizeCoffeeBeanForFieldConfig(
    normalizeImportedCoffeeBeanFields(input),
    allFields,
    strictNotes
  );
  const normalized = normalizeCoffeeBeanForFieldConfig(
    withLegacyOrigin(extracted, settings),
    settings,
    strictNotes
  );
  for (const field of [
    'roastLevel',
    'roastDate',
    'purchaseDate',
    'beanType',
  ] as const) {
    if (!normalized[field]) delete normalized[field];
  }
  return normalized;
}

/** Returns a merged bean, preserving historical fields on unrelated edits. */
export function normalizeImportedCoffeeBeanPatch<T extends Partial<CoffeeBean>>(
  previous: T,
  input: Partial<CoffeeBean>,
  settings?: FieldSettings | null
): T {
  const patch = normalizeImportedCoffeeBeanFields(input, previous);
  const retainedRoast = !owns(input, 'notes') ? unknownRoast(input) : undefined;
  // An automatic supplemental note is not explicit user remapping of old scoped notes.
  if (retainedRoast) delete patch.notes;
  const componentNote =
    owns(patch, 'notes') &&
    splitBeanFieldNotes(patch.notes).some(note =>
      BEAN_FIELD_DEFINITIONS.some(({ noteLabel }) =>
        new RegExp(`^(?:成分\\s*\\d+\\s*)?${noteLabel}\\s*[:：]`).test(note)
      )
    );
  if (!owns(patch, 'blendComponents') && !componentNote)
    return withUnknownRoastNote({ ...previous, ...patch }, retainedRoast);
  const explicit = owns(patch, 'blendComponents')
    ? (patch.blendComponents ?? [])
    : undefined;
  const routedPatch = owns(patch, 'blendComponents')
    ? patch
    : { ...patch, blendComponents: previous.blendComponents };
  // Keep the existing ambiguous component reorder/delete guard before deriving anything.
  const extracted = normalizeCoffeeBeanFieldUpdate(
    previous,
    routedPatch,
    allFields,
    strictNotes
  );
  const config = resolveBeanFieldConfig(settings);
  const effectiveSettings: FieldSettings = {
    ...settings,
    beanFieldConfig: {
      ...config,
      fields: config.fields.map(field => ({
        ...field,
        enabled:
          field.enabled ||
          (previous.blendComponents ?? []).some(component =>
            Boolean(getComponentFieldValue(component, field.id))
          ),
      })),
    },
  };
  return withUnknownRoastNote(
    normalizeCoffeeBeanForFieldConfig(
      withLegacyOrigin(extracted, effectiveSettings, explicit),
      effectiveSettings,
      strictNotes
    ),
    retainedRoast
  );
}
