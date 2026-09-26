import { describe, expect, it } from 'vitest';
import type { SqliteConnectionPort, SqliteDriver } from './driver';
import { createSqliteDriverCore } from './driverCore';
import { bootstrapSqliteSchema, SQLITE_V1_TABLES } from './schemaBootstrap';
import { SQLITE_SCHEMA_V1_STATEMENTS, SQLITE_SCHEMA_VERSION } from './schemaV1';

interface FakeColumn {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

interface FakeIndex {
  name: string;
  table: string;
  columns: string[];
  unique: number;
}

interface FakeState {
  version: number;
  journalMode: string;
  synchronous: number;
  busyTimeout: number;
  foreignKeys: number;
  tables: Map<string, FakeColumn[]>;
  tableSql: Map<string, string>;
  indexes: Map<string, FakeIndex>;
  snapshot?: Omit<FakeState, 'snapshot'>;
}

function cloneState(state: FakeState): Omit<FakeState, 'snapshot'> {
  return {
    version: state.version,
    journalMode: state.journalMode,
    synchronous: state.synchronous,
    busyTimeout: state.busyTimeout,
    foreignKeys: state.foreignKeys,
    tables: new Map(
      [...state.tables].map(([name, columns]) => [
        name,
        columns.map(column => ({ ...column })),
      ])
    ),
    tableSql: new Map(state.tableSql),
    indexes: new Map(
      [...state.indexes].map(([name, index]) => [
        name,
        { ...index, columns: [...index.columns] },
      ])
    ),
  };
}

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "'") quoted = !quoted;
    if (!quoted && char === '(') depth += 1;
    if (!quoted && char === ')') depth -= 1;
    if (!quoted && depth === 0 && char === ',') {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts;
}

function addTable(state: FakeState, sql: string): void {
  const match = sql.match(/^CREATE TABLE (\w+) \(([\s\S]*)\)$/i);
  if (!match) throw new Error(`invalid fake CREATE TABLE: ${sql}`);
  const [, table, definition] = match;
  state.tableSql.set(table, sql);
  const columns: FakeColumn[] = [];
  let autoIndex = 0;
  for (const part of splitTopLevel(definition)) {
    const unique = part.match(/^UNIQUE\s*\(([^)]+)\)$/i);
    if (unique) {
      autoIndex += 1;
      state.indexes.set(`sqlite_autoindex_${table}_${autoIndex}`, {
        name: `sqlite_autoindex_${table}_${autoIndex}`,
        table,
        columns: unique[1].split(',').map(name => name.trim()),
        unique: 1,
      });
      continue;
    }
    if (/^CHECK\s*\(/i.test(part)) continue;

    const tokens = part.split(/\s+/);
    const name = tokens[0];
    const type = tokens[1];
    const notnull = /\bNOT NULL\b/i.test(part) ? 1 : 0;
    const primaryKey = /\bPRIMARY KEY\b/i.test(part) ? 1 : 0;
    columns.push({ name, type, notnull, pk: primaryKey });
    if (primaryKey) {
      autoIndex += 1;
      state.indexes.set(`sqlite_autoindex_${table}_${autoIndex}`, {
        name: `sqlite_autoindex_${table}_${autoIndex}`,
        table,
        columns: [name],
        unique: 1,
      });
    }
  }
  state.tables.set(table, columns);
}

