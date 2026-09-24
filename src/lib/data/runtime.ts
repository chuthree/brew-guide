import type { AppRuntime, AppRuntimeInfo } from '@/lib/app/runtime';
import { detectAppRuntime } from '@/lib/app/runtime';

export type StorageBackend = 'dexie' | 'native-sqlite';

export type DataRuntimeInitialization =
  | {
      status: 'ready';
      runtime: AppRuntime;
      backend: StorageBackend;
    }
  | {
      status: 'not-implemented';
      runtime: AppRuntime;
      backend: 'native-sqlite';
      reason: string;
    };

/**
 * Current release compatibility policy: every app shell still uses Dexie.
 * This maps an app runtime to a storage backend without conflating the types.
 */
export function resolveStorageBackend(_runtime: AppRuntime): StorageBackend {
  return 'dexie';
}

export async function initializeDataRuntime(
  runtimeInfo: AppRuntimeInfo = detectAppRuntime()
): Promise<DataRuntimeInitialization> {
  const backend = resolveStorageBackend(runtimeInfo.runtime);

  if (backend === 'dexie') {
    // Keep the active Dexie implementation out of the static module graph.
    const { initializeDexieDataRuntime } = await import('./dexieRuntime');
    await initializeDexieDataRuntime();
    return { status: 'ready', runtime: runtimeInfo.runtime, backend };
  }

  // Native startup is deliberately separate and has no Dexie fallback.
  const { NativeStorageBootstrap } = await import('./nativeStorageBootstrap');
  return new NativeStorageBootstrap().initialize(runtimeInfo);
}
