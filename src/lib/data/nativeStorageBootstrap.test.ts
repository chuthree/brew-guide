import { describe, expect, it, vi } from 'vitest';

describe('Native storage bootstrap module boundary', () => {
  it('can be imported and constructed without loading core/db or Dexie startup', async () => {
    const loadActiveDatabase = vi.fn(() => {
      throw new Error(
        'Native bootstrap must not load the active Dexie database'
      );
    });

    vi.resetModules();
    vi.doMock('@/lib/core/db', loadActiveDatabase);
    vi.doMock('@/lib/data/dexieRuntime', loadActiveDatabase);

    try {
      const { NativeStorageBootstrap } =
        await import('./nativeStorageBootstrap');
      const result = await new NativeStorageBootstrap().initialize({
        runtime: 'capacitor',
        capacitorPlatform: 'android',
      });

      expect(result).toEqual({
        status: 'not-implemented',
        runtime: 'capacitor',
        backend: 'native-sqlite',
        reason: 'Native SQLite storage has not been implemented',
      });
      expect(loadActiveDatabase).not.toHaveBeenCalled();

      // The orchestration module itself is also safe to load before selecting
      // a backend; its Dexie implementation is only a dynamic import.
      await import('@/lib/core/dataLayer');
      expect(loadActiveDatabase).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('@/lib/core/db');
      vi.doUnmock('@/lib/data/dexieRuntime');
      vi.resetModules();
    }
  });
});
