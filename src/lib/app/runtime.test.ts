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
    expect(resolveStorageBackend(runtime.runtime)).toBe('dexie');
    await expect(initializeDataRuntime(runtime)).resolves.toEqual({
      status: 'ready',
      runtime: 'web',
      backend: 'dexie',
    });
    expect(mocks.initializeDexieDataRuntime).toHaveBeenCalledOnce();
  });

  it.each(['android', 'ios'] as const)(
    'identifies Capacitor %s as Capacitor and keeps Dexie active',
    async platform => {
      mocks.isNativePlatform.mockReturnValue(true);
      mocks.getPlatform.mockReturnValue(platform);

      const runtime = detectAppRuntime();

      expect(runtime).toEqual({
        runtime: 'capacitor',
        capacitorPlatform: platform,
      });
      expect(resolveStorageBackend(runtime.runtime)).toBe('dexie');
      await expect(initializeDataRuntime(runtime)).resolves.toMatchObject({
        status: 'ready',
        runtime: 'capacitor',
        backend: 'dexie',
      });
      expect(mocks.initializeDexieDataRuntime).toHaveBeenCalledOnce();
    }
  );

  it('identifies Tauri before Capacitor even if Capacitor also reports native', async () => {
    vi.stubGlobal('window', { __TAURI__: {} });
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.getPlatform.mockReturnValue('ios');

    const runtime = detectAppRuntime();

    expect(runtime).toEqual({ runtime: 'tauri', capacitorPlatform: null });
    expect(mocks.isNativePlatform).not.toHaveBeenCalled();
    expect(resolveStorageBackend(runtime.runtime)).toBe('dexie');
    await expect(initializeDataRuntime(runtime)).resolves.toMatchObject({
      status: 'ready',
      runtime: 'tauri',
      backend: 'dexie',
    });
    expect(mocks.initializeDexieDataRuntime).toHaveBeenCalledOnce();
  });

  it('keeps an unknown native Capacitor platform classified as Capacitor', async () => {
    mocks.isNativePlatform.mockReturnValue(true);
    mocks.getPlatform.mockReturnValue('unsupported-native-platform');

    const runtime = detectAppRuntime();

    expect(runtime).toEqual({
      runtime: 'capacitor',
      capacitorPlatform: 'unknown',
    });
    expect(resolveStorageBackend(runtime.runtime)).toBe('dexie');
    await expect(initializeDataRuntime(runtime)).resolves.toMatchObject({
      status: 'ready',
      runtime: 'capacitor',
      backend: 'dexie',
    });
    expect(mocks.initializeDexieDataRuntime).toHaveBeenCalledOnce();
  });
});
