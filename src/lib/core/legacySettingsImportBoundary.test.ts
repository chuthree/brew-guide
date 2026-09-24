import { describe, expect, it, vi } from 'vitest';

const importTargets = [
  ['StorageUtils', () => import('./storageUtils')],
  ['DataManager', () => import('./dataManager')],
  ['dataIntegrity', () => import('@/lib/app/dataIntegrity')],
  ['Onboarding', () => import('@/components/onboarding/Onboarding')],
  ['app/page', () => import('@/app/page')],
] as const;

describe('legacy settings storage import boundaries', () => {
  it.each(importTargets)(
    '%s does not load core/db through the legacy settings path',
    async (_name, importTarget) => {
      const loadActiveDatabase = vi.fn(() => {
        throw new Error('Unexpected import of src/lib/core/db');
      });

      vi.resetModules();
      vi.doMock('@/lib/core/db', () => {
        loadActiveDatabase();
        return {};
      });

      try {
        await expect(importTarget()).resolves.toBeDefined();
        expect(loadActiveDatabase).not.toHaveBeenCalled();
      } finally {
        vi.doUnmock('@/lib/core/db');
        vi.resetModules();
      }
    },
    15_000
  );
});
