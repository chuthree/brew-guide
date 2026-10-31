import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppSettings, Grinder, RoasterConfig } from '@/lib/data/models';
import {
  createSettingsSyncFingerprint,
  downloadSettingsData,
  uploadSettingsData,
} from './syncOperations';

const repositoryMocks = vi.hoisted(() => ({
  getAppSettings: vi.fn(),
  saveAppSettings: vi.fn(),
  listGrinders: vi.fn(),
  replaceAllGrinders: vi.fn(),
  setState: vi.fn(),
}));

vi.mock('@/lib/stores/settingsStore', () => ({
  useSettingsStore: { setState: repositoryMocks.setState },
}));

vi.mock('@/lib/data/repositories', () => ({
  appSettingsRepository: {
    get: repositoryMocks.getAppSettings,
    save: repositoryMocks.saveAppSettings,
  },
  grinderRepository: {
    list: repositoryMocks.listGrinders,
    replaceAll: repositoryMocks.replaceAllGrinders,
  },
}));

const SETTINGS_SYNC_FINGERPRINT_KEY =
  'brew-guide:realtime-sync:settingsFingerprint';

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

class FailingFingerprintStorage extends MemoryStorage {
  setItem(key: string, value: string): void {
    if (key === SETTINGS_SYNC_FINGERPRINT_KEY) {
      throw new Error('quota exceeded');
    }

    super.setItem(key, value);
  }
}

const sharedSettings = {
  username: '',
};

const localSettings = {
  ...sharedSettings,
  textZoomLevel: 1.1,
  supabaseSync: {
    enabled: true,
    url: 'https://example.supabase.co',
    anonKey: 'anon-key',
    lastConnectionSuccess: true,
  },
  activeSyncType: 'supabase',
};

const localGrinders = [{ id: 'grinder-1', name: 'C40' }];
function mockLocalSettings() {
  repositoryMocks.getAppSettings.mockResolvedValue(
    localSettings as unknown as AppSettings
  );
  repositoryMocks.listGrinders.mockResolvedValue(localGrinders as Grinder[]);
}

function createSettingsClient(remoteData?: Record<string, unknown>) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: remoteData
      ? { data: remoteData, updated_at: '2026-01-01T00:00:00.000Z' }
      : null,
    error: null,
  });
  const eqId = vi.fn(() => ({ maybeSingle }));
  const eqUser = vi.fn(() => ({ eq: eqId }));
  const select = vi.fn(() => ({ eq: eqUser }));
  const written = vi
    .fn()
    .mockResolvedValue({ data: { id: 'app_settings' }, error: null });
  const mutation = {
    eq: vi.fn((_key: string, _value: unknown) => mutation),
    select: () => ({ maybeSingle: written }),
  };
  const write = vi.fn((_record: unknown) => mutation);
  const from = vi.fn(() => ({ select, update: write, insert: write }));

  return {
    client: { from } as unknown as SupabaseClient,
    maybeSingle,
    select,
    upsert: write,
    written,
    mutation,
  };
}

function createDownloadSettingsClient(remoteData?: Record<string, unknown>) {
  const single = vi.fn().mockResolvedValue({
    data: remoteData ? { data: remoteData } : null,
    error: null,
  });
  const abortSignal = vi.fn(() => ({ single }));
  const eqId = vi.fn(() => ({ abortSignal, single }));
  const eqUser = vi.fn(() => ({ eq: eqId }));
  const select = vi.fn(() => ({ eq: eqUser }));
  const from = vi.fn(() => ({ select }));

  return {
    client: { from } as unknown as SupabaseClient,
    abortSignal,
    single,
  };
}

