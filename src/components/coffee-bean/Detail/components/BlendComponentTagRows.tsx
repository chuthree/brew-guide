'use client';

import React from 'react';
import { BlendComponent } from '@/types/app';
import {
  BLEND_COMPONENT_FIELDS,
  useBlendComponentSuggestions,
} from '@/components/coffee-bean/Form/hooks/useBlendComponentSuggestions';
import { usePresetSuggestions } from '@/components/coffee-bean/Form/hooks/usePresetSuggestions';
import TagAutocompleteInput from './TagAutocompleteInput';
import {
  getBeanFieldDefinition,
  type BeanFieldId,
} from '@/lib/coffee-beans/beanFields';

type TextBlendField = Exclude<keyof BlendComponent, 'percentage'>;

interface BlendComponentTagRowsProps {
  fieldIds: BeanFieldId[];
  components: BlendComponent[];
  onChange: (index: number, field: TextBlendField, value: string) => void;
}

const fieldConfigs = BLEND_COMPONENT_FIELDS.map(config => ({
  ...config,
  label: getBeanFieldDefinition(config.field).label,
}));

const getAppendIndex = (
  components: BlendComponent[],
  field: TextBlendField
) => {
  const emptyIndex = components.findIndex(
    component => !String(component[field] || '').trim()
  );

  return emptyIndex === -1 ? components.length : emptyIndex;
};

const getFieldEntries = (components: BlendComponent[], field: TextBlendField) =>
  components
    .map((component, index) => ({
      index,
      value: String(component[field] || '').trim(),
    }))
    .filter(entry => entry.value);

interface BlendComponentTagFieldProps {
  config: (typeof fieldConfigs)[number];
  components: BlendComponent[];
  suggestions: ReturnType<typeof useBlendComponentSuggestions>;
  onChange: (index: number, field: TextBlendField, value: string) => void;
}

const BlendComponentTagField: React.FC<BlendComponentTagFieldProps> = ({
  config,
  components,
  suggestions,
  onChange,
}) => {
  const entries = getFieldEntries(components, config.field);
  const placeholder =
    entries.length === 0 ? `输入${config.label}，逗号分隔` : '+ ';
  const presetSuggestions = usePresetSuggestions(
    config.suggestionKey,
    suggestions[config.suggestionKey]
  );

  return (
    <div className="flex items-start">
      <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {config.label}
      </div>
      <div className="-mt-0.5 flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {entries.map(entry => (
          <span
            key={`${config.field}-${entry.index}`}
            contentEditable
            suppressContentEditableWarning
            onBlur={event => {
              const nextValue = event.currentTarget.textContent?.trim() || '';

              if (nextValue !== entry.value) {
                onChange(entry.index, config.field, nextValue);
              }
            }}
            className="cursor-text bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 outline-none dark:bg-neutral-800/40 dark:text-neutral-300"
          >
            {entry.value}
          </span>
        ))}

        <TagAutocompleteInput
          placeholder={placeholder}
          suggestions={presetSuggestions.suggestions.filter(
            suggestion => !entries.some(entry => entry.value === suggestion)
          )}
          isCustomPreset={presetSuggestions.isRemovableSuggestion}
          onRemovePreset={presetSuggestions.removeSuggestion}
          onCommit={value =>
            onChange(
              getAppendIndex(components, config.field),
              config.field,
              value
            )
          }
          onBackspaceEmpty={() => {
            if (!entries.length) return undefined;

            const lastEntry = entries[entries.length - 1];
            onChange(lastEntry.index, config.field, '');
            return lastEntry.value;
          }}
        />
      </div>
    </div>
  );
};

const BlendComponentTagRows: React.FC<BlendComponentTagRowsProps> = ({
  fieldIds,
  components,
  onChange,
}) => {
  const suggestions = useBlendComponentSuggestions();
  const visibleFields = fieldIds.map(
    fieldId => fieldConfigs.find(config => config.field === fieldId)!
  );

  if (visibleFields.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleFields.map(config => (
        <BlendComponentTagField
          key={config.field}
          config={config}
          components={components}
          suggestions={suggestions}
          onChange={onChange}
        />
      ))}
    </div>
  );
};

export default BlendComponentTagRows;
