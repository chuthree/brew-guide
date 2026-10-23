import type {
  LegacyHistoricalData,
  LegacyMigrationData,
  LegacySourceTableName,
} from '@/lib/data/legacy/legacyDexieReader';
import {
  LEGACY_LOCAL_STORAGE_MIGRATION_KEYS,
  readLegacyLocalStorageSnapshot,
  type LegacyLocalStorageSnapshot,
} from '@/lib/data/legacy/legacyLocalStorageReader';
import type { LegacyMigrationSource } from './legacyMigrationPlan';

const SOURCE_TABLES: LegacySourceTableName[] = [
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
];

function emptyMigrationData(): LegacyMigrationData {
  return Object.fromEntries(
    SOURCE_TABLES.map(name => [name, { status: 'absent', records: [] }])
  ) as unknown as LegacyMigrationData;
}

function emptyHistoricalData(): LegacyHistoricalData {
  return { yearlyReports: { status: 'absent', records: [] } };
}

/** Only use after the platform proves that no legacy source exists. */
export function createAbsentLegacyMigrationSource(): LegacyMigrationSource {
  return {
    info: null,
    active: emptyMigrationData(),
    historical: emptyHistoricalData(),
    localStorage: readLegacyLocalStorageSnapshot({ getItem: () => null }),
  };
}

export async function readLegacyMigrationSource(
  storage: Pick<Storage, 'getItem'>
): Promise<LegacyMigrationSource> {
  const localStorage: LegacyLocalStorageSnapshot =
    readLegacyLocalStorageSnapshot(storage);
  const { openLegacyDexieReader } =
    await import('@/lib/data/legacy/legacyDexieReader');
  const opened = await openLegacyDexieReader();

  if (!opened.exists) {
    return {
      info: null,
      active: emptyMigrationData(),
      historical: emptyHistoricalData(),
      localStorage,
    };
  }

  const reader = opened.reader;
  try {
    return {
      info: reader.inspect(),
      active: await reader.readMigrationData(),
      historical: await reader.readHistoricalData(),
      localStorage,
    };
  } finally {
    reader.close();
  }
}

export function hasLegacyMigrationSourceData(
  source: LegacyMigrationSource
): boolean {
  return (
    source.info !== null ||
    LEGACY_LOCAL_STORAGE_MIGRATION_KEYS.some(key => {
      const value = source.localStorage[key];
      return value !== null && value !== '';
    })
  );
}
