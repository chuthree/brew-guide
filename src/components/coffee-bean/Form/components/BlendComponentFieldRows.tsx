import React from 'react';
import { BlendComponent } from '@/types/app';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import {
  BLEND_COMPONENT_FIELDS,
  useBlendComponentSuggestions,
} from '../hooks/useBlendComponentSuggestions';
import { usePresetSuggestions } from '../hooks/usePresetSuggestions';
import {
  getBeanFieldDefinition,
  getComponentFieldValue,
  type BeanFieldId,
} from '@/lib/coffee-beans/beanFields';

type TextBlendField = Exclude<keyof BlendComponent, 'percentage'>;

interface BlendComponentFieldRowsProps {
  component: BlendComponent;
  index: number;
  fieldIds: BeanFieldId[];
  onChange: (index: number, field: TextBlendField, value: string) => void;
}

const fieldConfigs = BLEND_COMPONENT_FIELDS.map(config => ({
  ...config,
  label: getBeanFieldDefinition(config.field).label,
}));

interface BlendComponentFieldInputProps {
  config: (typeof fieldConfigs)[number];
  component: BlendComponent;
  index: number;
  suggestions: ReturnType<typeof useBlendComponentSuggestions>;
  onChange: (index: number, field: TextBlendField, value: string) => void;
}

const BlendComponentFieldInput: React.FC<BlendComponentFieldInputProps> = ({
  config,
  component,
  index,
  suggestions,
  onChange,
}) => {
  const presetSuggestions = usePresetSuggestions(
    config.suggestionKey,
    suggestions[config.suggestionKey]
  );

  return (
    <AutocompleteInput
      label={config.label}
      value={getComponentFieldValue(component, config.field)}
      onChange={value => onChange(index, config.field, value)}
      placeholder={config.label}
      suggestions={presetSuggestions.suggestions}
      clearable
      isCustomPreset={presetSuggestions.isRemovableSuggestion}
      onRemovePreset={presetSuggestions.removeSuggestion}
    />
  );
};

const BlendComponentFieldRows: React.FC<BlendComponentFieldRowsProps> = ({
  component,
  index,
  fieldIds,
  onChange,
}) => {
  const suggestions = useBlendComponentSuggestions();
  const visibleFields = fieldIds.map(
    fieldId => fieldConfigs.find(config => config.field === fieldId)!
  );
  const gridColumns =
    visibleFields.length <= 2 || visibleFields.length === 4
      ? 'grid-cols-2'
      : 'grid-cols-3';

  if (visibleFields.length === 0) return null;

  return (
    <div className={`grid gap-3 ${gridColumns}`}>
      {visibleFields.map(config => (
        <BlendComponentFieldInput
          key={config.field}
          config={config}
          component={component}
          index={index}
          suggestions={suggestions}
          onChange={onChange}
        />
      ))}
    </div>
  );
};

export default BlendComponentFieldRows;
