import type { BlendComponent, CoffeeBean } from '@/types/app';
import type { AppSettings } from '@/lib/data/models';

export type BeanFieldId =
  | 'origin'
  | 'country'
  | 'region'
  | 'estate'
  | 'processingStation'
  | 'altitude'
  | 'process'
  | 'batch'
  | 'variety';

export interface BeanFieldConfigItem {
  id: BeanFieldId;
  enabled: boolean;
  order: number;
}

export interface BeanFieldConfig {
  version: 1;
  fields: BeanFieldConfigItem[];
}

export type BeanFieldGroupId = 'origin' | 'processing' | 'variety';

export interface BeanFieldDefinition {
  id: BeanFieldId;
  label: string;
  noteLabel: string;
  group: BeanFieldGroupId;
  legacy?: boolean;
}

export const BEAN_FIELD_DEFINITIONS: BeanFieldDefinition[] = [
  {
    id: 'origin',
    label: '产地',
    noteLabel: '产地',
    group: 'origin',
    legacy: true,
  },
  { id: 'country', label: '产国', noteLabel: '产国', group: 'origin' },
  { id: 'region', label: '产区', noteLabel: '产区', group: 'origin' },
  { id: 'estate', label: '庄园', noteLabel: '庄园', group: 'origin' },
  {
    id: 'processingStation',
    label: '处理站',
    noteLabel: '处理站',
    group: 'origin',
  },
  { id: 'altitude', label: '海拔', noteLabel: '海拔', group: 'origin' },
  { id: 'process', label: '处理法', noteLabel: '处理法', group: 'processing' },
  { id: 'batch', label: '批次', noteLabel: '批次', group: 'processing' },
  { id: 'variety', label: '品种', noteLabel: '品种', group: 'variety' },
];

export const BEAN_FIELD_GROUP_LABELS: Record<BeanFieldGroupId, string> = {
  origin: '产地',
  processing: '处理法',
  variety: '品种',
};

const FIELD_ORDER = new Map(
  BEAN_FIELD_DEFINITIONS.map((definition, index) => [definition.id, index])
);

const FIELD_DEFINITION_BY_ID = new Map(
  BEAN_FIELD_DEFINITIONS.map(definition => [definition.id, definition])
);

const TEXT_FIELD_IDS: BeanFieldId[] = [
  'origin',
  'country',
  'region',
  'estate',
  'processingStation',
  'altitude',
  'process',
  'batch',
  'variety',
];

export const BEAN_COMPONENT_TEXT_FIELD_IDS: readonly BeanFieldId[] =
  TEXT_FIELD_IDS;

const STRUCTURED_ORIGIN_FIELD_IDS: BeanFieldId[] = [
  'country',
  'region',
  'estate',
  'processingStation',
  'altitude',
];

const DEFAULT_ENABLED_FIELD_IDS: BeanFieldId[] = [
  'origin',
  'process',
  'variety',
];

const stringifyFieldValue = (value: unknown): string => {
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value
      .map(item => stringifyFieldValue(item))
      .filter(Boolean)
      .join(' / ');
  }
  return '';
};

const normalizeNoteParts = (notes: unknown): string[] => {
  const values = Array.isArray(notes) ? notes : [notes];
  return values
    .flatMap(value => stringifyFieldValue(value).split(/\s*(?:\/|；)\s*/))
    .filter(Boolean);
};

const formatFieldValue = (fieldId: BeanFieldId, value: unknown): string => {
  const formatted = stringifyFieldValue(value);
  if (fieldId !== 'altitude') return formatted;
  return formatted
    .replace(/^海拔\s*[:：]?\s*/, '')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/m\.?\s*a\.?\s*s\.?\s*l\.?/gi, 'm')
    .replace(/\s*m$/i, 'm');
};

const normalizeFieldValue = (fieldId: BeanFieldId, value: unknown): string =>
  formatFieldValue(fieldId, value)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[\s._·•:：;,，。/\\()[\]{}]+/g, '');

const parseFieldNote = (
  note: string
): {
  fieldId: BeanFieldId;
  value: string;
  componentIndex: number | null;
} | null => {
  for (const definition of BEAN_FIELD_DEFINITIONS) {
    const match = note.match(
      new RegExp(
        `^(?:成分\\s*(\\d+)\\s*)?${definition.noteLabel}\\s*(?:[:：]|\\s)\\s*(.+)$`
      )
    );
    if (match) {
      return {
        fieldId: definition.id,
        value: match[2],
        componentIndex: match[1] ? Number(match[1]) - 1 : null,
      };
    }
  }
  return null;
};

