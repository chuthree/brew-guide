import type { SqliteDriver, SqliteExecutor, SqlRow } from './driver';
import { SQLITE_SCHEMA_V1_STATEMENTS, SQLITE_SCHEMA_VERSION } from './schemaV1';

export const SQLITE_V1_TABLES = [
  'coffee_beans',
  'brewing_notes',
  'custom_equipments',
  'custom_methods',
  'grinders',
  'app_settings',
  'legacy_settings',
  'pending_operations',
  'historical_yearly_reports',
  'coffee_bean_images',
  'brewing_note_images',
  'migration_state',
] as const;

const REQUIRED_INDEXES = {
  idx_brewing_notes_bean_timestamp_id: ['bean_id', 'timestamp_ms', 'id'],
  idx_pending_operations_table_record: ['table_name', 'record_id'],
  idx_pending_operations_timestamp_id: ['timestamp_ms', 'id'],
} as const;

const REQUIRED_UNIQUE_INDEXES = {
  coffee_bean_images: [['bean_id', 'slot', 'variant']],
  brewing_note_images: [['note_id', 'position', 'variant']],
} as const;

type ColumnContract = readonly [
  name: string,
  type: 'TEXT' | 'INTEGER',
  notNull: 0 | 1,
  primaryKey: 0 | 1,
];

const REQUIRED_COLUMNS: Record<string, readonly ColumnContract[]> = {
  coffee_beans: [
    ['id', 'TEXT', 1, 1],
    ['timestamp_ms', 'INTEGER', 1, 0],
    ['record_json', 'TEXT', 1, 0],
  ],
  brewing_notes: [
    ['id', 'TEXT', 1, 1],
    ['timestamp_ms', 'INTEGER', 1, 0],
    ['updated_at_ms', 'INTEGER', 0, 0],
    ['bean_id', 'TEXT', 0, 0],
    ['record_json', 'TEXT', 1, 0],
  ],
  custom_equipments: [
    ['id', 'TEXT', 1, 1],
    ['record_json', 'TEXT', 1, 0],
  ],
  custom_methods: [
    ['equipment_id', 'TEXT', 1, 1],
    ['methods_json', 'TEXT', 1, 0],
    ['extra_json', 'TEXT', 1, 0],
  ],
  grinders: [
    ['id', 'TEXT', 1, 1],
    ['record_json', 'TEXT', 1, 0],
  ],
  app_settings: [
    ['id', 'TEXT', 1, 1],
    ['data_json', 'TEXT', 1, 0],
  ],
  legacy_settings: [
    ['key', 'TEXT', 1, 1],
    ['value', 'TEXT', 1, 0],
  ],
  pending_operations: [
    ['id', 'TEXT', 1, 1],
    ['table_name', 'TEXT', 1, 0],
    ['operation_type', 'TEXT', 1, 0],
    ['record_id', 'TEXT', 1, 0],
    ['timestamp_ms', 'INTEGER', 1, 0],
    ['retry_count', 'INTEGER', 1, 0],
    ['last_error', 'TEXT', 0, 0],
    ['failed_at_ms', 'INTEGER', 0, 0],
    ['data_json', 'TEXT', 0, 0],
    ['extra_json', 'TEXT', 1, 0],
  ],
  historical_yearly_reports: [
    ['id', 'TEXT', 1, 1],
    ['year', 'INTEGER', 1, 0],
    ['username', 'TEXT', 1, 0],
    ['content', 'TEXT', 1, 0],
    ['created_at_ms', 'INTEGER', 1, 0],
    ['extra_json', 'TEXT', 1, 0],
  ],
  coffee_bean_images: [
    ['image_id', 'TEXT', 1, 1],
    ['bean_id', 'TEXT', 1, 0],
    ['slot', 'TEXT', 1, 0],
    ['variant', 'TEXT', 1, 0],
    ['relative_path', 'TEXT', 1, 0],
    ['mime_type', 'TEXT', 1, 0],
    ['size_bytes', 'INTEGER', 1, 0],
    ['sha256', 'TEXT', 0, 0],
    ['updated_at_ms', 'INTEGER', 0, 0],
  ],
  brewing_note_images: [
    ['image_id', 'TEXT', 1, 1],
    ['note_id', 'TEXT', 1, 0],
    ['position', 'INTEGER', 1, 0],
    ['variant', 'TEXT', 1, 0],
    ['relative_path', 'TEXT', 1, 0],
    ['mime_type', 'TEXT', 1, 0],
    ['size_bytes', 'INTEGER', 1, 0],
    ['sha256', 'TEXT', 0, 0],
    ['updated_at_ms', 'INTEGER', 0, 0],
  ],
  migration_state: [
    ['id', 'TEXT', 1, 1],
    ['status', 'TEXT', 1, 0],
    ['source_presence_json', 'TEXT', 1, 0],
    ['details_json', 'TEXT', 1, 0],
  ],
};

