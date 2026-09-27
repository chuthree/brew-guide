import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openResult: null as unknown,
  openError: null as unknown,
}));

vi.mock('@/lib/data/legacy/legacyDexieReader', () => ({
  openLegacyDexieReader: async () => {
    if (mocks.openError) throw mocks.openError;
    return mocks.openResult;
  },
}));

import {
  hasLegacyMigrationSourceData,
  readLegacyMigrationSource,
} from './legacyMigrationSource';

const localStorageValues = {
  brewGuideSettings: null,
  'roaster-logos': null,
  customFlavorDimensions: null,
  flavorDimensionHistoricalLabels: null,
  equipmentOrder: null,
} as const;

describe('readLegacyMigrationSource', () => {
  beforeEach(() => {
    mocks.openResult = null;
    mocks.openError = null;
  });

  it('returns explicit absent tables when BrewGuideDB does not exist', async () => {
    mocks.openResult = { exists: false };
    const getItem = vi.fn((key: keyof typeof localStorageValues) => {
      return localStorageValues[key];
    });

    const source = await readLegacyMigrationSource({ getItem });

    expect(source.info).toBeNull();
    expect(
      Object.values(source.active).every(row => row.status === 'absent')
    ).toBe(true);
    expect(source.historical.yearlyReports).toEqual({
      status: 'absent',
      records: [],
    });
    expect(hasLegacyMigrationSourceData(source)).toBe(false);
    expect(getItem).toHaveBeenCalledTimes(5);
  });

  it('reads and closes the independent LegacyDexieReader', async () => {
    const info = {
      exists: true as const,
      version: 8,
      tables: [],
      absentSourceTables: [],
    };
    const active = Object.fromEntries(
      [
        'coffeeBeans',
        'brewingNotes',
        'coffeeBeanImages',
        'coffeeBeanImageThumbnails',
        'brewingNoteImages',
        'brewingNoteImageThumbnails',
        'customEquipments',
        'customMethods',
        'grinders',
        'appSettings',
        'settings',
        'pendingOperations',
      ].map(name => [name, { status: 'absent', records: [] }])
    );
    const historical = { yearlyReports: { status: 'absent', records: [] } };
    const close = vi.fn();
    const reader = {
      inspect: vi.fn(() => info),
      readMigrationData: vi.fn(async () => active),
      readHistoricalData: vi.fn(async () => historical),
      close,
    };
    mocks.openResult = { exists: true, reader };

    const source = await readLegacyMigrationSource({
      getItem: () => null,
    });

    expect(source.info).toBe(info);
    expect(source.active).toBe(active);
    expect(source.historical).toBe(historical);
    expect(reader.inspect).toHaveBeenCalledOnce();
    expect(reader.readMigrationData).toHaveBeenCalledOnce();
    expect(reader.readHistoricalData).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
    expect(hasLegacyMigrationSourceData(source)).toBe(true);
  });

  it('closes the reader even when a read fails', async () => {
    const close = vi.fn();
    mocks.openResult = {
      exists: true,
      reader: {
        inspect: () => ({
          exists: true,
          version: 8,
          tables: [],
          absentSourceTables: [],
        }),
        readMigrationData: async () => {
          throw new Error('read failed');
        },
        readHistoricalData: async () => ({
          yearlyReports: { status: 'absent', records: [] },
        }),
        close,
      },
    };

    await expect(
      readLegacyMigrationSource({ getItem: () => null })
    ).rejects.toThrow('read failed');
    expect(close).toHaveBeenCalledOnce();
  });
});
