import { describe, expect, it, vi } from 'vitest';

describe('roaster rename storage import boundary', () => {
  it('does not load core/db when importing the business orchestration', async () => {
    const loadActiveDatabase = vi.fn(() => {
      throw new Error('Unexpected import of src/lib/core/db');
    });

    vi.resetModules();
    vi.doMock('@/lib/core/db', () => {
      loadActiveDatabase();
      return {};
    });

    try {
      await expect(import('./roasterRename')).resolves.toBeDefined();
      expect(loadActiveDatabase).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('@/lib/core/db');
      vi.resetModules();
    }
  });
});
