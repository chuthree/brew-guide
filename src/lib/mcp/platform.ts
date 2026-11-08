import { detectAppRuntime } from '@/lib/app/runtime';
import { resolveStorageBackend } from '@/lib/data/runtime';
import { openTauriSqliteDriver } from '@/lib/data/sqlite/tauriSqliteDriver';
import { createTauriImageFileStore } from '@/lib/data/images/tauriImageFileStore';

/** Shared business services follow the app's storage backend, not its transport. */
export async function openBusinessSqliteDriver() {
  const runtime = detectAppRuntime();
  // Preserve the desktop transport's existing initialization and test seam.
  if (runtime.runtime !== 'capacitor') return openTauriSqliteDriver();
  if (resolveStorageBackend(runtime) !== 'native-sqlite')
    throw new Error('Business SQLite is unavailable in the hosted web shell');
  const { openCapacitorSqliteDriver } =
    await import('@/lib/data/sqlite/capacitorSqliteDriver');
  return openCapacitorSqliteDriver();
}

export async function createBusinessImageFileStore() {
  const runtime = detectAppRuntime();
  if (runtime.runtime !== 'capacitor') return createTauriImageFileStore();
  if (resolveStorageBackend(runtime) !== 'native-sqlite')
    throw new Error(
      'Native image storage is unavailable in the hosted web shell'
    );
  if (runtime.capacitorPlatform === 'android') {
    const { createCapacitorAndroidImageFileStore } =
      await import('@/lib/data/images/capacitorAndroidImageFileStore');
    return createCapacitorAndroidImageFileStore();
  }
  const { createCapacitorImageFileStore } =
    await import('@/lib/data/images/capacitorImageFileStore');
  return createCapacitorImageFileStore();
}
