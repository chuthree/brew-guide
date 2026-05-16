'use client';

import React from 'react';
import { BlendComponent } from '@/types/app';
import { useBlendComponentSuggestions } from '@/components/coffee-bean/Form/hooks/useBlendComponentSuggestions';
import { usePresetSuggestions } from '@/components/coffee-bean/Form/hooks/usePresetSuggestions';
import TagAutocompleteInput from './TagAutocompleteInput';

type TextBlendField = Exclude<keyof BlendComponent, 'percentage'>;

interface BlendComponentTagRowsProps {
  components: BlendComponent[];
  showEstateField: boolean;
  onChange: (index: number, field: TextBlendField, value: string) => void;
}

const fieldConfigs: Array<{
  field: TextBlendField;
  label: string;
  placeholder: string;
  suggestionKey: 'origins' | 'estates' | 'processes' | 'varieties';
}> = [
  {
    field: 'origin',
    label: '产地',
    placeholder: '输入产地，逗号分隔',
    suggestionKey: 'origins',
  },
  {
    field: 'estate',
    label: '庄园',
    placeholder: '输入庄园，逗号分隔',
    suggestionKey: 'estates',
  },
  {
    field: 'process',
    label: '处理法',
    placeholder: '输入处理法，逗号分隔',
    suggestionKey: 'processes',
  },
  {
    field: 'variety',
    label: '品种',
    placeholder: '输入品种，逗号分隔',
    suggestionKey: 'varieties',
  },
];

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
  const placeholder = entries.length === 0 ? config.placeholder : '+ ';
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
  components,
  showEstateField,
  onChange,
}) => {
  const suggestions = useBlendComponentSuggestions();
  const visibleFields = showEstateField
    ? fieldConfigs
    : fieldConfigs.filter(config => config.field !== 'estate');

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
