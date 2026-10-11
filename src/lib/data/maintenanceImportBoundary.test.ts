import { describe, expect, it, vi } from 'vitest';

const importTargets = [
  ['dataLayer', () => import('@/lib/core/dataLayer')],
  ['brewingNoteStore', () => import('@/lib/stores/brewingNoteStore')],
  ['notes/cleanup', () => import('@/lib/notes/cleanup')],
  ['notes/imageRepository', () => import('@/lib/notes/imageRepository')],
  ['notes/imageRecords', () => import('@/lib/notes/imageRecords')],
] as const;

describe('backend maintenance import boundaries', () => {
  it.each(importTargets)(
    '%s does not load Dexie or its note maintenance adapter',
    async (_name, importTarget) => {
      const loadDexie = vi.fn(() => {
        throw new Error('Unexpected Dexie import');
      });
      const loadActiveDatabase = vi.fn(() => {
        throw new Error('Unexpected import of src/lib/core/db');
      });
      const loadDexieMaintenance = vi.fn(() => {
        throw new Error('Unexpected import of the Dexie maintenance adapter');
      });

      vi.resetModules();
      vi.doMock('dexie', () => {
        loadDexie();
        return {};
      });
      vi.doMock('@/lib/core/db', () => {
        loadActiveDatabase();
        return {};
      });
      vi.doMock('@/lib/data/adapters/dexie/brewingNoteMaintenance', () => {
        loadDexieMaintenance();
        return {};
      });

      try {
        await expect(importTarget()).resolves.toBeDefined();
        expect(loadDexie).not.toHaveBeenCalled();
        expect(loadActiveDatabase).not.toHaveBeenCalled();
        expect(loadDexieMaintenance).not.toHaveBeenCalled();
      } finally {
        vi.doUnmock('dexie');
        vi.doUnmock('@/lib/core/db');
        vi.doUnmock('@/lib/data/adapters/dexie/brewingNoteMaintenance');
        vi.resetModules();
      }
    },
    15_000
  );
});
