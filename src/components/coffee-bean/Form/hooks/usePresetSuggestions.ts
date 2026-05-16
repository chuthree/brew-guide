import { useCallback, useMemo, useState } from 'react';
import {
  CoffeeBeanPresetKey,
  getVisiblePresetSuggestions,
  isCustomPreset,
  removeCustomPreset,
} from '../constants';

export function usePresetSuggestions(
  key: CoffeeBeanPresetKey,
  suggestions: string[]
) {
  const [revision, setRevision] = useState(0);

  const visibleSuggestions = useMemo(
    () => getVisiblePresetSuggestions(key, suggestions),
    [key, suggestions, revision]
  );

  const isRemovableSuggestion = useCallback(
    (value: string) => isCustomPreset(key, value),
    [key, revision]
  );

  const removeSuggestion = useCallback(
    (value: string) => {
      removeCustomPreset(key, value);
      setRevision(current => current + 1);
    },
    [key]
  );

  const refresh = useCallback(() => {
    setRevision(current => current + 1);
  }, []);

  return {
    suggestions: visibleSuggestions,
    isRemovableSuggestion,
    removeSuggestion,
    refresh,
  };
}
