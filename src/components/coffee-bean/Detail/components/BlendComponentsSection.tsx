'use client';

import React from 'react';
import { formatRoastMetric } from '@/lib/utils/roastProfileUtils';
import { updateBlendComponentsDelimitedField } from '@/lib/utils/coffeeBeanUtils';
import { BlendComponent, CoffeeBean } from '@/types/app';
import {
  BEAN_FIELD_DEFINITIONS,
  getBeanFieldDefinition,
  getComponentFieldValue,
  type BeanFieldId,
} from '@/lib/coffee-beans/beanFields';

type TextBlendField = Exclude<keyof BlendComponent, 'percentage'>;

interface BlendComponentsSectionProps {
  fieldIds: BeanFieldId[];
  bean: CoffeeBean | null;
  isAddMode: boolean;
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
}

interface BlendComponentDisplayEntry {
  componentIndex: number;
  value: string;
}

export type BlendComponentDisplayRow =
  | {
      field: TextBlendField;
      label: string;
      editable: true;
      entries: BlendComponentDisplayEntry[];
    }
  | {
      field: 'percentage';
      label: string;
      editable: false;
      entries: BlendComponentDisplayEntry[];
    };

export const buildBlendComponentDisplayRows = (
  components: BlendComponent[],
  fieldIds: BeanFieldId[] = BEAN_FIELD_DEFINITIONS.map(
    definition => definition.id
  )
): BlendComponentDisplayRow[] => {
  const fieldRows = fieldIds.flatMap(fieldId => {
    const entries = components.flatMap((component, componentIndex) => {
      const value = getComponentFieldValue(component, fieldId);
      return value ? [{ componentIndex, value }] : [];
    });

    return entries.length > 0
      ? [
          {
            field: fieldId,
            label: getBeanFieldDefinition(fieldId).label,
            editable: true as const,
            entries,
          },
        ]
      : [];
  });

  const percentageEntries = components.flatMap((component, componentIndex) =>
    component.percentage !== undefined && component.percentage !== null
      ? [
          {
            componentIndex,
            value: `${formatRoastMetric(component.percentage)}%`,
          },
        ]
      : []
  );

  return percentageEntries.length > 0
    ? [
        ...fieldRows,
        {
          field: 'percentage',
          label: '比例',
          editable: false,
          entries: percentageEntries,
        },
      ]
    : fieldRows;
};

interface EditableBlendValueProps {
  field: TextBlendField;
  entry: BlendComponentDisplayEntry;
  components: BlendComponent[];
  handleUpdateField: (updates: Partial<CoffeeBean>) => Promise<void>;
}

const EditableBlendValue: React.FC<EditableBlendValueProps> = ({
  field,
  entry,
  components,
  handleUpdateField,
}) => {
  const handleBlur = React.useCallback(
    (event: React.FocusEvent<HTMLSpanElement>) => {
      const nextValue = event.currentTarget.textContent?.trim() || '';
      if (nextValue === entry.value) return;

      const updatedComponents = updateBlendComponentsDelimitedField(
        components,
        entry.componentIndex,
        field,
        nextValue
      );
      void handleUpdateField({ blendComponents: updatedComponents });
    },
    [components, entry.componentIndex, entry.value, field, handleUpdateField]
  );

  return (
    <span
      contentEditable
      suppressContentEditableWarning
      onBlur={handleBlur}
      className="cursor-text outline-none"
    >
      {entry.value}
    </span>
  );
};

const BlendComponentsSection: React.FC<BlendComponentsSectionProps> = ({
  fieldIds,
  bean,
  isAddMode,
  handleUpdateField,
}) => {
  if (isAddMode || !bean?.blendComponents || bean.blendComponents.length <= 1) {
    return null;
  }

  const displayRows = buildBlendComponentDisplayRows(
    bean.blendComponents,
    fieldIds
  );
  if (displayRows.length === 0) return null;

  const renderRowEntries = (row: BlendComponentDisplayRow) =>
    row.entries.flatMap((entry, entryIndex) => {
      const value = row.editable ? (
        <EditableBlendValue
          key={`${row.field}-${entry.componentIndex}`}
          field={row.field}
          entry={entry}
          components={bean.blendComponents!}
          handleUpdateField={handleUpdateField}
        />
      ) : (
        <span key={`${row.field}-${entry.componentIndex}`}>{entry.value}</span>
      );

      return entryIndex === 0
        ? [value]
        : [
            <span
              key={`${row.field}-separator-${entry.componentIndex}`}
              className="text-neutral-400 select-none dark:text-neutral-600"
            >
              ·
            </span>,
            value,
          ];
    });

  return (
    <div className="space-y-3">
      {displayRows.map(row => (
        <div key={row.field} className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            {row.label}
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-xs font-medium text-neutral-800 dark:text-neutral-100">
            {renderRowEntries(row)}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BlendComponentsSection;
