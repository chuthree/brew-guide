import { useCallback, useMemo, useState } from 'react';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import {
  extractUniqueAltitudes,
  extractUniqueBatches,
  extractUniqueCountries,
  extractUniqueEstates,
  extractUniqueProcessingStations,
  extractUniqueOriginSummaries,
  extractUniqueProcesses,
  extractUniqueRegions,
  extractUniqueVarieties,
} from '@/lib/utils/beanVarietyUtils';
import type { BlendComponent } from '@/types/app';
import type { BeanFieldId } from '@/lib/coffee-beans/beanFields';
import {
  getFullPresets,
  getVisiblePresetSuggestions,
  type BlendPresetKey,
} from '../constants';

type TextBlendField = Exclude<keyof BlendComponent, 'percentage'>;
type BlendComponentSuggestions = Record<BlendPresetKey, string[]>;
type SuggestionMatch = {
  value: string;
  start: number;
  end: number;
  suggestionIndex: number;
};

const suggestionFieldMap: Array<{
  field: TextBlendField;
  suggestionKey: BlendPresetKey;
}> = [
  { field: 'origin', suggestionKey: 'origins' },
  { field: 'country', suggestionKey: 'countries' },
  { field: 'region', suggestionKey: 'regions' },
  { field: 'estate', suggestionKey: 'estates' },
  { field: 'processingStation', suggestionKey: 'processingStations' },
  { field: 'altitude', suggestionKey: 'altitudes' },
  { field: 'process', suggestionKey: 'processes' },
  { field: 'batch', suggestionKey: 'batches' },
  { field: 'variety', suggestionKey: 'varieties' },
];

const createEmptyBlendComponent = (): BlendComponent => ({
  origin: '',
  country: '',
  region: '',
  estate: '',
  processingStation: '',
  altitude: '',
  process: '',
  batch: '',
  variety: '',
});

const mergePresetSuggestions = (usedValues: string[], key: BlendPresetKey) => {
  const presets = getFullPresets(key);
  return getVisiblePresetSuggestions(key, [
    ...usedValues,
    ...presets.filter(value => !usedValues.includes(value)),
  ]);
};

const normalizeBlendFieldValue = (value: unknown) =>
  typeof value === 'string' ? value.trim() : '';

const isEmptyBlendComponent = (component: BlendComponent) =>
  !normalizeBlendFieldValue(component.origin) &&
  !normalizeBlendFieldValue(component.country) &&
  !normalizeBlendFieldValue(component.region) &&
  !normalizeBlendFieldValue(component.estate) &&
  !normalizeBlendFieldValue(component.processingStation) &&
  !normalizeBlendFieldValue(component.altitude) &&
  !normalizeBlendFieldValue(component.process) &&
  !normalizeBlendFieldValue(component.batch) &&
  !normalizeBlendFieldValue(component.variety) &&
  component.percentage === undefined;

const getFieldValue = (
  component: BlendComponent | undefined,
  field: TextBlendField
) => normalizeBlendFieldValue(component?.[field]);

const collectSuggestionMatches = (
  name: string,
  suggestions: string[]
): string[] => {
  const normalizedName = name.toLowerCase();
  const seenValues = new Set<string>();
  const matches: SuggestionMatch[] = [];

  suggestions.forEach((suggestion, suggestionIndex) => {
    const value = suggestion.trim();
    const normalizedValue = value.toLowerCase();
    if (!value || seenValues.has(normalizedValue)) {
      return;
    }

    const start = normalizedName.indexOf(normalizedValue);
    if (start === -1) {
      return;
    }

    seenValues.add(normalizedValue);
    matches.push({
      value,
      start,
      end: start + normalizedValue.length,
      suggestionIndex,
    });
  });

  const selectedMatches: SuggestionMatch[] = [];
  const sortedMatches = matches.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }

    if (a.value.length !== b.value.length) {
      return b.value.length - a.value.length;
    }

    return a.suggestionIndex - b.suggestionIndex;
  });

  sortedMatches.forEach(match => {
    const hasOverlap = selectedMatches.some(
      selected => match.start < selected.end && selected.start < match.end
    );

    if (!hasOverlap) {
      selectedMatches.push(match);
    }
  });

  return selectedMatches
    .sort((a, b) => a.start - b.start || a.suggestionIndex - b.suggestionIndex)
    .map(match => match.value);
};

const hasAutofillValue = (
  previousAutofill: BlendComponent[],
  index: number,
  field: TextBlendField
) => Boolean(getFieldValue(previousAutofill[index], field));

const hasAutofilledRow = (
  previousAutofill: BlendComponent[],
  index: number,
  fields: typeof suggestionFieldMap
) =>
  fields.some(({ field }) => hasAutofillValue(previousAutofill, index, field));

const canUpdateFieldFromName = (
  component: BlendComponent | undefined,
  previousAutofill: BlendComponent[],
  index: number,
  field: TextBlendField,
  nextValue: string
) => {
  const currentValue = getFieldValue(component, field);
  const previousValue = getFieldValue(previousAutofill[index], field);

  return (
    !currentValue ||
    currentValue === nextValue ||
    (Boolean(previousValue) && currentValue === previousValue)
  );
};

