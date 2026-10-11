import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Preferences } from '@capacitor/preferences';
import {
  batchResolveConflicts,
  getLastSyncTime,
  hydrateLastSyncTime,
  setLastSyncTime,
} from './conflictResolver';

const LAST_SYNC_TIME_KEY = 'brew-guide:realtime-sync:lastSyncTime';
const preferencesStore = new Map<string, string>();

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({
      value: preferencesStore.get(key) ?? null,
    })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      preferencesStore.set(key, value);
    }),
  },
}));

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  clear(): void {
    this.values.clear();
  }
}

describe('realtime sync time persistence', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage },
      configurable: true,
    });
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    });
  });

  afterEach(() => {
    preferencesStore.clear();
    vi.clearAllMocks();
    delete (globalThis as { window?: unknown }).window;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('backs up last sync time outside localStorage', async () => {
    setLastSyncTime(123456);

    expect(getLastSyncTime()).toBe(123456);
    await vi.waitFor(() => {
      expect(Preferences.set).toHaveBeenCalledWith({
        key: LAST_SYNC_TIME_KEY,
        value: '123456',
      });
    });
    expect(preferencesStore.get(LAST_SYNC_TIME_KEY)).toBe('123456');
  });

  it('hydrates last sync time from Preferences when localStorage is empty', async () => {
    preferencesStore.set(LAST_SYNC_TIME_KEY, '987654');

    await expect(hydrateLastSyncTime()).resolves.toBe(987654);

    expect(getLastSyncTime()).toBe(987654);
    expect(Preferences.get).toHaveBeenCalledWith({ key: LAST_SYNC_TIME_KEY });
  });

  it('ignores invalid stored sync times', async () => {
    storage.setItem(LAST_SYNC_TIME_KEY, 'not-a-time');
    preferencesStore.set(LAST_SYNC_TIME_KEY, '-1');

    await expect(hydrateLastSyncTime()).resolves.toBe(0);

    expect(getLastSyncTime()).toBe(0);
  });
});

describe('batchResolveConflicts remote-missing records', () => {
  it('uploads local records on first sync when remote is empty', () => {
    const result = batchResolveConflicts(
      [{ id: 'note-1', updatedAt: 1000 }],
      [],
      0
    );

    expect(result.toUpload.map(record => record.id)).toEqual(['note-1']);
    expect(result.toDeleteLocal).toEqual([]);
  });

  it('uploads older custom equipment and method records when the remote row is absent', () => {
    const result = batchResolveConflicts(
      [
        { id: 'custom-equipment-1', timestamp: 1000 },
        { id: 'custom-equipment-methods-1', timestamp: 1100 },
      ],
      [],
      2000
    );

    expect(result.merged.map(record => record.id)).toEqual([
      'custom-equipment-1',
      'custom-equipment-methods-1',
    ]);
    expect(result.toUpload.map(record => record.id)).toEqual([
      'custom-equipment-1',
      'custom-equipment-methods-1',
    ]);
    expect(result.toDeleteLocal).toEqual([]);
  });

  it('does not restore a local record when the remote has an authoritative tombstone', () => {
    const result = batchResolveConflicts(
      [{ id: 'custom-equipment-1', timestamp: 1000 }],
      [
        {
          id: 'custom-equipment-1',
          user_id: 'default_user',
          data: { id: 'custom-equipment-1', timestamp: 1000 },
          updated_at: new Date(2000).toISOString(),
          deleted_at: new Date(2000).toISOString(),
        },
      ],
      500
    );

    expect(result.toUpload).toEqual([]);
    expect(result.toDeleteLocal).toEqual(['custom-equipment-1']);
  });

  it('does not reupload an unchanged record once its remote row exists', () => {
    const result = batchResolveConflicts(
      [{ id: 'custom-equipment-1', timestamp: 1000 }],
      [
        {
          id: 'custom-equipment-1',
          user_id: 'default_user',
          data: { id: 'custom-equipment-1', timestamp: 1000 },
          updated_at: new Date(1000).toISOString(),
          deleted_at: null,
        },
      ],
      2000
    );

    expect(result.toUpload).toEqual([]);
    expect(result.toDownload).toEqual([]);
    expect(result.toDeleteLocal).toEqual([]);
  });
});
