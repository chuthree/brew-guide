import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openCapacitorSqliteDriver: vi.fn(),
  openTauriSqliteDriver: vi.fn(),
  bootstrapSqliteSchema: vi.fn(),
  createCapacitorImageFileStore: vi.fn(),
  createTauriImageFileStore: vi.fn(),
  runLegacySqliteMigration: vi.fn(),
  createSqliteRuntimeRepositories: vi.fn(),
  configureRepositories: vi.fn(),
  cleanupApprovedLegacyDatabase: vi.fn(),
}));

vi.mock('@/lib/data/repositories', () => ({
  configureRepositories: mocks.configureRepositories,
}));
vi.mock('./nativeMigrationGate', () => ({
  requestNativeMigrationApproval: vi.fn(),
  cleanupApprovedLegacyDatabase: mocks.cleanupApprovedLegacyDatabase,
  finishNativeMigration: vi.fn(),
}));

afterEach(() => {
  vi.doUnmock('@/lib/data/sqlite/capacitorSqliteDriver');
  vi.doUnmock('@/lib/data/sqlite/tauriSqliteDriver');
  vi.doUnmock('@/lib/data/sqlite/schemaBootstrap');
  vi.doUnmock('@/lib/data/images/capacitorImageFileStore');
  vi.doUnmock('@/lib/data/images/tauriImageFileStore');
  vi.doUnmock('@/lib/data/sqlite/legacyMigrationSource');
  vi.doUnmock('@/lib/data/sqlite/legacyMigrationExecutor');
  vi.doUnmock('@/lib/data/sqlite/runtimeRepositories');
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe.each([
  ['iOS', { runtime: 'capacitor', capacitorPlatform: 'ios' }],
  ['Desktop', { runtime: 'tauri', capacitorPlatform: null }],
] as const)('%s SQLite startup', (_name, runtime) => {
  it('reuses the shared migration and repositories with the shared backup approval and verified cleanup gate', async () => {
    const driver = { close: vi.fn() };
    const imageFileStore = {};
    mocks.openCapacitorSqliteDriver.mockResolvedValue(driver);
    mocks.openTauriSqliteDriver.mockResolvedValue(driver);
    mocks.bootstrapSqliteSchema.mockResolvedValue(undefined);
    mocks.createCapacitorImageFileStore.mockResolvedValue(imageFileStore);
    mocks.createTauriImageFileStore.mockResolvedValue(imageFileStore);
    mocks.runLegacySqliteMigration.mockResolvedValue({
      status: 'fresh-install',
    });
    mocks.createSqliteRuntimeRepositories.mockReturnValue({});
    vi.stubGlobal('window', { localStorage: { getItem: () => null } });

    vi.doMock('@/lib/data/sqlite/capacitorSqliteDriver', () => ({
      openCapacitorSqliteDriver: mocks.openCapacitorSqliteDriver,
    }));
    vi.doMock('@/lib/data/sqlite/tauriSqliteDriver', () => ({
      openTauriSqliteDriver: mocks.openTauriSqliteDriver,
    }));
    vi.doMock('@/lib/data/sqlite/schemaBootstrap', () => ({
      bootstrapSqliteSchema: mocks.bootstrapSqliteSchema,
    }));
    vi.doMock('@/lib/data/images/capacitorImageFileStore', () => ({
      createCapacitorImageFileStore: mocks.createCapacitorImageFileStore,
    }));
    vi.doMock('@/lib/data/images/tauriImageFileStore', () => ({
      createTauriImageFileStore: mocks.createTauriImageFileStore,
    }));
    vi.doMock('@/lib/data/sqlite/legacyMigrationSource', () => ({
      readLegacyMigrationSource: vi.fn(),
    }));
    vi.doMock('@/lib/data/sqlite/legacyMigrationExecutor', () => ({
      runLegacySqliteMigration: mocks.runLegacySqliteMigration,
      verifyLegacyMigrationBeforeCleanup: vi.fn(),
    }));
    vi.doMock('@/lib/data/sqlite/runtimeRepositories', () => ({
      createSqliteRuntimeRepositories: mocks.createSqliteRuntimeRepositories,
    }));

    const { NativeStorageBootstrap } = await import('./nativeStorageBootstrap');
    await expect(
      new NativeStorageBootstrap().initialize(runtime)
    ).resolves.toMatchObject({
      backend: 'native-sqlite',
      runtime: runtime.runtime,
    });
    expect(mocks.runLegacySqliteMigration).toHaveBeenCalledWith(
      expect.objectContaining({
        driver,
        imageFileStore,
        beforeMigration: expect.any(Function),
      })
    );
    expect(mocks.cleanupApprovedLegacyDatabase).toHaveBeenCalledWith(
      driver,
      expect.any(Function)
    );
    expect(mocks.configureRepositories).toHaveBeenCalledOnce();
  });
});
