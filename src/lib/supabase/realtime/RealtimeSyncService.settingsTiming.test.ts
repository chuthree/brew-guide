import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  downloadSettingsDataMock,
  refreshSettingsStoresMock,
  setLastSyncTimeMock,
  uploadSettingsDataMock,
} = vi.hoisted(() => ({
  downloadSettingsDataMock: vi.fn(),
  refreshSettingsStoresMock: vi.fn(),
  setLastSyncTimeMock: vi.fn(),
  uploadSettingsDataMock: vi.fn(),
}));

vi.mock('../syncOperations', async importOriginal => {
  const actual = await importOriginal<typeof import('../syncOperations')>();
  return {
    ...actual,
    downloadSettingsData: downloadSettingsDataMock,
    uploadSettingsData: uploadSettingsDataMock,
  };
});

vi.mock('./handlers', async importOriginal => {
  const actual = await importOriginal<typeof import('./handlers')>();
  return {
    ...actual,
    refreshSettingsStores: refreshSettingsStoresMock,
  };
});

vi.mock('./conflictResolver', async importOriginal => {
  const actual = await importOriginal<typeof import('./conflictResolver')>();
  return {
    ...actual,
    setLastSyncTime: setLastSyncTimeMock,
  };
});

import { RealtimeSyncService } from './RealtimeSyncService';
import { localChangeListener } from './handlers';

type RealtimeSyncServiceTestAccess = {
  client: unknown;
  handleRemoteSettingsChange: (payload: never) => Promise<void>;
  isProcessingRemoteSettings: boolean;
  remoteSettingsApplyPromise: Promise<void> | null;
  setupLocalChangeListeners: () => void;
  syncRunPromise: Promise<void> | null;
};

describe('RealtimeSyncService settings timing', () => {
  let service: RealtimeSyncService;
  let serviceTestAccess: RealtimeSyncServiceTestAccess;
  let scheduleSettingsSync: (() => void) | undefined;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    const storageValues = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      clear: () => storageValues.clear(),
      get length() {
        return storageValues.size;
      },
      getItem: (key: string) => storageValues.get(key) ?? null,
      key: (index: number) => [...storageValues.keys()][index] ?? null,
      removeItem: (key: string) => {
        storageValues.delete(key);
      },
      setItem: (key: string, value: string) => {
        storageValues.set(key, value);
      },
    });
    downloadSettingsDataMock.mockResolvedValue({
      success: true,
      data: 0,
      affectedCount: 0,
    });
    refreshSettingsStoresMock.mockResolvedValue(undefined);
    setLastSyncTimeMock.mockReset();
    uploadSettingsDataMock.mockResolvedValue({
      success: true,
      data: 1,
      affectedCount: 1,
    });

    service = RealtimeSyncService.getInstance();
    await service.disconnect();
    serviceTestAccess = service as unknown as RealtimeSyncServiceTestAccess;
    serviceTestAccess.client = {};
    serviceTestAccess.isProcessingRemoteSettings = false;
    serviceTestAccess.remoteSettingsApplyPromise = null;
    serviceTestAccess.syncRunPromise = null;
    vi.spyOn(localChangeListener, 'start').mockImplementation(
      (_onSync, onSettingsSync) => {
        scheduleSettingsSync = onSettingsSync;
      }
    );
    serviceTestAccess.setupLocalChangeListeners();
  });

  afterEach(async () => {
    await service.disconnect();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('uploads after the normal debounce instead of waiting through remote cooldown', async () => {
    await serviceTestAccess.handleRemoteSettingsChange({
      eventType: 'UPDATE',
    } as never);
    const changedAt = Date.now();
    scheduleSettingsSync?.();

    await vi.advanceTimersByTimeAsync(499);
    expect(uploadSettingsDataMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(uploadSettingsDataMock).toHaveBeenCalledTimes(1);
    expect(Date.now() - changedAt).toBe(500);
  });

  it('waits for an active remote settings apply after the debounce', async () => {
    const changedAt = Date.now();
    let remoteApplyFinished = false;
    let uploadStartedAt: number | null = null;
    let finishRemoteApply!: (value: {
      success: true;
      data: number;
      affectedCount: number;
    }) => void;
    downloadSettingsDataMock.mockReturnValueOnce(
      new Promise(resolve => {
        finishRemoteApply = resolve;
      })
    );
    uploadSettingsDataMock.mockImplementation(async () => {
      uploadStartedAt = Date.now();
      expect(remoteApplyFinished).toBe(true);
      return { success: true, data: 1, affectedCount: 1 };
    });

    const remoteApply = serviceTestAccess.handleRemoteSettingsChange({
      eventType: 'UPDATE',
    } as never);
    scheduleSettingsSync?.();

    await vi.advanceTimersByTimeAsync(500);
    expect(uploadSettingsDataMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);
    expect(uploadSettingsDataMock).not.toHaveBeenCalled();

    finishRemoteApply({ success: true, data: 0, affectedCount: 0 });
    await remoteApply;
    remoteApplyFinished = true;
    await vi.advanceTimersByTimeAsync(0);

    expect(uploadSettingsDataMock).toHaveBeenCalledTimes(1);
    expect(uploadStartedAt).toBe(changedAt + 700);
  });

  it('keeps the existing full-sync queue and uploads as soon as it clears', async () => {
    let finishFullSync!: () => void;
    let uploadStartedAt: number | null = null;
    const changedAt = Date.now();
    const fullSync = new Promise<void>(resolve => {
      finishFullSync = resolve;
    });
    serviceTestAccess.syncRunPromise = fullSync;
    uploadSettingsDataMock.mockImplementation(async () => {
      uploadStartedAt = Date.now();
      return { success: true, data: 1, affectedCount: 1 };
    });

    scheduleSettingsSync?.();
    await vi.advanceTimersByTimeAsync(500);
    expect(uploadSettingsDataMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(200);

    finishFullSync();
    await fullSync;
    await vi.advanceTimersByTimeAsync(0);

    expect(uploadSettingsDataMock).toHaveBeenCalledTimes(1);
    expect(uploadStartedAt).toBe(changedAt + 700);
  });

  it('keeps the existing three-second bound if remote apply stalls', async () => {
    let finishRemoteApply!: (value: {
      success: true;
      data: number;
      affectedCount: number;
    }) => void;
    downloadSettingsDataMock.mockReturnValueOnce(
      new Promise(resolve => {
        finishRemoteApply = resolve;
      })
    );
    const remoteApply = serviceTestAccess.handleRemoteSettingsChange({
      eventType: 'UPDATE',
    } as never);
    scheduleSettingsSync?.();

    await vi.advanceTimersByTimeAsync(500);
    expect(uploadSettingsDataMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2999);
    expect(uploadSettingsDataMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(uploadSettingsDataMock).toHaveBeenCalledTimes(1);

    finishRemoteApply({ success: true, data: 0, affectedCount: 0 });
    await remoteApply;
  });
});
