import { getSettingsStore } from '@/lib/stores/settingsStore';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import { callStoreActionInMutation } from '@/lib/data/storeMutationBoundary';
import type { AppSettings } from '@/lib/data/models';

export function readCustomPresets(
  key: string,
  settings: Pick<AppSettings, 'customPresets'> = getSettingsStore().settings
): string[] {
  const saved = settings.customPresets?.[key];
  let values: unknown = saved;
  if (saved === undefined) {
    const legacy =
      typeof localStorage === 'undefined'
        ? null
        : localStorage.getItem(`brew-guide:custom-presets:${key}`);
    values = legacy ? JSON.parse(legacy) : [];
  }
  if (
    !Array.isArray(values) ||
    values.some(value => typeof value !== 'string')
  ) {
    throw new Error(`自定义预设数据无效: ${key}`);
  }
  return values;
}

export function changeCustomPresets(
  key: string,
  change: (values: string[]) => string[]
): Promise<void> {
  return withDataMutation(async () => {
    const store = getSettingsStore();
    const previous = readCustomPresets(key);
    const next = change(previous);
    if (next === previous) return;
    await callStoreActionInMutation(store.updateSettings, {
      customPresets: {
        ...store.settings.customPresets,
        [key]: next,
      },
    });
  });
}
