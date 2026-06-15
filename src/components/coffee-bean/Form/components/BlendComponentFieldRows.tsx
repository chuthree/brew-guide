import React from 'react';
import { BlendComponent } from '@/types/app';
import AutocompleteInput from '@/components/common/forms/AutocompleteInput';
import { useBlendComponentSuggestions } from '../hooks/useBlendComponentSuggestions';
import { usePresetSuggestions } from '../hooks/usePresetSuggestions';

type TextBlendField = Exclude<keyof BlendComponent, 'percentage'>;
type SuggestionKey = 'origins' | 'regions' | 'estates' | 'lots' | 'batches' | 'stations' | 'altitudes' | 'seasons' | 'processes' | 'varieties' | 'agtrons';

interface BlendComponentFieldRowsProps {
  component: BlendComponent;
  index: number;
  showEstateField: boolean;
  showRegionField: boolean;
  showLotField: boolean;
  showBatchField: boolean;
  showStationField: boolean;
  showAltitudeField: boolean;
  showSeasonField: boolean;
  showAgtronField: boolean;
  onChange: (index: number, field: TextBlendField, value: string) => void;
}

const fieldConfigs: Array<{
  field: TextBlendField;
  label: string;
  placeholder: string;
  suggestionKey: SuggestionKey;
}> = [
  {
    field: 'origin',
    label: '产地',
    placeholder: '产地',
    suggestionKey: 'origins',
  },
  {
    field: 'region',
    label: '产区',
    placeholder: '产区',
    suggestionKey: 'regions',
  },
  {
    field: 'estate',
    label: '庄园',
    placeholder: '庄园',
    suggestionKey: 'estates',
  },
  {
    field: 'lot',
    label: '地块',
    placeholder: '地块',
    suggestionKey: 'lots',
  },
  {
    field: 'batch',
    label: '批次',
    placeholder: '批次',
    suggestionKey: 'batches',
  },
  {
    field: 'station',
    label: '处理站',
    placeholder: '处理站',
    suggestionKey: 'stations',
  },
  {
    field: 'process',
    label: '处理法',
    placeholder: '处理法',
    suggestionKey: 'processes',
  },
  {
    field: 'variety',
    label: '品种',
    placeholder: '品种',
    suggestionKey: 'varieties',
  },
  {
    field: 'altitude',
    label: '海拔',
    placeholder: '海拔',
    suggestionKey: 'altitudes',
  },
  {
    field: 'season',
    label: '产季',
    placeholder: '产季',
    suggestionKey: 'seasons',
  },
  {
    field: 'agtron',
    label: 'Agtron值',
    placeholder: 'Agtron值',
    suggestionKey: 'agtrons',
  },
];

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
      value={component[config.field] || ''}
      onChange={value => onChange(index, config.field, value)}
      placeholder={config.placeholder}
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
  showEstateField,
  showRegionField,
  showLotField,
  showBatchField,
  showStationField,
  showAltitudeField,
  showSeasonField,
  showAgtronField,
  onChange,
}) => {
  const suggestions = useBlendComponentSuggestions();
  const visibleFields = fieldConfigs.filter(config => {
    if (config.field === 'estate' && !showEstateField) return false;
    if (config.field === 'region' && !showRegionField) return false;
    if (config.field === 'lot' && !showLotField) return false;
    if (config.field === 'batch' && !showBatchField) return false;
    if (config.field === 'station' && !showStationField) return false;
    if (config.field === 'altitude' && !showAltitudeField) return false;
    if (config.field === 'season' && !showSeasonField) return false;
    if (config.field === 'agtron' && !showAgtronField) return false;
    return true;
  });

  const gridCols = visibleFields.length <= 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div
      className={`grid gap-3 ${gridCols}`}
    >
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