export function resolveBeanFieldConfig(
  settings?: Pick<AppSettings, 'beanFieldConfig' | 'showEstateField'> | null
): BeanFieldConfig {
  const configuredFields = settings?.beanFieldConfig?.fields;

  if (Array.isArray(configuredFields) && configuredFields.length > 0) {
    const enabledById = new Map<BeanFieldId, boolean>();
    configuredFields.forEach(field => {
      if (FIELD_DEFINITION_BY_ID.has(field.id)) {
        enabledById.set(field.id, field.enabled !== false);
      }
    });

    return {
      version: 1,
      fields: BEAN_FIELD_DEFINITIONS.map((definition, index) => ({
        id: definition.id,
        enabled: enabledById.get(definition.id) ?? false,
        order:
          configuredFields.find(field => field.id === definition.id)?.order ??
          index,
      })).sort((left, right) => left.order - right.order),
    };
  }

  const enabledFields = new Set(DEFAULT_ENABLED_FIELD_IDS);
  if (settings?.showEstateField === true) {
    enabledFields.add('estate');
  }

  return {
    version: 1,
    fields: BEAN_FIELD_DEFINITIONS.map((definition, index) => ({
      id: definition.id,
      enabled: enabledFields.has(definition.id),
      order: index,
    })),
  };
}

export function normalizeBeanFieldConfig(
  config?: Partial<BeanFieldConfig> | null
): BeanFieldConfig | undefined {
  if (!config || !Array.isArray(config.fields)) return undefined;

  const fieldById = new Map<BeanFieldId, BeanFieldConfigItem>();
  config.fields.forEach(field => {
    if (FIELD_DEFINITION_BY_ID.has(field.id)) {
      fieldById.set(field.id, {
        id: field.id,
        enabled: field.enabled !== false,
        order:
          typeof field.order === 'number'
            ? field.order
            : (FIELD_ORDER.get(field.id) ?? 0),
      });
    }
  });

  if (fieldById.size === 0) return undefined;

  return {
    version: 1,
    fields: BEAN_FIELD_DEFINITIONS.map((definition, index) => ({
      id: definition.id,
      enabled: fieldById.get(definition.id)?.enabled ?? false,
      order: fieldById.get(definition.id)?.order ?? index,
    })).sort((left, right) => left.order - right.order),
  };
}

export function getEnabledBeanFieldIds(config: BeanFieldConfig): BeanFieldId[] {
  return config.fields
    .filter(field => field.enabled)
    .map(field => field.id)
    .filter(id => FIELD_DEFINITION_BY_ID.has(id));
}

export function getBeanFieldDefinition(id: BeanFieldId): BeanFieldDefinition {
  return FIELD_DEFINITION_BY_ID.get(id)!;
}

export function getComponentFieldValue(
  component: BlendComponent | undefined,
  fieldId: BeanFieldId
): string {
  if (!component) return '';
  return stringifyFieldValue(component[fieldId]);
}

/** 开关决定空字段是否可填；已有内容始终可查看、编辑。 */
export function getVisibleBeanFieldIds(
  config: BeanFieldConfig,
  components: readonly BlendComponent[]
): BeanFieldId[] {
  return config.fields
    .filter(
      field =>
        field.enabled ||
        components.some(component =>
          getComponentFieldValue(component, field.id)
        )
    )
    .map(field => field.id);
}

export function hasStructuredOriginFields(
  component: BlendComponent | undefined
): boolean {
  return STRUCTURED_ORIGIN_FIELD_IDS.some(fieldId =>
    Boolean(getComponentFieldValue(component, fieldId))
  );
}

export function getComponentOriginDisplay(
  component: BlendComponent | undefined
): string {
  if (!component) return '';

  if (hasStructuredOriginFields(component)) {
    return STRUCTURED_ORIGIN_FIELD_IDS.map(fieldId =>
      getComponentFieldValue(component, fieldId)
    )
      .filter(Boolean)
      .join(' · ');
  }

  return getComponentFieldValue(component, 'origin');
}

export function getComponentSearchText(
  component: BlendComponent | undefined
): string {
  if (!component) return '';

  return [
    component.percentage,
    ...TEXT_FIELD_IDS.map(fieldId =>
      getComponentFieldValue(component, fieldId)
    ),
  ]
    .map(value => stringifyFieldValue(value))
    .filter(Boolean)
    .join(' ');
}