export interface SqliteBootstrapReport {
  created: boolean;
  userVersion: number;
  tables: string[];
  journalModeBefore: string;
  journalMode: string;
  synchronous: number;
  foreignKeys: number;
  busyTimeout: number;
}

export class SqliteSchemaBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SqliteSchemaBootstrapError';
  }
}

function onlyValue(row: SqlRow | undefined, pragma: string): string | number {
  if (!row) throw new SqliteSchemaBootstrapError(`${pragma} returned no row`);
  const values = Object.values(row);
  const value = values[0];
  if (
    values.length !== 1 ||
    (typeof value !== 'string' && typeof value !== 'number')
  ) {
    throw new SqliteSchemaBootstrapError(`${pragma} returned an invalid value`);
  }
  return value;
}

async function readPragmaValue(
  executor: SqliteExecutor,
  pragma: string
): Promise<string | number> {
  const rows = await executor.query(`PRAGMA ${pragma}`);
  return onlyValue(rows[0], pragma);
}

async function readUserVersion(executor: SqliteExecutor): Promise<number> {
  const version = await readPragmaValue(executor, 'user_version');
  if (
    typeof version !== 'number' ||
    !Number.isSafeInteger(version) ||
    version < 0
  ) {
    throw new SqliteSchemaBootstrapError(
      `PRAGMA user_version returned an invalid value: ${String(version)}`
    );
  }
  return version;
}

async function readTableNames(executor: SqliteExecutor): Promise<string[]> {
  const rows = await executor.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const names = rows.map(row => row.name);
  if (names.some(name => typeof name !== 'string')) {
    throw new SqliteSchemaBootstrapError(
      'sqlite_master returned a table without a string name'
    );
  }
  return names as string[];
}

function assertExpectedTables(actual: readonly string[]): void {
  const actualSet = new Set(actual);
  const missing = SQLITE_V1_TABLES.filter(name => !actualSet.has(name));
  const expected = new Set<string>(SQLITE_V1_TABLES);
  const unexpected = actual.filter(name => !expected.has(name));
  if (missing.length || unexpected.length) {
    throw new SqliteSchemaBootstrapError(
      `SQLite schema drift: missing tables [${missing.join(', ')}], unexpected tables [${unexpected.join(', ')}]`
    );
  }
}

function requiredInteger(row: SqlRow, key: string, context: string): number {
  const value = row[key];
  if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
    throw new SqliteSchemaBootstrapError(
      `${context} returned invalid ${key}: ${String(value)}`
    );
  }
  return value;
}

async function validateColumns(
  executor: SqliteExecutor,
  table: string
): Promise<void> {
  const rows = await executor.query(`PRAGMA table_info(${table})`);
  const expected = REQUIRED_COLUMNS[table];
  if (rows.length !== expected.length) {
    throw new SqliteSchemaBootstrapError(
      `SQLite schema drift: ${table} has ${rows.length} columns; expected ${expected.length}`
    );
  }
  rows.forEach((row, index) => {
    const [name, type, notNull, primaryKey] = expected[index];
    if (
      row.name !== name ||
      row.type !== type ||
      requiredInteger(row, 'notnull', `${table} column ${name}`) !== notNull ||
      requiredInteger(row, 'pk', `${table} column ${name}`) !== primaryKey
    ) {
      throw new SqliteSchemaBootstrapError(
        `SQLite schema drift: ${table} column ${index} does not match the v1 contract`
      );
    }
  });
}

