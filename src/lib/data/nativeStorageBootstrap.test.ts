import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configureRepositories: vi.fn(),
  openAndroidSqliteDriver: vi.fn(),
  bootstrapSqliteSchema: vi.fn(),
  createCapacitorAndroidImageFileStore: vi.fn(),
  readLegacyMigrationSource: vi.fn(),
  runLegacySqliteMigration: vi.fn(),
  createSqliteRuntimeRepositories: vi.fn(),
  requestNativeMigrationApproval: vi.fn(),
  cleanupApprovedLegacyDatabase: vi.fn(),
  finishNativeMigration: vi.fn(),
  order: [] as string[],
}));

vi.mock('@/lib/data/repositories', () => ({
  configureRepositories: mocks.configureRepositories,
}));
vi.mock('./nativeMigrationGate', () => ({
  requestNativeMigrationApproval: mocks.requestNativeMigrationApproval,
  cleanupApprovedLegacyDatabase: mocks.cleanupApprovedLegacyDatabase,
  finishNativeMigration: mocks.finishNativeMigration,
}));

describe('Native Android storage bootstrap', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/core/db');
    vi.doUnmock('@/lib/data/dexieRuntime');
    vi.doUnmock('@/lib/data/sqlite/androidSqliteDriver');
    vi.doUnmock('@/lib/data/sqlite/schemaBootstrap');
    vi.doUnmock('@/lib/data/images/capacitorAndroidImageFileStore');
    vi.doUnmock('@/lib/data/sqlite/legacyMigrationSource');
    vi.doUnmock('@/lib/data/sqlite/legacyMigrationExecutor');
    vi.doUnmock('@/lib/data/sqlite/runtimeRepositories');
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('stays independent of Dexie before initialization and rejects unsupported runtimes', async () => {
    const loadDexie = vi.fn(() => {
      throw new Error('Native SQLite must not load Dexie');
    });
    vi.doMock('@/lib/core/db', loadDexie);
    vi.doMock('@/lib/data/dexieRuntime', loadDexie);

    const { NativeStorageBootstrap } = await import('./nativeStorageBootstrap');
    const bootstrap = new NativeStorageBootstrap();

    await expect(
      bootstrap.initialize({ runtime: 'web', capacitorPlatform: null })
    ).rejects.toThrow(/Capacitor Android only/);
    await expect(
      bootstrap.initialize({ runtime: 'capacitor', capacitorPlatform: 'ios' })
    ).rejects.toThrow(/Capacitor Android only/);
    await import('@/lib/core/dataLayer');

    expect(loadDexie).not.toHaveBeenCalled();
  });

  it('bootstraps, migrates, and binds SQLite repositories in fail-closed order once', async () => {
    const order = mocks.order;
    order.length = 0;
    const driver = { close: vi.fn(async () => undefined) };
    const imageFileStore = {};
    const repositories = {};
    const localStorage = { getItem: vi.fn(() => null) };
    vi.stubGlobal('window', { localStorage });

    mocks.openAndroidSqliteDriver.mockImplementation(async () => {
      order.push('open');
      return driver;
    });
    mocks.bootstrapSqliteSchema.mockImplementation(async () => {
      order.push('schema');
    });
    mocks.createCapacitorAndroidImageFileStore.mockImplementation(async () => {
      order.push('files');
      return imageFileStore;
    });
    mocks.readLegacyMigrationSource.mockImplementation(async storage => {
      order.push('source');
      expect(storage).toBe(localStorage);
      return {};
    });
    mocks.runLegacySqliteMigration.mockImplementation(
      async ({ loadSource }) => {
        await loadSource();
        order.push('migration');
        return { status: 'fresh-install' };
      }
    );
    mocks.createSqliteRuntimeRepositories.mockImplementation(() => {
      order.push('repositories');
      return repositories;
    });
    mocks.configureRepositories.mockImplementation(() => {
      order.push('bind');
    });

    vi.doMock('@/lib/data/sqlite/androidSqliteDriver', () => ({
      openAndroidSqliteDriver: mocks.openAndroidSqliteDriver,
    }));
    vi.doMock('@/lib/data/sqlite/schemaBootstrap', () => ({
      bootstrapSqliteSchema: mocks.bootstrapSqliteSchema,
    }));
    vi.doMock('@/lib/data/images/capacitorAndroidImageFileStore', () => ({
      createCapacitorAndroidImageFileStore:
        mocks.createCapacitorAndroidImageFileStore,
    }));
    vi.doMock('@/lib/data/sqlite/legacyMigrationSource', () => ({
      readLegacyMigrationSource: mocks.readLegacyMigrationSource,
    }));
    vi.doMock('@/lib/data/sqlite/legacyMigrationExecutor', () => ({
      runLegacySqliteMigration: mocks.runLegacySqliteMigration,
    }));
    vi.doMock('@/lib/data/sqlite/runtimeRepositories', () => ({
      createSqliteRuntimeRepositories: mocks.createSqliteRuntimeRepositories,
    }));

    const { NativeStorageBootstrap } = await import('./nativeStorageBootstrap');
    const runtime = {
      runtime: 'capacitor',
      capacitorPlatform: 'android',
    } as const;
    const [first, second] = await Promise.all([
      new NativeStorageBootstrap().initialize(runtime),
      new NativeStorageBootstrap().initialize(runtime),
    ]);

    expect(first).toEqual({
      status: 'ready',
      runtime: 'capacitor',
      backend: 'native-sqlite',
    });
    expect(second).toEqual(first);
    expect(order).toEqual([
      'open',
      'schema',
      'files',
      'source',
      'migration',
      'repositories',
      'bind',
    ]);
    expect(mocks.runLegacySqliteMigration).toHaveBeenCalledWith(
      expect.objectContaining({
        driver,
        imageFileStore,
        beforeMigration: mocks.requestNativeMigrationApproval,
      })
    );
    expect(mocks.cleanupApprovedLegacyDatabase).toHaveBeenCalledWith(driver);
    expect(mocks.configureRepositories).toHaveBeenCalledWith(repositories);
  });

  it('does not bind repositories when migration fails and closes the driver', async () => {
    const driver = { close: vi.fn(async () => undefined) };
    const retryDriver = { close: vi.fn(async () => undefined) };
    const imageFileStore = {};
    const failure = new Error('legacy source preflight rejected');
    mocks.openAndroidSqliteDriver
      .mockResolvedValueOnce(driver)
      .mockResolvedValueOnce(retryDriver);
    mocks.bootstrapSqliteSchema.mockResolvedValue(undefined);
    mocks.createCapacitorAndroidImageFileStore.mockResolvedValue(
      imageFileStore
    );
    mocks.readLegacyMigrationSource.mockResolvedValue({});
    mocks.runLegacySqliteMigration
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({ status: 'fresh-install' });
    mocks.createSqliteRuntimeRepositories.mockReturnValue({});
    vi.stubGlobal('window', { localStorage: { getItem: () => null } });
    vi.doMock('@/lib/data/sqlite/androidSqliteDriver', () => ({
      openAndroidSqliteDriver: mocks.openAndroidSqliteDriver,
    }));
    vi.doMock('@/lib/data/sqlite/schemaBootstrap', () => ({
      bootstrapSqliteSchema: mocks.bootstrapSqliteSchema,
    }));
    vi.doMock('@/lib/data/images/capacitorAndroidImageFileStore', () => ({
      createCapacitorAndroidImageFileStore:
        mocks.createCapacitorAndroidImageFileStore,
    }));
    vi.doMock('@/lib/data/sqlite/legacyMigrationSource', () => ({
      readLegacyMigrationSource: mocks.readLegacyMigrationSource,
    }));
    vi.doMock('@/lib/data/sqlite/legacyMigrationExecutor', () => ({
      runLegacySqliteMigration: mocks.runLegacySqliteMigration,
    }));
    vi.doMock('@/lib/data/sqlite/runtimeRepositories', () => ({
      createSqliteRuntimeRepositories: mocks.createSqliteRuntimeRepositories,
    }));

    const { NativeStorageBootstrap } = await import('./nativeStorageBootstrap');
    const bootstrap = new NativeStorageBootstrap();
    const runtime = {
      runtime: 'capacitor',
      capacitorPlatform: 'android',
    } as const;
    await expect(bootstrap.initialize(runtime)).rejects.toBe(failure);

    expect(mocks.configureRepositories).not.toHaveBeenCalled();
    expect(driver.close).toHaveBeenCalledOnce();
    expect(mocks.cleanupApprovedLegacyDatabase).not.toHaveBeenCalled();

    await expect(bootstrap.initialize(runtime)).resolves.toEqual({
      status: 'ready',
      runtime: 'capacitor',
      backend: 'native-sqlite',
    });

    expect(retryDriver.close).not.toHaveBeenCalled();
    expect(mocks.configureRepositories).toHaveBeenCalledOnce();
  });
});
