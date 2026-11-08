import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  beanList: vi.fn(),
  setBeans: vi.fn(),
  grinderList: vi.fn(async () => []),
  setGrinders: vi.fn(),
}));
vi.mock('@/lib/data/repositories', () => ({
  coffeeBeanRepository: { list: mocks.beanList },
  coffeeBeanImageRepository: { mergeBean: async (bean: unknown) => bean },
  grinderRepository: { list: mocks.grinderList },
}));
vi.mock('@/lib/stores/coffeeBeanStore', () => ({
  useCoffeeBeanStore: { getState: () => ({ setBeans: mocks.setBeans }) },
}));
vi.mock('@/lib/stores/grinderStore', () => ({
  useGrinderStore: { setState: mocks.setGrinders },
}));
vi.mock('@/lib/app/dataIntegrity', () => ({
  clearExpectedCoreDataDeletion: async () => {},
  markExpectedCoreDataDeletionIfEmpty: async () => {},
}));
import { publishBusinessChanges } from './publishChanges';
import {
  hasDirtySettings,
  clearSettingsDirty,
} from '@/lib/supabase/realtime/settingsDirty';

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('postcommit business publication', () => {
  it('recovers live records rather than reintroducing stale snapshots', async () => {
    mocks.beanList.mockResolvedValue([]);
    const dispatchEvent = vi.fn();
    vi.stubGlobal('window', { dispatchEvent });
    await publishBusinessChanges([
      {
        entity: 'bean',
        id: 'gone',
        before: null,
        after: { id: 'gone', name: 'stale' },
      },
    ]);
    expect(mocks.setBeans).toHaveBeenCalledWith([]);
    expect(dispatchEvent.mock.calls[0][0].detail).toMatchObject({
      action: 'delete',
      beanId: 'gone',
    });
  });

  it('marks settings dirty before acknowledging grinder recovery, without any live listener', async () => {
    const storage = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    await publishBusinessChanges([
      {
        entity: 'grinder',
        id: 'grinder',
        before: null,
        after: { id: 'grinder' },
      },
    ]);
    expect(hasDirtySettings()).toBe(true);
    expect(mocks.setGrinders).toHaveBeenCalled();
    clearSettingsDirty();
    expect(hasDirtySettings()).toBe(false);
  });

  it('refuses to acknowledge a settings intent when its durable dirty marker cannot be saved', async () => {
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new Error('quota');
      },
    });
    await expect(
      publishBusinessChanges([
        { entity: 'grinder', id: 'grinder', before: null, after: {} },
      ])
    ).rejects.toThrow('quota');
    expect(mocks.setGrinders).not.toHaveBeenCalled();
  });
});