async function readIndexes(
  executor: SqliteExecutor,
  table: string
): Promise<Array<{ name: string; unique: number }>> {
  const rows = await executor.query(`PRAGMA index_list(${table})`);
  return rows.map(row => {
    if (typeof row.name !== 'string') {
      throw new SqliteSchemaBootstrapError(
        `PRAGMA index_list(${table}) returned an invalid index name`
      );
    }
    return {
      name: row.name,
      unique: requiredInteger(row, 'unique', `${table} index ${row.name}`),
    };
  });
}

async function readIndexColumns(
  executor: SqliteExecutor,
  name: string
): Promise<string[]> {
  const safeName = name.replaceAll('"', '""');
  const rows = await executor.query(`PRAGMA index_info("${safeName}")`);
  return rows
    .slice()
    .sort(
      (left, right) =>
        requiredInteger(left, 'seqno', `index ${name}`) -
        requiredInteger(right, 'seqno', `index ${name}`)
    )
    .map(row => {
      if (typeof row.name !== 'string') {
        throw new SqliteSchemaBootstrapError(
          `PRAGMA index_info(${name}) returned an invalid column name`
        );
      }
      return row.name;
    });
}

async function validateIndexes(executor: SqliteExecutor): Promise<void> {
  const declaredRows = await executor.query(
    "SELECT name FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_%'"
  );
  const declared = new Set(
    declaredRows
      .map(row => row.name)
      .filter((name): name is string => typeof name === 'string')
  );
  for (const [name, columns] of Object.entries(REQUIRED_INDEXES)) {
    if (!declared.has(name)) {
      throw new SqliteSchemaBootstrapError(
        `SQLite schema drift: required index ${name} is missing`
      );
    }
    const table = name.startsWith('idx_brewing_notes_')
      ? 'brewing_notes'
      : 'pending_operations';
    const listed = await readIndexes(executor, table);
    const index = listed.find(candidate => candidate.name === name);
    if (!index || index.unique !== 0) {
      throw new SqliteSchemaBootstrapError(
        `SQLite schema drift: required index ${name} has the wrong definition`
      );
    }
    const actualColumns = await readIndexColumns(executor, name);
    if (actualColumns.join('\0') !== columns.join('\0')) {
      throw new SqliteSchemaBootstrapError(
        `SQLite schema drift: required index ${name} has the wrong columns`
      );
    }
  }

  for (const [table, groups] of Object.entries(REQUIRED_UNIQUE_INDEXES)) {
    const listed = await readIndexes(executor, table);
    const uniqueIndexes = listed.filter(index => index.unique === 1);
    const actualGroups = await Promise.all(
      uniqueIndexes.map(index => readIndexColumns(executor, index.name))
    );
    for (const columns of groups) {
      if (
        !actualGroups.some(actual => actual.join('\0') === columns.join('\0'))
      ) {
        throw new SqliteSchemaBootstrapError(
          `SQLite schema drift: ${table} is missing UNIQUE (${columns.join(', ')})`
        );
      }
    }
  }
}