function makeFakeSqlite(options: { journalModeCanChange?: boolean } = {}) {
  const state: FakeState = {
    version: 0,
    journalMode: 'wal2',
    synchronous: 2,
    busyTimeout: 5000,
    foreignKeys: 1,
    tables: new Map(),
    tableSql: new Map(),
    indexes: new Map(),
  };
  const calls: string[] = [];

  const connection: SqliteConnectionPort = {
    execute: async sql => {
      calls.push(sql);
      const journalMode = sql.match(/^PRAGMA journal_mode = (\w+)$/i);
      if (journalMode) {
        if (options.journalModeCanChange !== false) {
          state.journalMode = journalMode[1].toLowerCase();
        }
        return { changes: { changes: 0 } };
      }
      const synchronous = sql.match(/^PRAGMA synchronous = (\w+)$/i);
      if (synchronous) {
        state.synchronous = synchronous[1].toUpperCase() === 'FULL' ? 2 : -1;
        return { changes: { changes: 0 } };
      }
      const version = sql.match(/^PRAGMA user_version = (\d+)$/i);
      if (version) {
        state.version = Number(version[1]);
        return { changes: { changes: 0 } };
      }
      if (/^CREATE TABLE /i.test(sql)) {
        addTable(state, sql);
        return { changes: { changes: 0 } };
      }
      const index = sql.match(/^CREATE INDEX (\w+)\s+ON (\w+)\s+\(([^)]+)\)$/i);
      if (index) {
        const [, name, table, columns] = index;
        state.indexes.set(name, {
          name,
          table,
          columns: columns
            .split(',')
            .map(column => column.trim().replace(/\s+(ASC|DESC)$/i, '')),
          unique: 0,
        });
        return { changes: { changes: 0 } };
      }
      throw new Error(`fake SQLite rejected SQL: ${sql}`);
    },
    run: async () => ({ changes: { changes: 1 } }),
    query: async (sql, params = []) => {
      calls.push(sql);
      if (/PRAGMA user_version/i.test(sql)) {
        return { values: [{ user_version: state.version }] };
      }
      if (/PRAGMA journal_mode/i.test(sql)) {
        const requestedMode = sql.match(/^PRAGMA journal_mode = (\w+)$/i);
        if (requestedMode && options.journalModeCanChange !== false) {
          state.journalMode = requestedMode[1].toLowerCase();
        }
        return { values: [{ journal_mode: state.journalMode }] };
      }
      if (/PRAGMA synchronous/i.test(sql)) {
        return { values: [{ synchronous: state.synchronous }] };
      }
      if (/PRAGMA busy_timeout/i.test(sql)) {
        return { values: [{ timeout: state.busyTimeout }] };
      }
      if (/PRAGMA foreign_keys/i.test(sql)) {
        return { values: [{ foreign_keys: state.foreignKeys }] };
      }
      if (/sqlite_master WHERE type = 'table'/i.test(sql)) {
        if (/AND name = \?/i.test(sql)) {
          const name = params[0];
          const tableSql =
            typeof name === 'string' ? state.tableSql.get(name) : undefined;
          return { values: tableSql ? [{ sql: tableSql }] : [] };
        }
        return {
          values: [...state.tables.keys()].sort().map(name => ({ name })),
        };
      }
      if (/sqlite_master WHERE type = 'index'/i.test(sql)) {
        return {
          values: [...state.indexes.keys()]
            .filter(name => !name.startsWith('sqlite_'))
            .map(name => ({ name })),
        };
      }
      const tableInfo = sql.match(/^PRAGMA table_info\((\w+)\)$/i);
      if (tableInfo) {
        return { values: state.tables.get(tableInfo[1]) ?? [] };
      }
      const indexList = sql.match(/^PRAGMA index_list\((\w+)\)$/i);
      if (indexList) {
        return {
          values: [...state.indexes.values()]
            .filter(index => index.table === indexList[1])
            .map(({ name, unique }) => ({ name, unique })),
        };
      }
      const indexInfo = sql.match(/^PRAGMA index_info\("([\s\S]*)"\)$/i);
      if (indexInfo) {
        const name = indexInfo[1].replaceAll('""', '"');
        return {
          values: (state.indexes.get(name)?.columns ?? []).map(
            (column, seqno) => ({ seqno, name: column })
          ),
        };
      }
      throw new Error(`fake SQLite does not implement query: ${sql}`);
    },
    beginTransaction: async () => {
      calls.push('BEGIN');
      state.snapshot = cloneState(state);
      return { changes: { changes: 0 } };
    },
    commitTransaction: async () => {
      calls.push('COMMIT');
      delete state.snapshot;
      return { changes: { changes: 0 } };
    },
    rollbackTransaction: async () => {
      calls.push('ROLLBACK');
      const snapshot = state.snapshot;
      if (snapshot) {
        state.version = snapshot.version;
        state.journalMode = snapshot.journalMode;
        state.synchronous = snapshot.synchronous;
        state.busyTimeout = snapshot.busyTimeout;
        state.foreignKeys = snapshot.foreignKeys;
        state.tables = snapshot.tables;
        state.tableSql = snapshot.tableSql;
        state.indexes = snapshot.indexes;
      }
      delete state.snapshot;
      return { changes: { changes: 0 } };
    },
    isTransactionActive: async () => Boolean(state.snapshot),
  };

  const driver: SqliteDriver = createSqliteDriverCore(
    connection,
    async () => undefined
  );
  return { driver, state, calls };
}

