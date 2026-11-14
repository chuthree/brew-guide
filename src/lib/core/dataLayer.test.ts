import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runtime: vi.fn(async () => ({
    status: 'ready',
    runtime: 'web',
    backend: 'dexie',
  })),
  load: vi.fn(async () => undefined),
  migrate: vi.fn(async (): Promise<void> => undefined),
  initializeEquipment: vi.fn(),
  exportBeans: vi.fn(async () => []),
  exportNotes: vi.fn(async () => []),
}));

vi.mock('@/lib/data/runtime', () => ({ initializeDataRuntime: mocks.runtime }));
vi.mock('@/lib/data/storeMutationBoundary', () => ({
  coordinateStoreActions: (actions: object) => actions,
  callStoreActionInMutation: vi.fn(),
}));
vi.mock('@/lib/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => ({ loadSettings: mocks.load, settings: {} }),
  },
}));
vi.mock('@/lib/stores/coffeeBeanStore', () => ({
  useCoffeeBeanStore: {
    getState: () => ({ loadBeans: mocks.load, beans: [] }),
  },
}));
vi.mock('@/lib/stores/brewingNoteStore', () => ({
  useBrewingNoteStore: {
    getState: () => ({ loadNotes: mocks.load, notes: [] }),
  },
}));
vi.mock('@/lib/stores/customEquipmentStore', () => ({
  useCustomEquipmentStore: {
    getState: () => ({ loadEquipments: mocks.load, equipments: [] }),
  },
}));
vi.mock('@/lib/stores/customMethodStore', () => ({
  useCustomMethodStore: {
    getState: () => ({ loadMethods: mocks.load, methodsByEquipment: {} }),
  },
}));
vi.mock('@/lib/stores/grinderStore', () => ({
  useGrinderStore: {
    getState: () => ({ initialize: mocks.load, grinders: [] }),
  },
}));
vi.mock('@/lib/stores/equipmentStore', () => ({
  useEquipmentStore: {
    getState: () => ({ initialize: mocks.initializeEquipment }),
  },
}));
vi.mock('@/lib/utils/roasterMigration', () => ({
  migrateRoasterField: mocks.migrate,
}));
vi.mock('@/lib/app/crashDiagnostics', () => ({
  recordCrashCheckpoint: vi.fn(),
}));
vi.mock('@/lib/app/dataIntegrity', () => ({
  inspectCoreDataIntegrity: vi.fn(),
}));
vi.mock('@/lib/data/repositories', () => ({
  coffeeBeanImageRepository: { exportAll: mocks.exportBeans },
  brewingNoteImageRepository: { exportAll: mocks.exportNotes },
  coffeeBeanPersistence: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

it('shares startup work across concurrent callers and retains successful initialization', async () => {
  let release!: () => void;
  mocks.migrate.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        release = resolve;
      })
  );
  const { initializeDataLayer } = await import('./dataLayer');
  const first = initializeDataLayer();
  const second = initializeDataLayer();
  await vi.waitFor(() => expect(mocks.migrate).toHaveBeenCalledOnce());
  expect(mocks.runtime).toHaveBeenCalledOnce();
  release();
  await Promise.all([first, second]);
  await initializeDataLayer();
  expect(mocks.runtime).toHaveBeenCalledOnce();
  expect(mocks.load).toHaveBeenCalledTimes(6);
});

it('propagates startup failure to all callers and allows a later retry', async () => {
  mocks.migrate.mockRejectedValueOnce(new Error('migration failed'));
  const { initializeDataLayer } = await import('./dataLayer');
  const results = await Promise.allSettled([
    initializeDataLayer(),
    initializeDataLayer(),
  ]);
  expect(results).toEqual([
    { status: 'rejected', reason: new Error('migration failed') },
    { status: 'rejected', reason: new Error('migration failed') },
  ]);
  await expect(initializeDataLayer()).resolves.toBeUndefined();
  expect(mocks.runtime).toHaveBeenCalledTimes(2);
});

it('waits for the active initialization before exporting data', async () => {
  let release!: () => void;
  mocks.migrate.mockImplementationOnce(
    () =>
      new Promise<void>(resolve => {
        release = resolve;
      })
  );
  const { initializeDataLayer, exportAllData } = await import('./dataLayer');
  const startup = initializeDataLayer();
  const exported = exportAllData();
  await vi.waitFor(() => expect(mocks.migrate).toHaveBeenCalledOnce());
  expect(mocks.exportBeans).not.toHaveBeenCalled();
  release();
  await startup;
  await exported;
  expect(mocks.exportBeans).toHaveBeenCalledOnce();
  expect(mocks.runtime).toHaveBeenCalledOnce();
});