async function validateV1Schema(executor: SqliteExecutor): Promise<string[]> {
  const tables = await readTableNames(executor);
  assertExpectedTables(tables);
  for (const table of SQLITE_V1_TABLES) {
    await validateColumns(executor, table);
  }
  await validateIndexes(executor);
  return tables;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Configure PRAGMAs and create/validate the Brew Guide SQLite v1 schema. */
export async function bootstrapSqliteSchema(
  driver: SqliteDriver,
  schemaStatements: readonly string[] = SQLITE_SCHEMA_V1_STATEMENTS
): Promise<SqliteBootstrapReport> {
  const journalModeBefore = await readPragmaValue(driver, 'journal_mode');
  if (typeof journalModeBefore !== 'string') {
    throw new SqliteSchemaBootstrapError(
      `PRAGMA journal_mode returned an invalid value: ${String(journalModeBefore)}`
    );
  }

  // SQLiteDatabase.execSQL rejects PRAGMAs that return a result row. Android's
  // journal_mode setter does return one, so use the native query/rawQuery path.
  await driver.query('PRAGMA journal_mode = DELETE');
  const journalMode = await readPragmaValue(driver, 'journal_mode');
  if (
    typeof journalMode !== 'string' ||
    journalMode.toLowerCase() !== 'delete'
  ) {
    throw new SqliteSchemaBootstrapError(
      `SQLite journal mode must be DELETE; actual value: ${String(journalMode)}`
    );
  }

  await driver.execute('PRAGMA synchronous = FULL');
  const synchronous = await readPragmaValue(driver, 'synchronous');
  const busyTimeout = await readPragmaValue(driver, 'busy_timeout');
  const foreignKeys = await readPragmaValue(driver, 'foreign_keys');
  if (
    typeof synchronous !== 'number' ||
    synchronous !== 2 ||
    typeof busyTimeout !== 'number' ||
    !Number.isSafeInteger(busyTimeout) ||
    busyTimeout < 0 ||
    typeof foreignKeys !== 'number' ||
    (foreignKeys !== 0 && foreignKeys !== 1)
  ) {
    throw new SqliteSchemaBootstrapError(
      `SQLite PRAGMA configuration returned unexpected values: synchronous=${String(synchronous)}, busy_timeout=${String(busyTimeout)}, foreign_keys=${String(foreignKeys)}`
    );
  }

  const userVersion = await readUserVersion(driver);
  if (userVersion > SQLITE_SCHEMA_VERSION) {
    throw new SqliteSchemaBootstrapError(
      `unsupported newer database schema: ${userVersion} > ${SQLITE_SCHEMA_VERSION}`
    );
  }

  if (userVersion === SQLITE_SCHEMA_VERSION) {
    const tables = await validateV1Schema(driver);
    return {
      created: false,
      userVersion,
      tables,
      journalModeBefore,
      journalMode,
      synchronous,
      foreignKeys,
      busyTimeout,
    };
  }

  const existingTables = await readTableNames(driver);
  if (existingTables.length > 0) {
    throw new SqliteSchemaBootstrapError(
      `SQLite schema state is inconsistent: user_version is 0 but tables already exist [${existingTables.join(', ')}]`
    );
  }

  try {
    await driver.transaction(async tx => {
      for (const statement of schemaStatements) {
        await tx.execute(statement);
      }
      await tx.execute(`PRAGMA user_version = ${SQLITE_SCHEMA_VERSION}`);
    });
  } catch (error) {
    try {
      const versionAfterFailure = await readUserVersion(driver);
      const tablesAfterFailure = await readTableNames(driver);
      if (versionAfterFailure !== 0 || tablesAfterFailure.length > 0) {
        throw new SqliteSchemaBootstrapError(
          `schema creation rollback left user_version=${versionAfterFailure} and tables [${tablesAfterFailure.join(', ')}]`
        );
      }
    } catch (verificationError) {
      if (verificationError !== error) {
        throw new SqliteSchemaBootstrapError(
          `schema creation failed (${errorMessage(error)}); rollback verification failed (${errorMessage(verificationError)})`
        );
      }
    }
    throw error;
  }

  const versionAfterCreate = await readUserVersion(driver);
  if (versionAfterCreate !== SQLITE_SCHEMA_VERSION) {
    throw new SqliteSchemaBootstrapError(
      `schema creation completed with user_version=${versionAfterCreate}; expected ${SQLITE_SCHEMA_VERSION}`
    );
  }
  const tables = await validateV1Schema(driver);
  return {
    created: true,
    userVersion: versionAfterCreate,
    tables,
    journalModeBefore,
    journalMode,
    synchronous,
    foreignKeys,
    busyTimeout,
  };
}
