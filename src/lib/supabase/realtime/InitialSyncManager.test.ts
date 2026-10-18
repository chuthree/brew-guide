import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { InitialSyncManager } from './InitialSyncManager';
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import {
  SYNC_TABLES,
  downloadSettingsData,
  fetchRemoteAllRecords,
  fetchRemoteRecordsByIds,
  fetchRemoteLatestTimestamp,
  uploadSettingsData,
} from '../syncOperations';
import {
  batchResolveConflicts,
  hydrateLastSyncTime,
  setLastSyncTime,
} from './conflictResolver';
import { showToast } from '@/components/common/feedback/LightToast';
import { sqliteImageSourcePayloadValidator } from '@/lib/data/sqlite/imageSourcePayloadValidator';

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
    repositories: {
      appSettingsRepository: {
        get: vi.fn().mockResolvedValue(undefined),
        save: vi.fn().mockResolvedValue(undefined),
      },
      grinderRepository: {
        list: vi.fn().mockResolvedValue([]),
        replaceAll: vi.fn().mockResolvedValue(undefined),
      },
      coffeeBeanRepository: { list: vi.fn().mockResolvedValue([]) },
      brewingNoteRepository: { list: vi.fn().mockResolvedValue([]) },
      customEquipmentRepository: {
        list: vi.fn().mockResolvedValue([]),
        upsertMany: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue(undefined),
      },
      customMethodRepository: {
        list: vi.fn().mockResolvedValue([]),
        upsertMany: vi.fn().mockResolvedValue(undefined),
        deleteMany: vi.fn().mockResolvedValue(undefined),
      },
      coffeeBeanImageRepository: {
        mergeBeans: vi.fn(async (records: unknown[]) => records),
      },
      coffeeBeanPersistence: {
        saveWithImages: vi.fn(async (record: unknown) => record),
        deleteManyWithImages: vi.fn().mockResolvedValue(undefined),
      },
      brewingNoteImageRepository: {
        mergeNotes: vi.fn(async (records: unknown[]) => records),
      },
      brewingNotePersistence: {
        saveWithImages: vi.fn(async (record: unknown) => record),
        deleteManyWithImages: vi.fn().mockResolvedValue(undefined),
      },
      imageSourcePayloadValidator: {
        validateCoffeeBeans: vi.fn().mockResolvedValue(undefined),
        validateBrewingNotes: vi.fn().mockResolvedValue(undefined),
      },
    },
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

vi.mock('@/lib/data/repositories', () => ({
  ...mocks.repositories,
}));

