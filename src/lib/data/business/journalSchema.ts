/** Device-local operational state: never migrated, exported or synced as user data. */
export const BUSINESS_JOURNAL_SCHEMA = {
  businessOperations: 'requestId, createdAt',
  businessPublications: 'requestId, createdAt',
} as const;

export const BUSINESS_JOURNAL_SCHEMA_VERSION = 12;

/** Ignore only the known journal schema; a similarly named user-data table fails closed. */
export function isKnownLocalBusinessJournal(
  version: number,
  table: {
    name: string;
    primaryKey: {
      keyPath: string | string[] | null;
      autoIncrement: boolean;
      multiEntry: boolean;
    };
    indexes: Array<{
      name: string | null;
      keyPath: string | string[] | null;
      unique: boolean;
      multiEntry: boolean;
    }>;
  }
): boolean {
  return (
    version >= BUSINESS_JOURNAL_SCHEMA_VERSION &&
    Object.prototype.hasOwnProperty.call(BUSINESS_JOURNAL_SCHEMA, table.name) &&
    table.primaryKey.keyPath === 'requestId' &&
    !table.primaryKey.autoIncrement &&
    !table.primaryKey.multiEntry &&
    table.indexes.length === 1 &&
    table.indexes[0].name === 'createdAt' &&
    table.indexes[0].keyPath === 'createdAt' &&
    !table.indexes[0].unique &&
    !table.indexes[0].multiEntry
  );
}
