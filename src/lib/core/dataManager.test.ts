import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const storageSet = vi.fn(async (key: string) => {
    if (key === 'brewingNotes' || key === 'coffeeBeans') {
      throw new Error(
        `${key} 不支持通过 Storage.set 写入，请使用 DataManager 的显式导入流程`
      );
    }
  });

  return {
    storageSet,
    normalizeCoffeeBeans: vi.fn((beans: unknown[]) => beans),
    replaceCoffeeBeansWithSplitImages: vi.fn(() => Promise.resolve(true)),
    replaceBrewingNotesWithSplitImages: vi.fn(() => Promise.resolve(true)),
    replaceGrinders: vi.fn(() => Promise.resolve()),
    exportCoffeeBeansWithImages: vi.fn(() => Promise.resolve([])),
    exportBrewingNotesWithImages: vi.fn(() => Promise.resolve([])),
    clearLegacySettings: vi.fn(() => Promise.resolve()),
    clearCustomEquipments: vi.fn(() => Promise.resolve()),
    clearCustomMethods: vi.fn(() => Promise.resolve()),
    clearGrinders: vi.fn(() => Promise.resolve()),
    clearAppSettings: vi.fn(() => Promise.resolve()),
    validateCoffeeBeans: vi.fn(() => Promise.resolve()),
    validateBrewingNotes: vi.fn(() => Promise.resolve()),
  };
});

vi.mock('@/lib/core/config', () => ({
  APP_VERSION: 'test',
}));

vi.mock('@/lib/app/runtime', () => ({
  detectAppRuntime: vi.fn(() => ({
    runtime: 'web',
    capacitorPlatform: null,
  })),
}));