export function autofillBlendComponentsFromName(
  components: BlendComponent[],
  name: string,
  suggestions: BlendComponentSuggestions,
  previousAutofill: BlendComponent[],
  enabledFields: readonly BeanFieldId[]
): {
  components: BlendComponent[];
  autofillComponents: BlendComponent[];
  changed: boolean;
} {
  const enabledFieldSet = new Set(enabledFields);
  const autofillableFields = suggestionFieldMap.filter(({ field }) =>
    enabledFieldSet.has(field)
  );
  const matchedValuesByField = autofillableFields.reduce(
    (result, { field, suggestionKey }) => {
      result[field] = collectSuggestionMatches(
        name,
        suggestions[suggestionKey]
      );
      return result;
    },
    {} as Record<TextBlendField, string[]>
  );

  const generatedComponentCount = Math.max(
    0,
    ...autofillableFields.map(({ field }) => matchedValuesByField[field].length)
  );

  const baseComponents =
    components.length > 0
      ? components.map(component => ({ ...component }))
      : [createEmptyBlendComponent()];
  const nextComponents = [...baseComponents];
  const nextAutofill: BlendComponent[] = Array.from(
    { length: generatedComponentCount },
    createEmptyBlendComponent
  );

  while (nextComponents.length < generatedComponentCount) {
    nextComponents.push(createEmptyBlendComponent());
  }

  let hasChange = false;

  autofillableFields.forEach(({ field }) => {
    const matchedValues = matchedValuesByField[field];
    const rowCount = Math.max(
      nextComponents.length,
      previousAutofill.length,
      matchedValues.length
    );

    for (let index = 0; index < rowCount; index += 1) {
      const nextValue = matchedValues[index] || '';
      const component = nextComponents[index];
      const currentValue = getFieldValue(component, field);
      const previousValue = getFieldValue(previousAutofill[index], field);

      if (nextValue) {
        if (
          canUpdateFieldFromName(
            component,
            previousAutofill,
            index,
            field,
            nextValue
          )
        ) {
          if (!nextComponents[index]) {
            nextComponents[index] = createEmptyBlendComponent();
          }

          if (currentValue !== nextValue) {
            nextComponents[index][field] = nextValue;
            hasChange = true;
          }

          nextAutofill[index] = {
            ...(nextAutofill[index] || createEmptyBlendComponent()),
            [field]: nextValue,
          };
        }
        continue;
      }

      if (
        previousValue &&
        currentValue === previousValue &&
        hasAutofillValue(previousAutofill, index, field)
      ) {
        nextComponents[index][field] = '';
        hasChange = true;
      }
    }
  });

  for (let index = nextComponents.length - 1; index >= 1; index -= 1) {
    if (
      isEmptyBlendComponent(nextComponents[index]) &&
      (hasAutofilledRow(previousAutofill, index, autofillableFields) ||
        index >= components.length)
    ) {
      nextComponents.splice(index, 1);
      hasChange = true;
    }
  }

  return {
    components: hasChange ? nextComponents : components,
    autofillComponents: nextAutofill,
    changed: hasChange,
  };
}

export function useBlendComponentSuggestions() {
  const beans = useCoffeeBeanStore(state => state.beans);
  const [revision, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setRevision(value => value + 1);
  }, []);

  const origins = useMemo(
    () =>
      mergePresetSuggestions(extractUniqueOriginSummaries(beans), 'origins'),
    [beans, revision]
  );

  const countries = useMemo(
    () => mergePresetSuggestions(extractUniqueCountries(beans), 'countries'),
    [beans, revision]
  );

  const regions = useMemo(
    () => mergePresetSuggestions(extractUniqueRegions(beans), 'regions'),
    [beans, revision]
  );

  const estates = useMemo(
    () => mergePresetSuggestions(extractUniqueEstates(beans), 'estates'),
    [beans, revision]
  );

  const processingStations = useMemo(
    () =>
      mergePresetSuggestions(
        extractUniqueProcessingStations(beans),
        'processingStations'
      ),
    [beans, revision]
  );

  const altitudes = useMemo(
    () => mergePresetSuggestions(extractUniqueAltitudes(beans), 'altitudes'),
    [beans, revision]
  );

  const processes = useMemo(
    () => mergePresetSuggestions(extractUniqueProcesses(beans), 'processes'),
    [beans, revision]
  );

  const batches = useMemo(
    () => mergePresetSuggestions(extractUniqueBatches(beans), 'batches'),
    [beans, revision]
  );

  const varieties = useMemo(
    () => mergePresetSuggestions(extractUniqueVarieties(beans), 'varieties'),
    [beans, revision]
  );

  return {
    origins,
    countries,
    regions,
    estates,
    processingStations,
    altitudes,
    processes,
    batches,
    varieties,
    refresh,
  };
}
