import { Capacitor } from '@capacitor/core';
import type {
  SQLiteConnection,
  SQLiteDBConnection,
} from '@capacitor-community/sqlite';
import type { SqliteConnectionPort, SqliteDriver } from './driver';
import { createSqliteDriverCore } from './driverCore';

export const SQLITE_DATABASE_NAME = 'brew-guide';
export const SQLITE_STAGE3D_TEST_DATABASE_NAME = 'brew-guide-stage3d-test';

let currentDriver: SqliteDriver | null = null;
let currentDatabaseName: string | null = null;
let openingDriver: Promise<SqliteDriver> | null = null;
let openingDatabaseName: string | null = null;

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function appendDiagnostic(original: unknown, diagnostic: unknown): never {
  const diagnosticMessage = describe(diagnostic);
  if (original instanceof Error) {
    original.message = `${original.message}; connection cleanup diagnostic: ${diagnosticMessage}`;
    throw original;
  }
  throw new Error(
    `${describe(original)}; connection cleanup diagnostic: ${diagnosticMessage}`
  );
}

function requireResult(
  result: { result?: boolean },
  operation: string
): boolean {
  if (typeof result.result !== 'boolean') {
    throw new Error(`${operation} returned no boolean result`);
  }
  return result.result;
}

function createConnectionPort(
  connection: SQLiteDBConnection
): SqliteConnectionPort {
  return {
    // iOS splits DELETE statements on ';' and drops the final segment.
    // A newline also terminates any trailing SQL line comment before ';'.
    execute: (sql, transaction) =>
      connection.execute(`${sql}\n;`, transaction, true),
    run: (sql, params, transaction) =>
      connection.run(sql, [...params], transaction, 'no', true),
    query: (sql, params) => connection.query(sql, [...params], true),
    beginTransaction: () => connection.beginTransaction(),
    commitTransaction: () => connection.commitTransaction(),
    rollbackTransaction: () => connection.rollbackTransaction(),
    isTransactionActive: async () =>
      requireResult(
        await connection.isTransactionActive(),
        'isTransactionActive'
      ),
  };
}

async function openDriver(databaseName: string): Promise<SqliteDriver> {
  let sqlite: SQLiteConnection | null = null;
  let connection: SQLiteDBConnection | null = null;
  let registered = false;

  try {
    const plugin = await import('@capacitor-community/sqlite');
    sqlite = new plugin.SQLiteConnection(plugin.CapacitorSQLite);

    // The wrapper clears stale JS connection state when native and JS differ.
    requireResult(
      await sqlite.checkConnectionsConsistency(),
      'checkConnectionsConsistency'
    );

    const hasConnection = requireResult(
      await sqlite.isConnection(databaseName, false),
      'isConnection'
    );
    if (hasConnection) {
      connection = await sqlite.retrieveConnection(databaseName, false);
    } else {
      connection = await sqlite.createConnection(
        databaseName,
        false,
        'no-encryption',
        1,
        false
      );
    }
    registered = true;

    const isOpen = requireResult(await connection.isDBOpen(), 'isDBOpen');
    if (!isOpen) await connection.open();
    if (!requireResult(await connection.isDBOpen(), 'isDBOpen after open')) {
      throw new Error('SQLite connection remained closed after open');
    }

    const driver = createSqliteDriverCore(
      createConnectionPort(connection),
      async () => {
        if (!sqlite)
          throw new Error('SQLite connection wrapper is unavailable');
        await sqlite.closeConnection(databaseName, false);
        if (currentDriver === driver) {
          currentDriver = null;
          currentDatabaseName = null;
        }
      }
    );
    currentDriver = driver;
    currentDatabaseName = databaseName;
    return driver;
  } catch (error) {
    if (registered && sqlite) {
      try {
        await sqlite.closeConnection(databaseName, false);
      } catch (cleanupError) {
        appendDiagnostic(error, cleanupError);
      }
    }
    throw new Error(`Capacitor SQLite driver open failed: ${describe(error)}`, {
      cause: error,
    });
  }
}

/** Open or retrieve the single Capacitor Brew Guide SQLite connection. */
export async function openCapacitorSqliteDriver(
  databaseName = SQLITE_DATABASE_NAME
): Promise<SqliteDriver> {
  const platform = Capacitor.getPlatform();
  if (platform !== 'android' && platform !== 'ios') {
    throw new Error(
      `Capacitor SQLite driver is only available on Capacitor Android or iOS; actual platform is ${platform}`
    );
  }
  if (!/^[A-Za-z0-9_-]+$/.test(databaseName)) {
    throw new Error(`Invalid logical SQLite database name: ${databaseName}`);
  }

  if (currentDriver) {
    if (currentDatabaseName !== databaseName) {
      throw new Error(
        `SQLite driver already has an open connection for ${currentDatabaseName}`
      );
    }
    return currentDriver;
  }
  if (openingDriver) {
    if (openingDatabaseName !== databaseName) {
      throw new Error(
        `SQLite driver is opening a connection for ${openingDatabaseName}`
      );
    }
    return openingDriver;
  }

  const opening = openDriver(databaseName);
  openingDriver = opening;
  openingDatabaseName = databaseName;
  try {
    return await opening;
  } finally {
    if (openingDriver === opening) {
      openingDriver = null;
      openingDatabaseName = null;
    }
  }
}

/** Delete only the isolated Stage 3D test database after closing its driver. */
export async function deleteAndroidSqliteTestDatabase(): Promise<void> {
  const platform = Capacitor.getPlatform();
  if (platform !== 'android') {
    throw new Error(
      `Android SQLite test cleanup is only available on Capacitor Android; actual platform is ${platform}`
    );
  }
  if (
    currentDatabaseName === SQLITE_STAGE3D_TEST_DATABASE_NAME &&
    currentDriver
  ) {
    await currentDriver.close();
  }

  const plugin = await import('@capacitor-community/sqlite');
  const exists = await plugin.CapacitorSQLite.isDatabase({
    database: SQLITE_STAGE3D_TEST_DATABASE_NAME,
    readonly: false,
  });
  if (typeof exists.result !== 'boolean') {
    throw new Error(
      'isDatabase returned no boolean result during test cleanup'
    );
  }
  if (!exists.result) return;

  const sqlite = new plugin.SQLiteConnection(plugin.CapacitorSQLite);
  requireResult(
    await sqlite.checkConnectionsConsistency(),
    'checkConnectionsConsistency during test cleanup'
  );

  const hasConnection = requireResult(
    await sqlite.isConnection(SQLITE_STAGE3D_TEST_DATABASE_NAME, false),
    'isConnection during test cleanup'
  );
  const connection = hasConnection
    ? await sqlite.retrieveConnection(SQLITE_STAGE3D_TEST_DATABASE_NAME, false)
    : await sqlite.createConnection(
        SQLITE_STAGE3D_TEST_DATABASE_NAME,
        false,
        'no-encryption',
        1,
        false
      );

  try {
    if (
      !requireResult(
        await connection.isDBOpen(),
        'isDBOpen during test cleanup'
      )
    ) {
      await connection.open();
    }
    await connection.delete();
  } finally {
    await sqlite.closeConnection(SQLITE_STAGE3D_TEST_DATABASE_NAME, false);
  }

  const remainingDatabase = await plugin.CapacitorSQLite.isDatabase({
    database: SQLITE_STAGE3D_TEST_DATABASE_NAME,
    readonly: false,
  });
  if (remainingDatabase.result !== false) {
    throw new Error('Stage 3D test database still exists after cleanup');
  }
}
