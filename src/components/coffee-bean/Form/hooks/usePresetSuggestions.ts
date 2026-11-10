import { useCallback, useMemo, useState } from 'react';
import { showToast } from '@/components/common/feedback/LightToast';
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
    async (value: string) => {
      try {
        await removeCustomPreset(key, value);
        setRevision(current => current + 1);
      } catch (error) {
        console.error('删除预设失败:', error);
        showToast({ type: 'error', title: '删除预设失败，请重试' });
      }
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
