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
 * Bundled native apps use SQLite; OL shells, browsers and PWAs keep Dexie storage.
 */
export function resolveStorageBackend(runtime: AppRuntimeInfo): StorageBackend {
  if (
    runtime.runtime === 'tauri' ||
    (runtime.runtime === 'capacitor' &&
      runtime.capacitorBundled !== false &&
      (runtime.capacitorPlatform === 'android' ||
        runtime.capacitorPlatform === 'ios'))
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
