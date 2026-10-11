import type { AppRuntimeInfo } from '@/lib/app/runtime';
import { configureRepositories } from '@/lib/data/repositories';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import {
  requestNativeMigrationApproval,
  cleanupApprovedLegacyDatabase,
  finishNativeMigration,
} from './nativeMigrationGate';

export interface NativeStorageBootstrapResult {
  status: 'ready';
  runtime: 'capacitor';
  backend: 'native-sqlite';
}

let initialization: Promise<NativeStorageBootstrapResult> | null = null;

function getWebViewLocalStorage(): Storage {
  try {
    if (typeof window === 'undefined') {
      throw new Error('WebView window is unavailable');
    }
    return window.localStorage;
  } catch (cause) {
    throw new Error(
      'Android SQLite startup cannot read the legacy WebView storage source',
      { cause }
    );
  }
}

async function initializeAndroid(): Promise<NativeStorageBootstrapResult> {
  let driver: SqliteDriver | undefined;
  try {
    const { openAndroidSqliteDriver } =
      await import('@/lib/data/sqlite/androidSqliteDriver');
    driver = await openAndroidSqliteDriver();

    const { bootstrapSqliteSchema } =
      await import('@/lib/data/sqlite/schemaBootstrap');
    await bootstrapSqliteSchema(driver);

    const { createCapacitorAndroidImageFileStore } =
      await import('@/lib/data/images/capacitorAndroidImageFileStore');
    const imageFileStore = await createCapacitorAndroidImageFileStore();

    const { readLegacyMigrationSource } =
      await import('@/lib/data/sqlite/legacyMigrationSource');
    const { runLegacySqliteMigration } =
      await import('@/lib/data/sqlite/legacyMigrationExecutor');
    await runLegacySqliteMigration({
      driver,
      imageFileStore,
      loadSource: () => readLegacyMigrationSource(getWebViewLocalStorage()),
      beforeMigration: requestNativeMigrationApproval,
    });
    await cleanupApprovedLegacyDatabase(driver);

    const { createSqliteRuntimeRepositories } =
      await import('@/lib/data/sqlite/runtimeRepositories');
    configureRepositories(
      createSqliteRuntimeRepositories(driver, imageFileStore)
    );
    finishNativeMigration();

    return {
      status: 'ready',
      runtime: 'capacitor',
      backend: 'native-sqlite',
    };
  } catch (error) {
    finishNativeMigration(error);
    try {
      await driver?.close();
    } catch {
      // Preserve the startup error; a later launch can reopen the connection.
    }
    throw error;
  }
}

/** Android Native startup is SQLite-only and fails closed without Dexie fallback. */
export class NativeStorageBootstrap {
  initialize(
    runtimeInfo: AppRuntimeInfo
  ): Promise<NativeStorageBootstrapResult> {
    if (
      runtimeInfo.runtime !== 'capacitor' ||
      runtimeInfo.capacitorPlatform !== 'android'
    ) {
      return Promise.reject(
        new Error(
          'Native SQLite bootstrap currently supports Capacitor Android only'
        )
      );
    }

    if (initialization) return initialization;

    const current = initializeAndroid();
    initialization = current;
    return current.catch(error => {
      if (initialization === current) initialization = null;
      throw error;
    });
  }
}
