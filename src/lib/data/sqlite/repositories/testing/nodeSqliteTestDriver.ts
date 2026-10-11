import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type {
  SqliteConnectionPort,
  SqliteDriver,
  SqlValue,
} from '../../driver';
import { createSqliteDriverCore } from '../../driverCore';
import { bootstrapSqliteSchema } from '../../schemaBootstrap';

interface NodeStatementSync {
  all(...params: SqlValue[]): Array<Record<string, unknown>>;
  run(...params: SqlValue[]): { changes: number | bigint };
}

interface NodeDatabaseSync {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): NodeStatementSync;
}

interface NodeSqliteModule {
  DatabaseSync: new (location: string) => NodeDatabaseSync;
}

export function supportsNodeSqlite(version = process.versions.node): boolean {
  const match = /^(\d+)\.(\d+)/.exec(version);
  if (!match) return false;

  const major = Number(match[1]);
  const minor = Number(match[2]);
  return major > 22 || (major === 22 && minor >= 13);
}

function result(changes = 0): { changes: { changes: number } } {
  return { changes: { changes } };
}

function createConnection(database: NodeDatabaseSync): SqliteConnectionPort {
  let transactionActive = false;

  return {
    async execute(sql) {
      database.exec(sql);
      return result();
    },
    async run(sql, params) {
      const writeResult = database.prepare(sql).run(...params);
      return result(Number(writeResult.changes));
    },
    async query(sql, params) {
      return { values: database.prepare(sql).all(...params) };
    },
    async beginTransaction() {
      database.exec('BEGIN IMMEDIATE');
      transactionActive = true;
      return result();
    },
    async commitTransaction() {
      database.exec('COMMIT');
      transactionActive = false;
      return result();
    },
    async rollbackTransaction() {
      database.exec('ROLLBACK');
      transactionActive = false;
      return result();
    },
    async isTransactionActive() {
      return transactionActive;
    },
  };
}

export interface NodeSqliteTestDatabase {
  driver: SqliteDriver;
  close(): Promise<void>;
}

/** Creates an isolated real SQLite database and applies the frozen v1 schema. */
export async function createNodeSqliteTestDatabase(): Promise<NodeSqliteTestDatabase> {
  if (!supportsNodeSqlite()) {
    throw new Error(
      `SKIPPED: node:sqlite unavailable on Node ${process.versions.node}; requires Node >=22.13`
    );
  }

  // Keep node:sqlite out of the ordinary test and production module graph.
  const moduleName = 'node:sqlite';
  const sqlite = (await import(
    /* @vite-ignore */ moduleName
  )) as NodeSqliteModule;
  const directory = await mkdtemp(
    join(tmpdir(), 'brew-guide-sqlite-repository-')
  );
  let database: NodeDatabaseSync | undefined;
  let driver: SqliteDriver | undefined;

  try {
    database = new sqlite.DatabaseSync(join(directory, 'test.sqlite'));
    driver = createSqliteDriverCore(createConnection(database), async () => {
      database?.close();
    });
    await bootstrapSqliteSchema(driver);
  } catch (error) {
    try {
      if (driver) await driver.close();
      else database?.close();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
    throw error;
  }

  return {
    driver,
    async close() {
      try {
        await driver.close();
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    },
  };
}