describe('SQLite v1 schema bootstrap', () => {
  it('creates a fresh schema transactionally and reports configured PRAGMAs', async () => {
    const fake = makeFakeSqlite();
    const report = await bootstrapSqliteSchema(fake.driver);

    expect(report.created).toBe(true);
    expect(report.userVersion).toBe(SQLITE_SCHEMA_VERSION);
    expect(report.tables).toHaveLength(12);
    expect(report.tables).toEqual(
      expect.arrayContaining([...SQLITE_V1_TABLES])
    );
    expect(report.journalModeBefore).toBe('wal2');
    expect(report.journalMode).toBe('delete');
    expect(report.synchronous).toBe(2);
    expect(report.foreignKeys).toBe(1);
    expect(report.busyTimeout).toBe(5000);
    expect(fake.calls).toContain('COMMIT');
  });

  it('validates and reopens an existing v1 schema without running CREATE statements', async () => {
    const fake = makeFakeSqlite();
    await bootstrapSqliteSchema(fake.driver);
    const createCount = fake.calls.filter(call =>
      call.startsWith('CREATE ')
    ).length;
    const report = await bootstrapSqliteSchema(fake.driver);

    expect(report.created).toBe(false);
    expect(report.userVersion).toBe(1);
    expect(fake.calls.filter(call => call.startsWith('CREATE '))).toHaveLength(
      createCount
    );
  });

  it('rejects a newer user_version without creating or deleting schema', async () => {
    const fake = makeFakeSqlite();
    fake.state.version = SQLITE_SCHEMA_VERSION + 1;

    await expect(bootstrapSqliteSchema(fake.driver)).rejects.toThrow(
      /unsupported newer database schema/
    );
    expect(fake.state.version).toBe(SQLITE_SCHEMA_VERSION + 1);
    expect(fake.state.tables.size).toBe(0);
  });

  it('rejects user_version zero when an application table already exists', async () => {
    const fake = makeFakeSqlite();
    addTable(
      fake.state,
      'CREATE TABLE coffee_beans (id TEXT NOT NULL PRIMARY KEY)'
    );

    await expect(bootstrapSqliteSchema(fake.driver)).rejects.toThrow(
      /user_version is 0 but tables already exist/
    );
    expect(fake.state.tables.size).toBe(1);
    expect(fake.state.version).toBe(0);
  });

  it('rejects a partial v1 schema when an expected table is missing', async () => {
    const fake = makeFakeSqlite();
    await bootstrapSqliteSchema(fake.driver);
    fake.state.tables.delete('grinders');

    await expect(bootstrapSqliteSchema(fake.driver)).rejects.toThrow(
      /missing tables \[grinders\]/
    );
    expect(fake.state.version).toBe(1);
  });

  it('rejects v1 schema drift when a required index is missing', async () => {
    const fake = makeFakeSqlite();
    await bootstrapSqliteSchema(fake.driver);
    fake.state.indexes.delete('idx_pending_operations_timestamp_id');

    await expect(bootstrapSqliteSchema(fake.driver)).rejects.toThrow(
      /required index idx_pending_operations_timestamp_id is missing/
    );
    expect(fake.state.version).toBe(1);
  });

  it.each(
    (['coffee_bean_images', 'brewing_note_images'] as const).flatMap(table => [
      [
        `${table} source-kind CHECK`,
        table,
        (sql: string) =>
          sql.replace(
            "source_kind TEXT NOT NULL CHECK (source_kind IN ('file', 'external'))",
            'source_kind TEXT NOT NULL'
          ),
      ],
      [
        `${table} source-shape XOR CHECK`,
        table,
        (sql: string) =>
          sql.replace(
            /,\s*CHECK\s*\(\s*\(source_kind = 'file'[\s\S]*?sha256 IS NULL\)\s*\),(?=\s*UNIQUE)/i,
            ''
          ),
      ],
      [
        `${table} external thumbnail prohibition`,
        table,
        (sql: string) =>
          sql.replace(
            "AND variant = 'original'",
            "AND variant IN ('original', 'thumbnail')"
          ),
      ],
    ])
  )(
    'rejects image-table drift when %s is missing or weakened',
    async (_label, table, revise) => {
      const fake = makeFakeSqlite();
      await bootstrapSqliteSchema(fake.driver);
      const definition = fake.state.tableSql.get(table);
      if (!definition) throw new Error(`${table} definition is missing`);
      fake.state.tableSql.set(table, revise(definition));

      await expect(bootstrapSqliteSchema(fake.driver)).rejects.toThrow(
        new RegExp(`${table} is missing required CHECK constraints`)
      );
      expect(fake.state.version).toBe(1);
    }
  );

  it('rolls back partial table creation and leaves user_version zero', async () => {
    const fake = makeFakeSqlite();
    const statements = [SQLITE_SCHEMA_V1_STATEMENTS[0], 'INVALID SQL'];

    await expect(
      bootstrapSqliteSchema(fake.driver, statements)
    ).rejects.toThrow(/fake SQLite rejected SQL/);
    expect(fake.state.version).toBe(0);
    expect(fake.state.tables.size).toBe(0);
    expect(fake.calls).toContain('ROLLBACK');
  });

  it('fails when Android/SQLite cannot switch to the required journal mode', async () => {
    const fake = makeFakeSqlite({ journalModeCanChange: false });
    await expect(bootstrapSqliteSchema(fake.driver)).rejects.toThrow(
      /journal mode must be DELETE; actual value: wal2/
    );
    expect(fake.state.tables.size).toBe(0);
  });
});
