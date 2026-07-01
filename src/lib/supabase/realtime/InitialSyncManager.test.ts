import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { InitialSyncManager } from './InitialSyncManager';
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import {
  SYNC_TABLES,
  downloadSettingsData,
  fetchRemoteAllRecords,
  fetchRemoteLatestTimestamp,
  uploadSettingsData,
} from '../syncOperations';
import { hydrateLastSyncTime, setLastSyncTime } from './conflictResolver';

const mocks = vi.hoisted(() => {
  const createTable = () => ({
    toArray: vi.fn().mockResolvedValue([]),
    bulkPut: vi.fn().mockResolvedValue(undefined),
    bulkDelete: vi.fn().mockResolvedValue(undefined),
  });

  return {
    coffeeBeans: createTable(),
    brewingNotes: createTable(),
    customEquipments: createTable(),
    customMethods: createTable(),
    refreshAllStores: vi.fn().mockResolvedValue(undefined),
    refreshSettingsStores: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/lib/core/db', () => ({
  db: {
    coffeeBeans: mocks.coffeeBeans,
    brewingNotes: mocks.brewingNotes,
    customEquipments: mocks.customEquipments,
    customMethods: mocks.customMethods,
  },
}));

vi.mock('../syncOperations', async () => {
  const actual =
    await vi.importActual<typeof import('../syncOperations')>(
      '../syncOperations'
    );

  return {
    ...actual,
    fetchRemoteAllRecords: vi.fn(),
    fetchRemoteRecordsByIds: vi.fn(),
    fetchRemoteLatestTimestamp: vi.fn(),
    uploadSettingsData: vi.fn(),
    downloadSettingsData: vi.fn(),
  };
});

vi.mock('./conflictResolver', async () => {
  const actual =
    await vi.importActual<typeof import('./conflictResolver')>(
      './conflictResolver'
    );

  return {
    ...actual,
    batchResolveConflicts: vi.fn(() => ({
      merged: [],
      toUpload: [],
      toDownload: [],
      toDeleteLocal: [],
    })),
    hydrateLastSyncTime: vi.fn(),
    setLastSyncTime: vi.fn(),
  };
});

vi.mock('./handlers/StoreNotifier', () => ({
  refreshAllStores: mocks.refreshAllStores,
  refreshSettingsStores: mocks.refreshSettingsStores,
}));

vi.mock('@/components/common/feedback/LightToast', () => ({
  showToast: vi.fn(),
}));

vi.mock('@/lib/utils/exportUtils', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('@/lib/utils/roasterMigration', () => ({
  migrateRoasterField: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/coffee-beans/imageRepository', () => ({
  mergeBeansWithStoredImages: vi.fn(async records => records),
  persistCoffeeBeanImagesFromBean: vi.fn(async record => record),
}));

vi.mock('@/lib/notes/imageRepository', () => ({
  mergeNotesWithStoredImages: vi.fn(async records => records),
  persistBrewingNoteImagesFromNote: vi.fn(async record => record),
}));

describe('InitialSyncManager settings sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useSyncStatusStore.getState().reset();
    vi.mocked(hydrateLastSyncTime).mockResolvedValue(1000);
    vi.mocked(fetchRemoteAllRecords).mockResolvedValue({
      success: true,
      data: [],
      affectedCount: 0,
    });
    vi.mocked(fetchRemoteLatestTimestamp).mockResolvedValue({
      success: true,
      data: 2000,
      affectedCount: 1,
    });
    vi.mocked(uploadSettingsData).mockResolvedValue({
      success: true,
      affectedCount: 1,
    });
    vi.mocked(downloadSettingsData).mockImplementation(
      (_client, options = {}) =>
        new Promise(resolve => {
          options.signal?.addEventListener('abort', () => {
            resolve({
              success: false,
              error: 'AbortError',
              affectedCount: 0,
            });
          });
        })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    useSyncStatusStore.getState().reset();
  });

  it('defers background settings download timeouts without failing the full sync', async () => {
    const manager = new InitialSyncManager({} as SupabaseClient, {
      settingsMode: 'pull-only',
    });

    const sync = manager.performSync();
    await vi.advanceTimersByTimeAsync(13000);

    await expect(sync).resolves.toEqual({
      uploaded: 0,
      downloaded: 0,
      deleted: 0,
    });

    expect(downloadSettingsData).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(setLastSyncTime).not.toHaveBeenCalled();
    expect(mocks.refreshSettingsStores).not.toHaveBeenCalled();

    const settingsTask =
      useSyncStatusStore
        .getState()
        .supabaseSyncProgress.tasks.find(
          task => task.id === SYNC_TABLES.USER_SETTINGS
        );

    expect(settingsTask).toMatchObject({
      status: 'warning',
      detail: '远端设置下载超时，已延后',
      failed: 1,
    });
  });

  it('uploads local dirty settings instead of downloading newer remote settings first', async () => {
    const manager = new InitialSyncManager({} as SupabaseClient, {
      settingsMode: 'bidirectional',
      settingsDirty: true,
    });

    await expect(manager.performSync()).resolves.toEqual({
      uploaded: 0,
      downloaded: 0,
      deleted: 0,
    });

    expect(uploadSettingsData).toHaveBeenCalledWith(expect.anything(), {
      skipIfUnchanged: true,
    });
    expect(downloadSettingsData).not.toHaveBeenCalled();

    const settingsTask =
      useSyncStatusStore
        .getState()
        .supabaseSyncProgress.tasks.find(
          task => task.id === SYNC_TABLES.USER_SETTINGS
        );

    expect(settingsTask).toMatchObject({
      status: 'success',
      detail: '已上传 1 项设置',
      uploaded: 1,
    });
  });
});
