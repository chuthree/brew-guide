import { useCallback, useMemo, useState } from 'react';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import {
  extractUniqueAltitudes,
  extractUniqueBatches,
  extractUniqueAgtrons,
  extractUniqueEstates,
  extractUniqueLots,
  extractUniqueOrigins,
  extractUniqueStations,
  extractUniqueProcesses,
  extractUniqueRegions,
  extractUniqueSeasons,
  extractUniqueVarieties,
} from '@/lib/utils/beanVarietyUtils';
import type { BlendComponent } from '@/types/app';
import { getFullPresets, getVisiblePresetSuggestions } from '../constants';

type PresetKey = 'origins' | 'regions' | 'estates' | 'lots' | 'batches' | 'stations' | 'altitudes' | 'seasons' | 'processes' | 'varieties' | 'agtrons';
type TextBlendField = Exclude<keyof BlendComponent, 'percentage'>;
type BlendComponentSuggestions = Record<PresetKey, string[]>;
type SuggestionMatch = {
  value: string;
  start: number;
  end: number;
  suggestionIndex: number;
};

const suggestionFieldMap: Array<{
  field: TextBlendField;
  suggestionKey: PresetKey;
}> = [
  { field: 'origin', suggestionKey: 'origins' },
  { field: 'region', suggestionKey: 'regions' },
  { field: 'estate', suggestionKey: 'estates' },
  { field: 'lot', suggestionKey: 'lots' },
  { field: 'batch', suggestionKey: 'batches' },
  { field: 'station', suggestionKey: 'stations' },
  { field: 'altitude', suggestionKey: 'altitudes' },
  { field: 'season', suggestionKey: 'seasons' },
  { field: 'process', suggestionKey: 'processes' },
  { field: 'variety', suggestionKey: 'varieties' },
  { field: 'agtron', suggestionKey: 'agtrons' },
];

const createEmptyBlendComponent = (): BlendComponent => ({
  origin: '',
  region: '',
  estate: '',
  lot: '',
  batch: '',
  station: '',
  altitude: '',
  season: '',
  process: '',
  variety: '',
  agtron: '',
});

const mergePresetSuggestions = (usedValues: string[], key: PresetKey) => {
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
  !normalizeBlendFieldValue(component.region) &&
  !normalizeBlendFieldValue(component.estate) &&
  !normalizeBlendFieldValue(component.lot) &&
  !normalizeBlendFieldValue(component.batch) &&
  !normalizeBlendFieldValue(component.station) &&
  !normalizeBlendFieldValue(component.altitude) &&
  !normalizeBlendFieldValue(component.season) &&
  !normalizeBlendFieldValue(component.process) &&
  !normalizeBlendFieldValue(component.variety) &&
  !normalizeBlendFieldValue(component.agtron) &&
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

const hasAutofilledRow = (previousAutofill: BlendComponent[], index: number) =>
  suggestionFieldMap.some(({ field }) =>
    hasAutofillValue(previousAutofill, index, field)
  );

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
  previousAutofill: BlendComponent[] = []
): {
  components: BlendComponent[];
  autofillComponents: BlendComponent[];
  changed: boolean;
} {
  const matchedValuesByField = suggestionFieldMap.reduce(
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
    ...suggestionFieldMap.map(({ field }) => matchedValuesByField[field].length)
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

  suggestionFieldMap.forEach(({ field }) => {
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
      (hasAutofilledRow(previousAutofill, index) || index >= components.length)
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
    () => mergePresetSuggestions(extractUniqueOrigins(beans), 'origins'),
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

  const lots = useMemo(
    () => mergePresetSuggestions(extractUniqueLots(beans), 'lots'),
    [beans, revision]
  );

  const batches = useMemo(
    () => mergePresetSuggestions(extractUniqueBatches(beans), 'batches'),
    [beans, revision]
  );

  const stations = useMemo(
    () => mergePresetSuggestions(extractUniqueStations(beans), 'stations'),
    [beans, revision]
  );

  const altitudes = useMemo(
    () => mergePresetSuggestions(extractUniqueAltitudes(beans), 'altitudes'),
    [beans, revision]
  );

  const seasons = useMemo(
    () => mergePresetSuggestions(extractUniqueSeasons(beans), 'seasons'),
    [beans, revision]
  );

  const processes = useMemo(
    () => mergePresetSuggestions(extractUniqueProcesses(beans), 'processes'),
    [beans, revision]
  );

  const varieties = useMemo(
    () => mergePresetSuggestions(extractUniqueVarieties(beans), 'varieties'),
    [beans, revision]
  );

  const agtrons = useMemo(
    () => mergePresetSuggestions(extractUniqueAgtrons(beans), 'agtrons'),
    [beans, revision]
  );

  return {
    origins,
    regions,
    estates,
    lots,
    batches,
    stations,
    altitudes,
    seasons,
    processes,
    varieties,
    agtrons,
    refresh,
  };
}