describe('roaster logos across devices', () => {
  const logo: RoasterConfig = {
    roasterName: 'R',
    logoData: 'new-image',
    logoUpdatedAt: 20,
    updatedAt: 20,
  };
  const deleted: RoasterConfig = {
    roasterName: 'R',
    logoUpdatedAt: 30,
    updatedAt: 30,
  };
  const snapshot = (configs: RoasterConfig[]) => ({
    appSettings: { ...localSettings, roasterConfigs: configs },
    grinders: localGrinders,
    customPresets: {},
  });
  let local: AppSettings;

  beforeEach(() => {
    vi.resetAllMocks();
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage, dispatchEvent: vi.fn() },
      configurable: true,
    });
    local = snapshot([logo]).appSettings as unknown as AppSettings;
    repositoryMocks.getAppSettings.mockImplementation(async () => local);
    repositoryMocks.saveAppSettings.mockImplementation(async settings => {
      local = settings;
    });
    repositoryMocks.listGrinders.mockResolvedValue(localGrinders);
  });

  it.each([
    { configs: [] },
    { configs: [{ roasterName: 'R', updatedAt: 999 }] },
  ])(
    'download does not erase a pending local logo with $configs',
    async ({ configs }) => {
      const { client } = createDownloadSettingsClient(snapshot(configs));
      expect((await downloadSettingsData(client)).success).toBe(true);
      expect(local.roasterConfigs![0]).toMatchObject({
        logoData: 'new-image',
        logoUpdatedAt: 20,
      });
    }
  );

  it.each([
    { configs: [] },
    { configs: [{ roasterName: 'R', logoData: 'old-image', updatedAt: 999 }] },
  ])(
    'stale device upload preserves remote logos and repairs its local copy: $configs',
    async ({ configs }) => {
      local.roasterConfigs = configs;
      const { client, upsert } = createSettingsClient(snapshot([logo]));
      expect((await uploadSettingsData(client)).success).toBe(true);
      expect(upsert.mock.calls[0][0]).toMatchObject({
        data: {
          appSettings: {
            roasterConfigs: [
              expect.objectContaining({
                logoData: 'new-image',
                logoUpdatedAt: 20,
              }),
            ],
          },
        },
      });
      expect(local.roasterConfigs![0].logoData).toBe('new-image');
      expect(repositoryMocks.setState).toHaveBeenCalledOnce();
    }
  );

  it('downloads and uploads explicit deletions without resurrecting old images', async () => {
    const download = createDownloadSettingsClient(snapshot([deleted]));
    expect((await downloadSettingsData(download.client)).success).toBe(true);
    expect(local.roasterConfigs![0].logoData).toBeUndefined();
    const upload = createSettingsClient(snapshot([logo]));
    expect((await uploadSettingsData(upload.client)).success).toBe(true);
    const payload = JSON.parse(JSON.stringify(upload.upsert.mock.calls[0][0]));
    expect(payload.data.appSettings.roasterConfigs).toEqual([deleted]);
  });

  it('applies a remote deletion when a stale device uploads and skips an unchanged write', async () => {
    local.roasterConfigs = [{ ...logo, updatedAt: deleted.updatedAt }];
    const { client, upsert } = createSettingsClient(snapshot([deleted]));
    expect(
      await uploadSettingsData(client, { skipIfUnchanged: true })
    ).toMatchObject({ success: true, affectedCount: 0 });
    expect(upsert).not.toHaveBeenCalled();
    expect(local.roasterConfigs![0].logoData).toBeUndefined();
    expect(local.roasterConfigs![0].logoUpdatedAt).toBe(30);
  });

  it('re-reads and merges a second device deletion after a conditional write conflict', async () => {
    const remote = createSettingsClient(snapshot([logo]));
    const secondTimestamp = '2026-01-02T00:00:00.000Z';
    remote.written.mockImplementationOnce(async () => {
      // Device B commits after A reads; A's conditional UPDATE affects no rows.
      remote.maybeSingle.mockResolvedValue({
        data: { data: snapshot([deleted]), updated_at: secondTimestamp },
        error: null,
      });
      return { data: null, error: null };
    });
    expect((await uploadSettingsData(remote.client)).success).toBe(true);
    expect(remote.maybeSingle).toHaveBeenCalledTimes(2);
    expect(remote.mutation.eq).toHaveBeenCalledWith(
      'updated_at',
      '2026-01-01T00:00:00.000Z'
    );
    expect(remote.mutation.eq).toHaveBeenCalledWith(
      'updated_at',
      secondTimestamp
    );
    expect(remote.upsert.mock.calls[1][0]).toMatchObject({
      data: {
        appSettings: {
          roasterConfigs: [expect.objectContaining({ logoUpdatedAt: 30 })],
        },
      },
    });
    expect(local.roasterConfigs![0].logoData).toBeUndefined();
  });

  it('merges both devices logos when they race to create the settings row', async () => {
    const remote = createSettingsClient();
    const other = { ...logo, roasterName: 'Other' };
    remote.written.mockImplementationOnce(async () => {
      remote.maybeSingle.mockResolvedValue({
        data: {
          data: snapshot([other]),
          updated_at: '2026-01-02T00:00:00.000Z',
        },
        error: null,
      });
      return { data: null, error: { code: '23505' } };
    });
    expect((await uploadSettingsData(remote.client)).success).toBe(true);
    expect(remote.upsert).toHaveBeenCalledTimes(2);
    expect(local.roasterConfigs).toEqual([logo, other]);
  });

  it('keeps an edit made locally while the upload was in flight', async () => {
    const remote = createSettingsClient(snapshot([logo]));
    remote.written.mockImplementationOnce(async () => {
      local = { ...local, roasterConfigs: [deleted] };
      return { data: { id: 'app_settings' }, error: null };
    });
    expect((await uploadSettingsData(remote.client)).success).toBe(true);
    expect(local.roasterConfigs).toEqual([deleted]);
  });

  it('fails without overwriting when remote reads fail', async () => {
    const remote = createSettingsClient();
    remote.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'offline' },
    });
    expect((await uploadSettingsData(remote.client)).success).toBe(false);
    expect(remote.upsert).not.toHaveBeenCalled();
    expect(repositoryMocks.saveAppSettings).not.toHaveBeenCalled();
  });

  it('stops after repeated concurrent conflicts without applying an uncommitted snapshot', async () => {
    const remote = createSettingsClient(snapshot([deleted]));
    remote.written.mockResolvedValue({ data: null, error: null });
    expect((await uploadSettingsData(remote.client)).success).toBe(false);
    expect(remote.upsert).toHaveBeenCalledTimes(3);
    expect(local.roasterConfigs).toEqual([logo]);
    expect(repositoryMocks.saveAppSettings).not.toHaveBeenCalled();
  });
});

