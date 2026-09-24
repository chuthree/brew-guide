import { describe, expect, it, vi } from 'vitest';

describe('StorageUtils backend boundary', () => {
  it('does not statically or dynamically import the Dexie database on clear', async () => {
    const attemptedDexieImport = vi.fn(() => {
      throw new Error('Unexpected Dexie import');
    });
    const attemptedDatabaseImport = vi.fn(() => {
      throw new Error('Unexpected core/db import');
    });
    const attemptedAdapterImport = vi.fn(() => {
      throw new Error('Unexpected Dexie adapter import');
    });

    vi.resetModules();
    vi.doMock('dexie', () => {
      attemptedDexieImport();
      return {};
    });
    vi.doMock('./db', () => {
      attemptedDatabaseImport();
      return {};
    });
    vi.doMock('@/lib/core/db', () => {
      attemptedDatabaseImport();
      return {};
    });
    vi.doMock('@/lib/data/adapters/dexie/backendDataMaintenance', () => {
      attemptedAdapterImport();
      return {};
    });
    vi.doMock('@capacitor/core', () => ({
      Capacitor: { isNativePlatform: () => false },
    }));
    vi.doMock('@capacitor/preferences', () => ({
      Preferences: { clear: vi.fn() },
    }));

    try {
      const { StorageUtils } = await import('./storageUtils');

      await expect(StorageUtils.clearAllData()).rejects.toThrow(
        'Data repositories are not configured'
      );
      expect(attemptedDexieImport).not.toHaveBeenCalled();
      expect(attemptedDatabaseImport).not.toHaveBeenCalled();
      expect(attemptedAdapterImport).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('dexie');
      vi.doUnmock('./db');
      vi.doUnmock('@/lib/core/db');
      vi.doUnmock('@/lib/data/adapters/dexie/backendDataMaintenance');
      vi.doUnmock('@capacitor/core');
      vi.doUnmock('@capacitor/preferences');
      vi.resetModules();
    }
  });
});
