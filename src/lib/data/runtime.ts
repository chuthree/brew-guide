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
 * Android Capacitor uses SQLite; other runtimes remain on Dexie until their
 * native backends are implemented.
 */
export function resolveStorageBackend(runtime: AppRuntimeInfo): StorageBackend {
  if (
    runtime.runtime === 'capacitor' &&
    runtime.capacitorPlatform === 'android'
  ) {
    return 'native-sqlite';
  }

  return 'dexie';
}

export async function initializeDataRuntime(
  runtimeInfo: AppRuntimeInfo = detectAppRuntime()
): Promise<DataRuntimeInitialization> {
  const backend = resolveStorageBackend(runtimeInfo);

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
