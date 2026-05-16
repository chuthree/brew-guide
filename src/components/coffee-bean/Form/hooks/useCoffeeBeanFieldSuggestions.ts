import { useMemo } from 'react';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { ROAST_LEVELS } from '@/lib/utils/roastProfileUtils';
import { getCoffeeBeanRoasterSuggestions } from '@/lib/utils/coffeeBeanUtils';
import { FLAVOR_TAGS } from '../constants';
import { usePresetSuggestions } from './usePresetSuggestions';

const mergeDefaultsWithLearnedValues = (
  defaults: readonly string[],
  learnedValues: string[]
) => {
  const seen = new Set<string>();
  return [...defaults, ...learnedValues].filter(value => {
    const normalizedValue = value.trim();
    if (!normalizedValue || seen.has(normalizedValue)) return false;
    seen.add(normalizedValue);
    return true;
  });
};

export function useRoasterSuggestions(enabled: boolean) {
  const beans = useCoffeeBeanStore(state => state.beans);
  const rawSuggestions = useMemo(
    () => getCoffeeBeanRoasterSuggestions(beans, enabled),
    [beans, enabled]
  );

  return usePresetSuggestions('roasters', rawSuggestions);
}

export function useFlavorSuggestions() {
  const beans = useCoffeeBeanStore(state => state.beans);
  const rawSuggestions = useMemo(() => {
    const learnedFlavors = beans.flatMap(bean => bean.flavor || []);
    return mergeDefaultsWithLearnedValues(FLAVOR_TAGS, learnedFlavors);
  }, [beans]);

  return usePresetSuggestions('flavors', rawSuggestions);
}

export function useRoastLevelSuggestions() {
  const beans = useCoffeeBeanStore(state => state.beans);
  const rawSuggestions = useMemo(() => {
    const learnedRoastLevels = beans
      .map(bean => bean.roastLevel || '')
      .filter(Boolean);

    return mergeDefaultsWithLearnedValues(ROAST_LEVELS, learnedRoastLevels);
  }, [beans]);

  return usePresetSuggestions('roastLevels', rawSuggestions);
}
