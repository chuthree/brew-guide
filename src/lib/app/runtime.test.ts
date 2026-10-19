import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  isNativePlatform: vi.fn<() => boolean>(),
  getPlatform: vi.fn<() => string>(),
  initializeDexieDataRuntime: vi.fn<() => Promise<void>>(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: mocks.isNativePlatform,
    getPlatform: mocks.getPlatform,
  },
}));

vi.mock('@/lib/data/dexieRuntime', () => ({
  initializeDexieDataRuntime: mocks.initializeDexieDataRuntime,
}));

import { detectAppRuntime } from './runtime';
import {
  initializeDataRuntime,
  resolveStorageBackend,
} from '@/lib/data/runtime';

describe('app runtime detection and current backend resolution', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { hostname: 'app' } });
    mocks.isNativePlatform.mockReturnValue(false);
    mocks.getPlatform.mockReturnValue('web');
    mocks.initializeDexieDataRuntime.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('identifies an ordinary browser or PWA as Web and starts Dexie', async () => {
    const runtime = detectAppRuntime();

    expect(runtime).toEqual({ runtime: 'web', capacitorPlatform: null });
    expect(resolveStorageBackend(runtime)).toBe('dexie');
    await expect(initializeDataRuntime(runtime)).resolves.toEqual({
      status: 'ready',
      runtime: 'web',
      backend: 'dexie',
    });
    expect(mocks.initializeDexieDataRuntime).toHaveBeenCalledOnce();
  });

  it.each(['android', 'ios'] as const)(
    'keeps OL Capacitor %s on IndexedDB without starting SQLite migration',
    async platform => {
      vi.stubGlobal('window', {
        location: { hostname: 'coffee.chu3.top' },
      });
      mocks.isNativePlatform.mockReturnValue(true);
      mocks.getPlatform.mockReturnValue(platform);
      const nativeInitialize = vi
        .fn()
        .mockRejectedValue(new Error('OL shell has no SQLite plugin'));
      vi.doMock('@/lib/data/nativeStorageBootstrap', () => ({
        NativeStorageBootstrap: class {
          initialize = nativeInitialize;
        },
      }));

      try {
        const runtime = detectAppRuntime();
        expect(runtime).toEqual({
          runtime: 'capacitor',
          capacitorPlatform: platform,
          capacitorBundled: false,
        });
        expect(resolveStorageBackend(runtime)).toBe('dexie');
        await expect(initializeDataRuntime(runtime)).resolves.toEqual({
          status: 'ready',
          runtime: 'capacitor',
          backend: 'dexie',
        });
        expect(mocks.initializeDexieDataRuntime).toHaveBeenCalledOnce();
        expect(nativeInitialize).not.toHaveBeenCalled();
      } finally {
        vi.doUnmock('@/lib/data/nativeStorageBootstrap');
      }
    }
  );

  it.each(['android', 'ios'] as const)(
    'uses SQLite for Capacitor %s',
    async platform => {
      mocks.isNativePlatform.mockReturnValue(true);
      mocks.getPlatform.mockReturnValue(platform);

      const runtime = detectAppRuntime();

      expect(runtime).toEqual({
        runtime: 'capacitor',
        capacitorPlatform: platform,
        capacitorBundled: true,
      });
      expect(resolveStorageBackend(runtime)).toBe('native-sqlite');
      const nativeInitialize = vi.fn().mockResolvedValue({
        status: 'ready',
        runtime: 'capacitor',
        backend: 'native-sqlite',
      });
      vi.doMock('@/lib/data/nativeStorageBootstrap', () => ({
        NativeStorageBootstrap: class {
          initialize = nativeInitialize;
        },
      }));
      try {
        await expect(initializeDataRuntime(runtime)).resolves.toEqual({
          status: 'ready',
          runtime: 'capacitor',
          backend: 'native-sqlite',
        });
        expect(nativeInitialize).toHaveBeenCalledWith(runtime);
        expect(mocks.initializeDexieDataRuntime).not.toHaveBeenCalled();
      } finally {
        vi.doUnmock('@/lib/data/nativeStorageBootstrap');
      }
    }
  );

  it('does not fall back to IndexedDB when bundled native SQLite fails', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.getPlatform.mockReturnValue('android');
    const nativeInitialize = vi
      .fn()
      .mockRejectedValue(new Error('SQLite failed'));
    vi.doMock('@/lib/data/nativeStorageBootstrap', () => ({
      NativeStorageBootstrap: class {
        initialize = nativeInitialize;
      },
    }));

    try {
      await expect(initializeDataRuntime()).rejects.toThrow('SQLite failed');
      expect(nativeInitialize).toHaveBeenCalledOnce();
      expect(mocks.initializeDexieDataRuntime).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('@/lib/data/nativeStorageBootstrap');
    }
  });

  it('identifies Tauri before Capacitor even if Capacitor also reports native', async () => {
    vi.stubGlobal('window', { __TAURI__: {} });
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.getPlatform.mockReturnValue('ios');

    const runtime = detectAppRuntime();

    expect(runtime).toEqual({ runtime: 'tauri', capacitorPlatform: null });
    expect(mocks.isNativePlatform).not.toHaveBeenCalled();
    expect(resolveStorageBackend(runtime)).toBe('native-sqlite');
  });

  it('keeps an unknown native Capacitor platform classified as Capacitor', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.getPlatform.mockReturnValue('unsupported-native-platform');

    const runtime = detectAppRuntime();

    expect(runtime).toEqual({
      runtime: 'capacitor',
      capacitorPlatform: 'unknown',
      capacitorBundled: true,
    });
    expect(resolveStorageBackend(runtime)).toBe('dexie');
    await expect(initializeDataRuntime(runtime)).resolves.toMatchObject({
      status: 'ready',
      runtime: 'capacitor',
      backend: 'dexie',
    });
    expect(mocks.initializeDexieDataRuntime).toHaveBeenCalledOnce();
  });
});
