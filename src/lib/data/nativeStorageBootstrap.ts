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
  runtime: 'capacitor' | 'tauri';
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
      'Native SQLite startup cannot read the legacy WebView storage source',
      { cause }
    );
  }
}

async function initializeNative(
  runtimeInfo: AppRuntimeInfo
): Promise<NativeStorageBootstrapResult> {
  let driver: SqliteDriver | undefined;
  try {
    const isAndroid =
      runtimeInfo.runtime === 'capacitor' &&
      runtimeInfo.capacitorPlatform === 'android';
    if (runtimeInfo.runtime === 'tauri') {
      const { openTauriSqliteDriver } =
        await import('./sqlite/tauriSqliteDriver');
      driver = await openTauriSqliteDriver();
    } else if (isAndroid) {
      const { openAndroidSqliteDriver } =
        await import('./sqlite/androidSqliteDriver');
      driver = await openAndroidSqliteDriver();
    } else {
      const { openCapacitorSqliteDriver } =
        await import('./sqlite/capacitorSqliteDriver');
      driver = await openCapacitorSqliteDriver();
    }

    const { bootstrapSqliteSchema } =
      await import('@/lib/data/sqlite/schemaBootstrap');
    if (isAndroid) {
      // Prevent first-launch UI schema checks from racing a headless Provider.
      // Release before legacy migration, which may await explicit user consent.
      const { withAndroidDatabaseMutation } =
        await import('./sqlite/providerSqliteDriver');
      await withAndroidDatabaseMutation(() => bootstrapSqliteSchema(driver!));
    } else {
      await bootstrapSqliteSchema(driver);
    }

    const imageFileStore =
      runtimeInfo.runtime === 'tauri'
        ? await (
            await import('./images/tauriImageFileStore')
          ).createTauriImageFileStore()
        : isAndroid
          ? await (
              await import('./images/capacitorAndroidImageFileStore')
            ).createCapacitorAndroidImageFileStore()
          : await (
              await import('./images/capacitorImageFileStore')
            ).createCapacitorImageFileStore();

    const { readLegacyMigrationSource } =
      await import('@/lib/data/sqlite/legacyMigrationSource');
    const { runLegacySqliteMigration, verifyLegacyMigrationBeforeCleanup } =
      await import('@/lib/data/sqlite/legacyMigrationExecutor');
    await runLegacySqliteMigration({
      driver,
      imageFileStore,
      loadSource: () => readLegacyMigrationSource(getWebViewLocalStorage()),
      beforeMigration: requestNativeMigrationApproval,
    });
    await cleanupApprovedLegacyDatabase(driver, digest =>
      verifyLegacyMigrationBeforeCleanup(
        {
          driver: driver!,
          imageFileStore,
          loadSource: () => readLegacyMigrationSource(getWebViewLocalStorage()),
        },
        digest
      )
    );

    const { createSqliteRuntimeRepositories } =
      await import('@/lib/data/sqlite/runtimeRepositories');
    configureRepositories(
      createSqliteRuntimeRepositories(driver, imageFileStore)
    );
    finishNativeMigration();

    return {
      status: 'ready',
      runtime: runtimeInfo.runtime as 'capacitor' | 'tauri',
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

/** Native startup is SQLite-only and fails closed without Dexie fallback. */
export class NativeStorageBootstrap {
  initialize(
    runtimeInfo: AppRuntimeInfo
  ): Promise<NativeStorageBootstrapResult> {
    if (
      runtimeInfo.runtime !== 'tauri' &&
      (runtimeInfo.runtime !== 'capacitor' ||
        !['android', 'ios'].includes(runtimeInfo.capacitorPlatform ?? ''))
    ) {
      return Promise.reject(
        new Error(
          'Native SQLite bootstrap currently supports Capacitor Android only, iOS and Tauri'
        )
      );
    }

    if (initialization) return initialization;

    const current = initializeNative(runtimeInfo);
    initialization = current;
    return current.catch(error => {
      if (initialization === current) initialization = null;
      throw error;
    });
  }
}
