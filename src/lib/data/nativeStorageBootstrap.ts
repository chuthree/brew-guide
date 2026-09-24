import type { AppRuntimeInfo } from '@/lib/app/runtime';

export interface NativeStorageBootstrapResult {
  status: 'not-implemented';
  runtime: 'capacitor' | 'tauri';
  backend: 'native-sqlite';
  reason: string;
}

/**
 * Future Native SQLite startup boundary. Keep this module independent of the
 * active Dexie database; a later implementation can load LegacyDexieReader
 * only when a source migration is required.
 */
export class NativeStorageBootstrap {
  async initialize(
    runtimeInfo: AppRuntimeInfo
  ): Promise<NativeStorageBootstrapResult> {
    if (runtimeInfo.runtime === 'web') {
      throw new Error('Native storage bootstrap requires a native app runtime');
    }

    return {
      status: 'not-implemented',
      runtime: runtimeInfo.runtime,
      backend: 'native-sqlite',
      reason: 'Native SQLite storage has not been implemented',
    };
  }
}
