import { describe, expect, it, vi } from 'vitest';

const importTargets = [
  ['offlineQueue', () => import('./offlineQueue')],
  ['RealtimeSyncService', () => import('./RealtimeSyncService')],
  ['realtime barrel', () => import('./index')],
  ['StorageProvider', () => import('@/providers/StorageProvider')],
] as const;

describe('realtime storage import boundary', () => {
  it.each(importTargets)(
    '%s does not import core/db through the offline queue path',
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
    }
  );
});