describe('InitialSyncManager settings sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.mocked(
      mocks.repositories.coffeeBeanImageRepository.mergeBeans
    ).mockImplementation(async records => records);
    vi.mocked(
      mocks.repositories.brewingNoteImageRepository.mergeNotes
    ).mockImplementation(async records => records);
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

    const settingsTask = useSyncStatusStore
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

  it('silences retryable no-op background table timeouts', async () => {
    vi.mocked(fetchRemoteLatestTimestamp).mockResolvedValue({
      success: true,
      data: 1000,
      affectedCount: 1,
    });
    vi.mocked(fetchRemoteAllRecords).mockImplementation((_client, table) => {
      if (table === SYNC_TABLES.BREWING_NOTES) {
        return new Promise(() => {});
      }

      return Promise.resolve({
        success: true,
        data: [],
        affectedCount: 0,
      });
    });

    useSyncStatusStore
      .getState()
      .startSupabaseSyncProgress('background-sync', '正在同步 Supabase 数据', [
        { id: SYNC_TABLES.COFFEE_BEANS, label: '咖啡豆' },
        { id: SYNC_TABLES.BREWING_NOTES, label: '笔记' },
        { id: SYNC_TABLES.CUSTOM_EQUIPMENTS, label: '自定义器具' },
        { id: SYNC_TABLES.CUSTOM_METHODS, label: '自定义方案' },
        { id: SYNC_TABLES.USER_SETTINGS, label: '设置' },
      ]);

    const manager = new InitialSyncManager({} as SupabaseClient, {
      settingsMode: 'pull-only',
    });

    const sync = manager.performSync();
    await vi.advanceTimersByTimeAsync(60000);

    await expect(sync).resolves.toEqual({
      uploaded: 0,
      downloaded: 0,
      deleted: 0,
    });

    expect(showToast).not.toHaveBeenCalled();
    expect(setLastSyncTime).not.toHaveBeenCalled();
    expect(useSyncStatusStore.getState().supabaseSyncProgress.tasks).toEqual(
      []
    );
  });

  it('keeps dirty settings retryable when their background upload fails', async () => {
    vi.mocked(uploadSettingsData).mockResolvedValue({
      success: false,
      error: '上传设置超时',
      affectedCount: 0,
    });

    useSyncStatusStore
      .getState()
      .startSupabaseSyncProgress('background-sync', '正在同步 Supabase 数据', [
        { id: SYNC_TABLES.COFFEE_BEANS, label: '咖啡豆' },
        { id: SYNC_TABLES.BREWING_NOTES, label: '笔记' },
        { id: SYNC_TABLES.CUSTOM_EQUIPMENTS, label: '自定义器具' },
        { id: SYNC_TABLES.CUSTOM_METHODS, label: '自定义方案' },
        { id: SYNC_TABLES.USER_SETTINGS, label: '设置' },
      ]);

    const manager = new InitialSyncManager({} as SupabaseClient, {
      settingsMode: 'bidirectional',
      settingsDirty: true,
    });

    await expect(manager.performSync()).rejects.toThrow('失败项目 1 个');
    expect(setLastSyncTime).not.toHaveBeenCalled();

    const settingsTask = useSyncStatusStore
      .getState()
      .supabaseSyncProgress.tasks.find(
        task => task.id === SYNC_TABLES.USER_SETTINGS
      );

    expect(settingsTask).toMatchObject({
      status: 'error',
      error: '上传设置超时',
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

    const settingsTask = useSyncStatusStore
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

  it('hydrates bean images before completing initial-sync upload snapshots', async () => {
    const localBean = {
      id: 'local-bean',
      name: 'Text-only update',
      timestamp: 2000,
    };
    const image = 'data:image/png;base64,AQID';
    const hydratedBean = { ...localBean, image };
    const upsert = vi.fn(async (_record: Record<string, unknown>) => ({
      error: null,
    }));
    vi.mocked(mocks.repositories.coffeeBeanRepository.list).mockResolvedValue([
      localBean,
    ] as never);
    vi.mocked(
      mocks.repositories.coffeeBeanImageRepository.mergeBeans
    ).mockResolvedValue([hydratedBean] as never);
    vi.mocked(batchResolveConflicts).mockReturnValue({
      merged: [localBean],
      toUpload: [localBean],
      toDownload: [],
      toDeleteLocal: [],
    } as never);

    const manager = new InitialSyncManager({
      from: vi.fn(() => ({ upsert })),
    } as unknown as SupabaseClient);

    await expect(
      manager['syncTable'](SYNC_TABLES.COFFEE_BEANS, 0)
    ).resolves.toMatchObject({
      uploaded: 1,
      downloaded: 0,
      deleted: 0,
    });

    expect(
      mocks.repositories.coffeeBeanImageRepository.mergeBeans
    ).toHaveBeenCalledWith([localBean]);
    expect(upsert.mock.calls[0]?.[0]).toMatchObject({
      data: { id: 'local-bean', name: 'Text-only update', image },
    });
  });

  it('preflights an entire Native image batch before the first aggregate write', async () => {
    const validImage = 'data:image/png;base64,AQID';
    const downloaded = [
      { id: 'remote-valid', timestamp: 2000, image: validImage },
      { id: 'remote-invalid', timestamp: 2001, image: 'blob:invalid' },
    ];
    vi.mocked(mocks.repositories.coffeeBeanRepository.list).mockResolvedValue(
      []
    );
    vi.mocked(fetchRemoteAllRecords).mockImplementation(
      async (_client, table) => ({
        success: true,
        data:
          table === SYNC_TABLES.COFFEE_BEANS
            ? downloaded.map(record => ({
                id: record.id,
                data: undefined,
                updated_at: new Date(record.timestamp).toISOString(),
                deleted_at: null,
              }))
            : [],
        affectedCount:
          table === SYNC_TABLES.COFFEE_BEANS ? downloaded.length : 0,
      })
    );
    vi.mocked(fetchRemoteRecordsByIds).mockImplementation(
      async (_client, table) => ({
        success: true,
        data:
          table === SYNC_TABLES.COFFEE_BEANS
            ? downloaded.map(record => ({ id: record.id, data: record }))
            : [],
        affectedCount:
          table === SYNC_TABLES.COFFEE_BEANS ? downloaded.length : 0,
      })
    );
    vi.mocked(batchResolveConflicts).mockImplementation((_local, remote) => {
      const records = remote
        .map(item => item.data)
        .filter(Boolean) as typeof downloaded;
      return {
        merged: records,
        toUpload: [],
        toDownload: records,
        toDeleteLocal: [],
      };
    });
    vi.mocked(
      mocks.repositories.imageSourcePayloadValidator.validateCoffeeBeans
    ).mockImplementation(records =>
      sqliteImageSourcePayloadValidator.validateCoffeeBeans(records)
    );

    const manager = new InitialSyncManager({} as SupabaseClient);
    await expect(
      manager['syncTable'](SYNC_TABLES.COFFEE_BEANS, 0)
    ).rejects.toThrow(/Invalid external image URL/);

    expect(
      mocks.repositories.imageSourcePayloadValidator.validateCoffeeBeans
    ).toHaveBeenCalledWith(downloaded);
    expect(
      mocks.repositories.coffeeBeanPersistence.saveWithImages
    ).not.toHaveBeenCalled();
  });
});