vi.mock('@/lib/core/storage', () => ({
  Storage: {
    set: mocks.storageSet,
    get: vi.fn(() => Promise.resolve(null)),
    remove: vi.fn(() => Promise.resolve()),
    keys: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('@/lib/stores/settingsStore', () => ({
  getRoasterConfigsSync: vi.fn(() => []),
  getSettingsStore: vi.fn(() => ({
    settings: {},
    loadSettings: vi.fn(() => Promise.resolve()),
    importSettings: vi.fn(() => Promise.resolve()),
    updateRoasterConfig: vi.fn(() => Promise.resolve()),
  })),
  defaultSettings: {},
}));

vi.mock('@/lib/stores/coffeeBeanStore', () => ({
  getCoffeeBeanStore: vi.fn(() => ({
    refreshBeans: vi.fn(() => Promise.resolve()),
    setBeans: vi.fn(),
  })),
}));

vi.mock('@/lib/stores/brewingNoteStore', () => ({
  getBrewingNoteStore: vi.fn(() => ({ setNotes: vi.fn() })),
}));

vi.mock('@/lib/stores/customEquipmentStore', () => ({
  getCustomEquipmentStore: vi.fn(() => ({ setEquipments: vi.fn() })),
}));

vi.mock('@/lib/stores/customMethodStore', () => ({
  getCustomMethodStore: vi.fn(() => ({
    loadMethods: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('@/lib/stores/grinderStore', () => ({
  getGrinderStore: vi.fn(() => ({
    refreshGrinders: vi.fn(() => Promise.resolve()),
    setGrinders: vi.fn(),
  })),
}));

vi.mock('@/lib/stores/syncStatusStore', () => ({
  useSyncStatusStore: {
    getState: () => ({ reset: vi.fn() }),
    setState: vi.fn(),
  },
}));

vi.mock('@/lib/supabase/realtime', () => ({
  getRealtimeSyncService: () => ({
    disconnect: vi.fn(() => Promise.resolve()),
  }),
}));

vi.mock('@/lib/utils/coffeeBeanUtils', () => ({
  normalizeCoffeeBeans: mocks.normalizeCoffeeBeans,
}));

vi.mock('@/lib/app/dataIntegrity', () => ({
  markExpectedCoreDataMutation: vi.fn(),
}));

vi.mock('@/lib/utils/roasterMigration', () => ({
  migrateRoasterField: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/data/repositories', () => ({
  appSettingsRepository: {
    clear: mocks.clearAppSettings,
    save: vi.fn(() => Promise.resolve()),
  },
  brewingNoteRepository: {},
  coffeeBeanRepository: {},
  customEquipmentRepository: { clear: mocks.clearCustomEquipments },
  customMethodRepository: { clear: mocks.clearCustomMethods },
  grinderRepository: {
    clear: mocks.clearGrinders,
    replaceAll: mocks.replaceGrinders,
  },
  legacySettingsRepository: {
    clear: mocks.clearLegacySettings,
  },
  imageSourcePayloadValidator: {
    validateCoffeeBeans: mocks.validateCoffeeBeans,
    validateBrewingNotes: mocks.validateBrewingNotes,
  },
  coffeeBeanImageRepository: {
    exportAll: mocks.exportCoffeeBeansWithImages,
    getRecordCounts: vi.fn(() =>
      Promise.resolve({ records: 0, thumbnails: 0 })
    ),
  },
  coffeeBeanPersistence: {
    replaceAllWithImages: mocks.replaceCoffeeBeansWithSplitImages,
    clearWithImages: vi.fn(),
  },
  brewingNoteImageRepository: {
    exportAll: mocks.exportBrewingNotesWithImages,
    getRecordCounts: vi.fn(() =>
      Promise.resolve({ records: 0, thumbnails: 0 })
    ),
  },
  brewingNotePersistence: {
    replaceAllWithImages: mocks.replaceBrewingNotesWithSplitImages,
    clearWithImages: vi.fn(),
  },
}));

vi.mock('@/lib/app/crashDiagnostics', () => ({
  recordCrashOperationStep: vi.fn(),
}));

import { DataManager } from './dataManager';

describe('DataManager.exportAllData upgrade snapshot', () => {
  it('uses the normal backup format without querying uninitialized core repositories or duplicating source data', async () => {
    vi.clearAllMocks();
    const snapshot = {
      coffeeBeans: [{ id: 'bean-1', image: 'data:image/png;base64,AQID' }],
      brewingNotes: [
        {
          id: 'note-1',
          images: ['data:image/png;base64,BAUG'],
          coffeeBean: { id: 'bean-1', image: 'duplicate-image' },
        },
      ],
      customEquipments: [],
      grinders: [],
      brewGuideSettings: { roasterConfigs: [{ id: 'roaster-1' }] },
      customMethodsByEquipment: { v60: [{ id: 'method-1' }] },
    };
    const backup = JSON.parse(await DataManager.exportAllData({ snapshot }));
    expect(Object.keys(backup).sort()).toEqual([
      'appVersion',
      'data',
      'exportDate',
      'timeZone',
    ]);
    expect(backup.data.coffeeBeans).toEqual(snapshot.coffeeBeans);
    expect(backup.data.brewingNotes).toEqual([
      { id: 'note-1', images: ['data:image/png;base64,BAUG'] },
    ]);
    expect(backup.data.customMethodsByEquipment).toEqual(
      snapshot.customMethodsByEquipment
    );
    expect(backup.data.roasterConfigs).toEqual(
      snapshot.brewGuideSettings.roasterConfigs
    );
    expect(mocks.exportCoffeeBeansWithImages).not.toHaveBeenCalled();
    expect(mocks.exportBrewingNotesWithImages).not.toHaveBeenCalled();
    expect(snapshot.brewingNotes[0].coffeeBean).toBeDefined();
  });
});

describe('DataManager.importAllData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports notes and beans through explicit IndexedDB replacement flows', async () => {
    const result = await DataManager.importAllData(
      JSON.stringify({
        exportDate: '2026-07-04T00:00:00.000+08:00',
        data: {
          brewingNotes: [
            { id: 'note-1', timestamp: 1 },
            { id: 'note-null-rating', timestamp: 2, rating: null },
          ],
          coffeeBeans: [{ id: 'bean-1', timestamp: 1, name: 'Bean' }],
        },
      })
    );

    expect(result.success).toBe(true);
    expect(mocks.validateCoffeeBeans).toHaveBeenCalledWith([
      { id: 'bean-1', timestamp: 1, name: 'Bean' },
    ]);
    expect(mocks.validateBrewingNotes).toHaveBeenCalledWith([
      { id: 'note-1', timestamp: 1 },
      { id: 'note-null-rating', timestamp: 2, rating: null },
    ]);
    expect(mocks.storageSet).not.toHaveBeenCalledWith(
      'brewingNotes',
      expect.any(String)
    );
    expect(mocks.storageSet).not.toHaveBeenCalledWith(
      'coffeeBeans',
      expect.any(String)
    );
    expect(mocks.replaceBrewingNotesWithSplitImages).toHaveBeenCalledWith(
      [
        { id: 'note-1', timestamp: 1 },
        { id: 'note-null-rating', timestamp: 2, rating: null },
      ],
      { allowDestructiveReplace: true }
    );
    expect(mocks.replaceCoffeeBeansWithSplitImages).toHaveBeenCalledWith(
      [{ id: 'bean-1', timestamp: 1, name: 'Bean' }],
      { allowDestructiveReplace: true }
    );
  });

  it('preserves legacy null image fields in Web imports', async () => {
    const coffeeBeans = [
      {
        id: 'bean-1',
        timestamp: 1,
        name: 'Bean',
        image: null,
        backImage: null,
      },
    ];
    const result = await DataManager.importAllData(
      JSON.stringify({ data: { coffeeBeans } })
    );
    expect(result.success).toBe(true);
    expect(mocks.validateCoffeeBeans).toHaveBeenCalledWith(coffeeBeans);
    expect(mocks.replaceCoffeeBeansWithSplitImages).toHaveBeenCalledWith(
      coffeeBeans,
      { allowDestructiveReplace: true }
    );
  });

  it('preflights all image-bearing sections before replacing either table', async () => {
    mocks.validateBrewingNotes.mockRejectedValueOnce(
      new Error('invalid BrewingNote image source')
    );

    const result = await DataManager.importAllData(
      JSON.stringify({
        data: {
          coffeeBeans: [
            { id: 'bean-1', timestamp: 1, image: 'data:image/png;base64,AQ==' },
          ],
          brewingNotes: [{ id: 'note-1', timestamp: 1, image: 'blob:invalid' }],
        },
      })
    );

    expect(result.success).toBe(false);
    expect(mocks.replaceCoffeeBeansWithSplitImages).not.toHaveBeenCalled();
    expect(mocks.replaceBrewingNotesWithSplitImages).not.toHaveBeenCalled();
  });

  it('restores grinder records through the grinder repository', async () => {
    const grinders = [{ id: 'c40', name: 'C40', grindSizeHistory: [] }];

    const result = await DataManager.importAllData(
      JSON.stringify({ data: { grinders } })
    );

    expect(result.success).toBe(true);
    expect(mocks.replaceGrinders).toHaveBeenCalledWith(grinders);
  });
});

describe('DataManager.resetAllData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears legacy settings separately from appSettings', async () => {
    const result = await DataManager.resetAllData();

    expect(result.success).toBe(true);
    expect(mocks.clearLegacySettings).toHaveBeenCalledOnce();
    expect(mocks.clearAppSettings).toHaveBeenCalledOnce();
  });
});
