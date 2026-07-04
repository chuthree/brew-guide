import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const storageSet = vi.fn(async (key: string) => {
    if (key === 'brewingNotes' || key === 'coffeeBeans') {
      throw new Error(
        `${key} 不支持通过 Storage.set 写入，请使用 DataManager 的显式导入流程`
      );
    }
  });

  const table = () => ({
    clear: vi.fn(() => Promise.resolve()),
    bulkPut: vi.fn(() => Promise.resolve()),
    toArray: vi.fn(() => Promise.resolve([])),
    count: vi.fn(() => Promise.resolve(0)),
    put: vi.fn(() => Promise.resolve()),
  });

  return {
    storageSet,
    normalizeCoffeeBeans: vi.fn((beans: unknown[]) => beans),
    replaceCoffeeBeansWithSplitImages: vi.fn(() => Promise.resolve(true)),
    replaceBrewingNotesWithSplitImages: vi.fn(() => Promise.resolve(true)),
    db: {
      coffeeBeans: table(),
      coffeeBeanImages: table(),
      coffeeBeanImageThumbnails: table(),
      brewingNotes: table(),
      brewingNoteImages: table(),
      brewingNoteImageThumbnails: table(),
      customEquipments: table(),
      customMethods: table(),
      grinders: table(),
      appSettings: table(),
      settings: table(),
    },
  };
});

vi.mock('@/lib/core/config', () => ({
  APP_VERSION: 'test',
}));

vi.mock('@/lib/core/db', () => ({
  db: mocks.db,
}));

vi.mock('@/lib/core/storage', () => ({
  Storage: {
    set: mocks.storageSet,
    get: vi.fn(() => Promise.resolve(null)),
    keys: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('@/lib/stores/settingsStore', () => ({
  getRoasterConfigsSync: vi.fn(() => []),
  getSettingsStore: vi.fn(() => ({
    settings: {},
    importSettings: vi.fn(() => Promise.resolve()),
    updateRoasterConfig: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('@/lib/stores/coffeeBeanStore', () => ({
  getCoffeeBeanStore: vi.fn(() => ({
    refreshBeans: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('@/lib/stores/grinderStore', () => ({
  getGrinderStore: vi.fn(() => ({
    refreshGrinders: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('@/lib/utils/coffeeBeanUtils', () => ({
  normalizeCoffeeBeans: mocks.normalizeCoffeeBeans,
}));

vi.mock('@/lib/coffee-beans/imageRepository', () => ({
  exportCoffeeBeansWithImages: vi.fn(() => Promise.resolve([])),
  replaceCoffeeBeansWithSplitImages: mocks.replaceCoffeeBeansWithSplitImages,
}));

vi.mock('@/lib/notes/imageRepository', () => ({
  exportBrewingNotesWithImages: vi.fn(() => Promise.resolve([])),
  replaceBrewingNotesWithSplitImages: mocks.replaceBrewingNotesWithSplitImages,
}));

vi.mock('@/lib/app/crashDiagnostics', () => ({
  recordCrashOperationStep: vi.fn(),
}));

import { DataManager } from './dataManager';

describe('DataManager.importAllData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('imports notes and beans through explicit IndexedDB replacement flows', async () => {
    const result = await DataManager.importAllData(
      JSON.stringify({
        exportDate: '2026-07-04T00:00:00.000+08:00',
        data: {
          brewingNotes: [{ id: 'note-1', timestamp: 1 }],
          coffeeBeans: [{ id: 'bean-1', timestamp: 1, name: 'Bean' }],
        },
      })
    );

    expect(result.success).toBe(true);
    expect(mocks.storageSet).not.toHaveBeenCalledWith(
      'brewingNotes',
      expect.any(String)
    );
    expect(mocks.storageSet).not.toHaveBeenCalledWith(
      'coffeeBeans',
      expect.any(String)
    );
    expect(mocks.replaceBrewingNotesWithSplitImages).toHaveBeenCalledWith(
      [{ id: 'note-1', timestamp: 1 }],
      { allowDestructiveReplace: true }
    );
    expect(mocks.replaceCoffeeBeansWithSplitImages).toHaveBeenCalledWith(
      [{ id: 'bean-1', timestamp: 1, name: 'Bean' }],
      { allowDestructiveReplace: true }
    );
  });
});