describe('settings sync fingerprint', () => {
  beforeEach(() => {
    const storage = new MemoryStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage, dispatchEvent: vi.fn() },
      configurable: true,
    });
    vi.clearAllMocks();
  });

  it('uses stable object ordering and ignores volatile Supabase connection flags', () => {
    const first = createSettingsSyncFingerprint({
      b: 2,
      appSettings: {
        supabaseSync: {
          url: 'u',
          anonKey: 'k',
          lastConnectionSuccess: true,
          lastSyncTime: 123,
        },
        a: 1,
      },
    });
    const second = createSettingsSyncFingerprint({
      appSettings: {
        a: 1,
        supabaseSync: {
          lastConnectionSuccess: false,
          lastSyncTime: 456,
          anonKey: 'k',
          url: 'u',
        },
      },
      b: 2,
    });

    expect(first).toBe(second);
  });

  it('creates a compact versioned hash instead of storing raw settings JSON', () => {
    const fingerprint = createSettingsSyncFingerprint({
      appSettings: {
        username: 'very-long-name'.repeat(1000),
      },
      grinders: [],
      customPresets: {},
    });

    expect(fingerprint).toMatch(/^v2:\d+:[0-9a-f]{16}$/);
    expect(fingerprint.length).toBeLessThan(64);
    expect(fingerprint).not.toContain('very-long-name');
  });

  it('checks remote settings even when the local fingerprint was already synced', async () => {
    mockLocalSettings();
    const localData = {
      appSettings: localSettings,
      grinders: localGrinders,
      customPresets: {},
    };
    localStorage.setItem(
      SETTINGS_SYNC_FINGERPRINT_KEY,
      createSettingsSyncFingerprint(localData)
    );
    const { client, select, upsert } = createSettingsClient(localData);

    const result = await uploadSettingsData(client, {
      skipIfUnchanged: true,
    });

    expect(result).toMatchObject({ success: true, affectedCount: 0 });
    expect(select).toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('skips upload when remote settings already match local data', async () => {
    mockLocalSettings();
    const localData = {
      appSettings: localSettings,
      grinders: localGrinders,
      customPresets: {},
    };
    const { client, maybeSingle, upsert } = createSettingsClient(localData);

    const result = await uploadSettingsData(client, {
      skipIfUnchanged: true,
    });

    expect(result).toMatchObject({ success: true, affectedCount: 0 });
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
    expect(localStorage.getItem(SETTINGS_SYNC_FINGERPRINT_KEY)).toBe(
      createSettingsSyncFingerprint(localData)
    );
  });

  it('does not fail settings sync when fingerprint cache exceeds quota', async () => {
    const storage = new FailingFingerprintStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: storage,
      configurable: true,
    });
    Object.defineProperty(globalThis, 'window', {
      value: { localStorage: storage, dispatchEvent: vi.fn() },
      configurable: true,
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      mockLocalSettings();
      const localData = {
        appSettings: localSettings,
        grinders: localGrinders,
        customPresets: {},
      };
      const { client, maybeSingle, upsert } = createSettingsClient(localData);

      const result = await uploadSettingsData(client, {
        skipIfUnchanged: true,
      });

      expect(result).toMatchObject({ success: true, affectedCount: 0 });
      expect(maybeSingle).toHaveBeenCalledTimes(1);
      expect(upsert).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        '[SyncOps] 设置同步指纹缓存失败，已跳过:',
        expect.any(Error)
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('uploads settings when remote data differs from local data', async () => {
    mockLocalSettings();
    const { client, upsert } = createSettingsClient({
      appSettings: { ...localSettings, username: '另一台设备' },
      grinders: localGrinders,
    });

    const result = await uploadSettingsData(client, {
      skipIfUnchanged: true,
    });

    expect(result).toMatchObject({ success: true, affectedCount: 3 });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toMatchObject({
      id: 'app_settings',
      user_id: 'default_user',
      data: {
        appSettings: sharedSettings,
        grinders: localGrinders,
        customPresets: {},
      },
    });
  });

  it('uploads empty settings sections so deletions are synced', async () => {
    repositoryMocks.getAppSettings.mockResolvedValue(
      localSettings as unknown as AppSettings
    );
    repositoryMocks.listGrinders.mockResolvedValue([]);
    localStorage.removeItem('brew-guide:custom-presets:origins');
    const { client, upsert } = createSettingsClient({
      appSettings: localSettings,
      grinders: localGrinders,
      customPresets: { origins: ['Yirgacheffe'] },
    });

    const result = await uploadSettingsData(client, {
      skipIfUnchanged: true,
    });

    expect(result).toMatchObject({ success: true, affectedCount: 3 });
    expect(upsert.mock.calls[0][0]).toMatchObject({
      data: {
        appSettings: sharedSettings,
        grinders: [],
        customPresets: {},
      },
    });
  });

  it('clears local grinder and preset sections when remote settings are empty', async () => {
    repositoryMocks.getAppSettings.mockResolvedValue(
      localSettings as unknown as AppSettings
    );
    repositoryMocks.listGrinders.mockResolvedValue([]);
    localStorage.setItem(
      'brew-guide:custom-presets:origins',
      JSON.stringify(['Yirgacheffe'])
    );
    const { client } = createDownloadSettingsClient({
      appSettings: localSettings,
      grinders: [],
      customPresets: {},
    });

    const result = await downloadSettingsData(client);

    expect(result).toMatchObject({ success: true });
    expect(repositoryMocks.saveAppSettings).toHaveBeenCalledOnce();
    expect(repositoryMocks.replaceAllGrinders).toHaveBeenCalledWith([]);
    expect(
      localStorage.getItem('brew-guide:custom-presets:origins')
    ).toBeNull();
  });

  it('passes abort signals to Supabase settings downloads', async () => {
    const { client, abortSignal, single } = createDownloadSettingsClient();
    const controller = new AbortController();

    const result = await downloadSettingsData(client, {
      signal: controller.signal,
    });

    expect(result).toMatchObject({ success: true, affectedCount: 0 });
    expect(abortSignal).toHaveBeenCalledWith(controller.signal);
    expect(single).toHaveBeenCalledTimes(1);
  });
});
