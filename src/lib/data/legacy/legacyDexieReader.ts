import Dexie, { type IndexSpec } from 'dexie';

const LEGACY_DATABASE_NAME = 'BrewGuideDB';

const LEGACY_SOURCE_TABLES = [
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
] as const;

export type LegacySourceTableName = (typeof LEGACY_SOURCE_TABLES)[number];

/** A historical source that is not part of the current migration targets. */
export type LegacyHistoricalTableName = 'yearlyReports';

export interface LegacyIndexInfo {
  name: string | null;
  keyPath: string | string[] | null;
  source: string;
  autoIncrement: boolean;
  unique: boolean;
  multiEntry: boolean;
}

export interface LegacyTableInfo {
  name: string;
  primaryKey: LegacyIndexInfo;
  indexes: LegacyIndexInfo[];
}

export interface LegacyDatabaseInfo {
  exists: true;
  version: number;
  tables: LegacyTableInfo[];
  absentSourceTables: LegacySourceTableName[];
}

export interface LegacyTableReadResult {
  status: 'present' | 'absent';
  records: Record<string, unknown>[];
}

/** Raw records from a historical store; no current domain model is applied. */
export interface LegacyRawTableReadResult {
  status: 'present' | 'absent';
  records: unknown[];
}

export type LegacyMigrationData = Record<
  LegacySourceTableName,
  LegacyTableReadResult
>;

/** Historical-only sources kept separate from the active migration targets. */
export interface LegacyHistoricalData {
  yearlyReports: LegacyRawTableReadResult;
}

export interface LegacyDexieReaderHandle {
  inspect(): LegacyDatabaseInfo;
  readTable(tableName: LegacySourceTableName): Promise<LegacyTableReadResult>;
  readMigrationData(): Promise<LegacyMigrationData>;
  readHistoricalData(): Promise<LegacyHistoricalData>;
  close(): void;
}

export type OpenLegacyDexieReaderResult =
  | { exists: false }
  | { exists: true; reader: LegacyDexieReaderHandle };

function toIndexInfo(index: IndexSpec): LegacyIndexInfo {
  return {
    name: index.name ?? null,
    keyPath: index.keyPath ?? null,
    source: index.src,
    autoIncrement: index.auto ?? false,
    unique: index.unique ?? false,
    multiEntry: index.multi ?? false,
  };
}

function emptyReadResult(status: LegacyTableReadResult['status']) {
  return { status, records: [] } satisfies LegacyTableReadResult;
}

class DexieLegacyReader implements LegacyDexieReaderHandle {
  private closed = false;

  constructor(private readonly database: Dexie) {}

  inspect(): LegacyDatabaseInfo {
    this.assertOpen();

    const tables = this.database.tables.map(table => ({
      name: table.name,
      primaryKey: toIndexInfo(table.schema.primKey),
      indexes: table.schema.indexes.map(toIndexInfo),
    }));
    const tableNames = new Set(tables.map(({ name }) => name));

    return {
      exists: true,
      version: this.database.verno,
      tables,
      absentSourceTables: LEGACY_SOURCE_TABLES.filter(
        tableName => !tableNames.has(tableName)
      ),
    };
  }

  async readTable(
    tableName: LegacySourceTableName
  ): Promise<LegacyTableReadResult> {
    const result = await this.readRawTable(tableName);
    return {
      status: result.status,
      records: result.records as Record<string, unknown>[],
    };
  }

  async readMigrationData(): Promise<LegacyMigrationData> {
    this.assertOpen();

    const availableTables = this.database.tables.filter(({ name }) =>
      LEGACY_SOURCE_TABLES.includes(name as LegacySourceTableName)
    );
    const recordsByTable = new Map<string, Record<string, unknown>[]>();

    if (availableTables.length > 0) {
      const tableRecords = await this.database.transaction(
        'r',
        availableTables,
        () => Promise.all(availableTables.map(table => table.toArray()))
      );

      availableTables.forEach((table, index) => {
        recordsByTable.set(table.name, tableRecords[index]);
      });
    }

    return Object.fromEntries(
      LEGACY_SOURCE_TABLES.map(tableName => {
        const records = recordsByTable.get(tableName);
        return [
          tableName,
          records ? { status: 'present', records } : emptyReadResult('absent'),
        ];
      })
    ) as LegacyMigrationData;
  }

  async readHistoricalData(): Promise<LegacyHistoricalData> {
    return {
      yearlyReports: await this.readRawTable('yearlyReports'),
    };
  }

  close(): void {
    if (this.closed) return;
    this.database.close();
    this.closed = true;
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new Error('Legacy Dexie reader has already been closed');
    }
  }

  private async readRawTable(
    tableName: LegacySourceTableName | LegacyHistoricalTableName
  ): Promise<LegacyRawTableReadResult> {
    this.assertOpen();

    const table = this.database.tables.find(({ name }) => name === tableName);
    if (!table) return { status: 'absent', records: [] };

    const records = await this.database.transaction('r', table, () =>
      table.toArray()
    );

    return { status: 'present', records };
  }
}

/**
 * Opens the existing BrewGuideDB without declaring a schema or running an
 * application migration. A missing database is reported without opening it.
 */
export async function openLegacyDexieReader(): Promise<OpenLegacyDexieReaderResult> {
  if (!(await Dexie.exists(LEGACY_DATABASE_NAME))) {
    return { exists: false };
  }

  const database = new Dexie(LEGACY_DATABASE_NAME, {
    autoOpen: false,
    allowEmptyDB: false,
  });

  try {
    // No version() or stores() calls: Dexie opens the installed schema in
    // Dynamic Mode and reports its actual version and object stores.
    await database.open();
    return { exists: true, reader: new DexieLegacyReader(database) };
  } catch (error) {
    database.close();
    throw error;
  }
}