export function getComponentConfiguredValues(
  component: BlendComponent | undefined,
  fieldIds: BeanFieldId[]
): Array<{ id: BeanFieldId; label: string; value: string }> {
  if (!component) return [];

  return fieldIds
    .map(id => ({
      id,
      label: getBeanFieldDefinition(id).label,
      value: getComponentFieldValue(component, id),
    }))
    .filter(entry => entry.value);
}

export function normalizeCoffeeBeanForFieldConfig<
  T extends Partial<CoffeeBean>,
>(
  bean: T,
  settings?: Pick<AppSettings, 'beanFieldConfig' | 'showEstateField'> | null
): T {
  const config = resolveBeanFieldConfig(settings);
  const enabledFieldIds = new Set(getEnabledBeanFieldIds(config));
  const components = Array.isArray(bean.blendComponents)
    ? bean.blendComponents.map(component => ({ ...component }))
    : [];
  const originalComponentCount = components.length;
  const noteParts: string[] = [];
  const noteKeys = new Set<string>();

  const appendNote = (note: string) => {
    const parsed = parseFieldNote(note);
    const scope = parsed
      ? (parsed.componentIndex ??
        (originalComponentCount <= 1 ? 0 : 'unscoped'))
      : '';
    const key = parsed
      ? `${scope}|${parsed.fieldId}|${normalizeFieldValue(parsed.fieldId, parsed.value)}`
      : `note|${note.toLowerCase()}`;
    if (!noteKeys.has(key)) {
      noteKeys.add(key);
      noteParts.push(note);
    }
  };

  normalizeNoteParts(bean.notes).forEach(note => {
    const parsed = parseFieldNote(note);
    if (!parsed || !enabledFieldIds.has(parsed.fieldId)) {
      appendNote(note);
      return;
    }

    const componentIndex =
      parsed.componentIndex ?? (components.length <= 1 ? 0 : -1);
    if (
      componentIndex < 0 ||
      componentIndex >= Math.max(components.length, 1)
    ) {
      appendNote(note);
      return;
    }
    if (components.length === 0) components.push({});

    const currentValue = getComponentFieldValue(
      components[componentIndex],
      parsed.fieldId
    );
    if (!currentValue) {
      components[componentIndex][parsed.fieldId] = formatFieldValue(
        parsed.fieldId,
        parsed.value
      );
    } else if (
      normalizeFieldValue(parsed.fieldId, currentValue) !==
      normalizeFieldValue(parsed.fieldId, parsed.value)
    ) {
      appendNote(note);
    }
  });

  const normalizedComponents = components
    .map((component, componentIndex) => {
      const nextComponent: BlendComponent = {};
      if (component.percentage !== undefined && component.percentage !== null) {
        nextComponent.percentage = component.percentage;
      }

      TEXT_FIELD_IDS.forEach(fieldId => {
        const value = formatFieldValue(fieldId, component[fieldId]);
        if (!value) return;
        if (enabledFieldIds.has(fieldId)) {
          nextComponent[fieldId] = value;
          return;
        }
        const prefix =
          components.length > 1 ? `成分${componentIndex + 1} ` : '';
        appendNote(
          `${prefix}${getBeanFieldDefinition(fieldId).noteLabel}：${value}`
        );
      });
      return nextComponent;
    })
    .filter(
      component =>
        component.percentage !== undefined ||
        TEXT_FIELD_IDS.some(fieldId =>
          getComponentFieldValue(component, fieldId)
        )
    );

  return {
    ...bean,
    blendComponents:
      normalizedComponents.length > 0 ? normalizedComponents : undefined,
    notes: noteParts.length > 0 ? noteParts.join(' / ') : undefined,
  };
}

export function normalizeCoffeeBeanPayloadForFieldConfig(
  payload: unknown,
  settings?: Pick<AppSettings, 'beanFieldConfig' | 'showEstateField'> | null
): unknown {
  if (Array.isArray(payload)) {
    return payload.map(item =>
      item && typeof item === 'object'
        ? normalizeCoffeeBeanForFieldConfig(
            item as Partial<CoffeeBean>,
            settings
          )
        : item
    );
  }

  if (payload && typeof payload === 'object') {
    return normalizeCoffeeBeanForFieldConfig(
      payload as Partial<CoffeeBean>,
      settings
    );
  }

  return payload;
}
