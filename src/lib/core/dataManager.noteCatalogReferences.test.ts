import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const storageSet = vi.fn(async (key: string) => {
    if (key === 'brewingNotes' || key === 'coffeeBeans') {
      throw new Error(
        `${key} 不支持通过 Storage.set 写入，请使用 DataManager 的显式导入流程`
      );
    }
  });

  return {
    runtime: 'web' as 'web' | 'tauri',
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
    runtime: mocks.runtime,
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

const fixture = () => ({
  id: 'synthetic-reference-note',
  timestamp: 1_792_641_600_000,
  equipment: 'custom-cone',
  method: 'Three pours',
  equipmentId: 'custom-cone',
  methodId: 'method-stable',
  equipmentName: 'Original cone name',
  methodName: 'Original three pours',
  params: { coffee: '10g' },
  rating: 0,
  taste: {},
  notes: '',
  futureMetadata: { preserved: true },
});

describe('note catalog references in canonical backup/import', () => {
  it('exports and imports IDs, snapshots and only the measured parameters unchanged', async () => {
    vi.clearAllMocks();
    const note = fixture();
    const json = await DataManager.exportAllData({
      snapshot: { brewingNotes: [note] },
    });
    expect(JSON.parse(json).data.brewingNotes).toEqual([note]);
    const result = await DataManager.importAllData(json);
    expect(result.success).toBe(true);
    expect(mocks.replaceBrewingNotesWithSplitImages).toHaveBeenCalledWith(
      [note],
      { allowDestructiveReplace: true }
    );
    expect(mocks.validateBrewingNotes).toHaveBeenCalledWith([note]);
  });

  it('preserves explicit null refs and free labels through JSON backup without auto-creating catalog records', async () => {
    vi.clearAllMocks();
    const note = {
      ...fixture(),
      equipmentId: null,
      methodId: null,
      equipment: 'Travel dripper',
      equipmentName: 'Travel dripper',
      method: 'My pour',
      methodName: 'My pour',
    };
    const json = await DataManager.exportAllData({
      snapshot: { brewingNotes: [note] },
    });
    expect(JSON.parse(json).data.brewingNotes).toEqual([note]);
    const result = await DataManager.importAllData(json);
    expect(result.success).toBe(true);
    expect(mocks.replaceBrewingNotesWithSplitImages).toHaveBeenCalledWith(
      [note],
      { allowDestructiveReplace: true }
    );
    expect(mocks.clearCustomEquipments).not.toHaveBeenCalled();
    expect(mocks.clearCustomMethods).not.toHaveBeenCalled();
  });

  it('leaves legacy absent reference fields absent while removing only the redundant bean cache', async () => {
    vi.clearAllMocks();
    const legacy = {
      id: 'legacy-note',
      timestamp: 1,
      equipment: 'V60',
      method: '三段式',
      params: { coffee: '10g' },
      rating: 0,
      taste: {},
      notes: '',
    };
    const input = { ...legacy, coffeeBean: { id: 'cached-bean' } };
    const json = await DataManager.exportAllData({
      snapshot: { brewingNotes: [input] },
    });
    expect(JSON.parse(json).data.brewingNotes).toEqual([legacy]);
    expect(input).toHaveProperty('coffeeBean');
    const result = await DataManager.importAllData(json);
    expect(result.success).toBe(true);
    expect(mocks.replaceBrewingNotesWithSplitImages).toHaveBeenCalledWith(
      [legacy],
      { allowDestructiveReplace: true }
    );
  });
  it('native import adds missing legacy rating without stripping hybrid metadata', async () => {
    vi.clearAllMocks();
    mocks.runtime = 'tauri';
    try {
      const note = { ...fixture(), methodId: null, rating: null };
      const result = await DataManager.importAllData(
        JSON.stringify({ data: { brewingNotes: [note] } })
      );
      expect(result.success).toBe(true);
      expect(mocks.replaceBrewingNotesWithSplitImages).toHaveBeenCalledWith(
        [{ ...note, rating: 0 }],
        { allowDestructiveReplace: true }
      );
      expect(note.rating).toBeNull();
    } finally {
      mocks.runtime = 'web';
    }
  });
});
