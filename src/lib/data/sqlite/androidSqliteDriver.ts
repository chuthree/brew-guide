import { Capacitor } from '@capacitor/core';
import type { SqliteDriver } from './driver';
import {
  openCapacitorSqliteDriver,
  SQLITE_DATABASE_NAME,
} from './capacitorSqliteDriver';
export {
  SQLITE_DATABASE_NAME,
  SQLITE_STAGE3D_TEST_DATABASE_NAME,
} from './capacitorSqliteDriver';

/** Compatibility entry point for Android diagnostics. */
export async function openAndroidSqliteDriver(
  databaseName = SQLITE_DATABASE_NAME
): Promise<SqliteDriver> {
  const platform = Capacitor.getPlatform();
  if (platform !== 'android')
    throw new Error(
      `Android SQLite driver is only available on Capacitor Android; actual platform is ${platform}`
    );
  return openCapacitorSqliteDriver(databaseName);
}

export { deleteAndroidSqliteTestDatabase } from './capacitorSqliteDriver';
