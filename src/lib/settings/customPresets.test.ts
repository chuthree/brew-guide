// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';
import { defaultSettings } from './defaultSettings';
const persistence = vi.hoisted(() => ({ save: vi.fn(async () => undefined) }));
vi.mock('@/lib/data/repositories', () => ({
  appSettingsRepository: persistence,
}));
vi.mock('@/lib/app/runtime', () => ({
  detectAppRuntime: () => ({ runtime: 'web' }),
}));
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { changeCustomPresets, readCustomPresets } from './customPresets';

beforeEach(() => {
  persistence.save.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
  useSettingsStore.setState({ settings: { ...defaultSettings } });
});

it('reads legacy presets until the database contains an explicit value, including empty arrays', () => {
  localStorage.setItem('brew-guide:custom-presets:origins', '["legacy"]');
  expect(readCustomPresets('origins')).toEqual(['legacy']);
  useSettingsStore.setState({
    settings: { ...defaultSettings, customPresets: { origins: [] } },
  });
  expect(readCustomPresets('origins')).toEqual([]);
});

it('serializes simultaneous preset edits without losing either change', async () => {
  await Promise.all([
    changeCustomPresets('origins', values => [...values, 'one']),
    changeCustomPresets('origins', values => [...values, 'two']),
  ]);
  expect(readCustomPresets('origins')).toEqual(['one', 'two']);
  expect(persistence.save).toHaveBeenLastCalledWith(
    expect.objectContaining({ customPresets: { origins: ['one', 'two'] } })
  );
});

it('retains the visible presets when database persistence fails', async () => {
  localStorage.setItem('brew-guide:custom-presets:origins', '["legacy"]');
  persistence.save.mockRejectedValueOnce(new Error('disk full'));
  await expect(changeCustomPresets('origins', () => [])).rejects.toThrow(
    'disk full'
  );
  expect(readCustomPresets('origins')).toEqual(['legacy']);
});
