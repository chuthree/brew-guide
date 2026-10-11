/**
 * LocalStorage keys read by the historical Dexie startup migration. This
 * reader is intentionally limited to those migration sources and never writes
 * to or removes data from LocalStorage.
 */
export const LEGACY_LOCAL_STORAGE_MIGRATION_KEYS = [
  'brewGuideSettings',
  'roaster-logos',
  'customFlavorDimensions',
  'flavorDimensionHistoricalLabels',
  'equipmentOrder',
] as const;

export type LegacyLocalStorageMigrationKey =
  (typeof LEGACY_LOCAL_STORAGE_MIGRATION_KEYS)[number];

export type LegacyLocalStorageSnapshot = Record<
  LegacyLocalStorageMigrationKey,
  string | null
>;

/** Read the legacy migration keys exactly as stored, without parsing them. */
export function readLegacyLocalStorageSnapshot(
  storage: Pick<Storage, 'getItem'>
): LegacyLocalStorageSnapshot {
  return Object.fromEntries(
    LEGACY_LOCAL_STORAGE_MIGRATION_KEYS.map(key => [key, storage.getItem(key)])
  ) as LegacyLocalStorageSnapshot;
}
