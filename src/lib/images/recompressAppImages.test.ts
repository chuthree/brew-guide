import { describe, expect, it, vi } from 'vitest';
import type { DataRepositories } from '@/lib/data/repositories';
import type { ImageRecompressionStats } from './imageRecompression';

const stats = (
  overrides: Partial<ImageRecompressionStats> = {}
): ImageRecompressionStats => ({
  scannedCount: 0,
  candidateCount: 0,
  compressedCount: 0,
  failedCount: 0,
  savedBytes: 0,
  ...overrides,
});

describe('recompress app images', () => {
  it('uses the configured backend maintenance without importing Dexie modules', async () => {
    vi.resetModules();

    const attemptedDexieLoad = vi.fn(() => {
      throw new Error('Unexpected Dexie implementation import');
    });
    const attemptedDatabaseLoad = vi.fn(() => {
      throw new Error('Unexpected core/db import');
    });
    const attemptedAdapterLoad = vi.fn(() => {
      throw new Error('Unexpected Dexie image adapter import');
    });

    const noteStats = stats({
      scannedCount: 2,
      candidateCount: 1,
      compressedCount: 1,
      savedBytes: 10,
    });
    const beanStats = stats({
      scannedCount: 3,
      candidateCount: 2,
      compressedCount: 1,
      failedCount: 1,
      savedBytes: 20,
    });
    const logoStats = stats({
      scannedCount: 4,
      candidateCount: 3,
      compressedCount: 2,
      savedBytes: 30,
    });
    const callOrder: string[] = [];
    const recompressNotes = vi.fn(async () => {
      callOrder.push('notes');
      return noteStats;
    });
    const recompressBeans = vi.fn(async () => {
      callOrder.push('beans');
      return beanStats;
    });
    const recompressLogos = vi.fn(async () => {
      callOrder.push('logos');
      return logoStats;
    });

    vi.doMock('dexie', () => {
      attemptedDexieLoad();
      return {};
    });
    vi.doMock('@/lib/core/db', () => {
      attemptedDatabaseLoad();
      return {};
    });
    vi.doMock('@/lib/data/adapters/dexie/imageMaintenance', () => {
      attemptedAdapterLoad();
      return {};
    });
    vi.doMock('@/lib/data/adapters/dexie/coffeeBeanImageRepository', () => {
      attemptedAdapterLoad();
      return {};
    });
    vi.doMock('@/lib/data/adapters/dexie/brewingNoteImageRepository', () => {
      attemptedAdapterLoad();
      return {};
    });
    vi.doMock('@/lib/settings/roasterLogoRecompression', () => ({
      recompressOversizedRoasterLogos: recompressLogos,
    }));

    try {
      const { configureRepositories } = await import('@/lib/data/repositories');
      configureRepositories({
        imageMaintenance: {
          recompressBrewingNoteImages: recompressNotes,
          recompressCoffeeBeanImages: recompressBeans,
        },
      } as unknown as DataRepositories);

      const { recompressOversizedAppImages } =
        await import('./recompressAppImages');
      const result = await recompressOversizedAppImages();

      expect(recompressNotes).toHaveBeenCalledOnce();
      expect(recompressBeans).toHaveBeenCalledOnce();
      expect(recompressLogos).toHaveBeenCalledOnce();
      expect(callOrder).toEqual(['notes', 'beans', 'logos']);
      expect(result).toEqual({
        scannedCount: 9,
        candidateCount: 6,
        compressedCount: 4,
        failedCount: 1,
        savedBytes: 60,
        scopes: {
          brewingNotes: noteStats,
          coffeeBeans: beanStats,
          roasterLogos: logoStats,
        },
      });
      expect(attemptedDexieLoad).not.toHaveBeenCalled();
      expect(attemptedDatabaseLoad).not.toHaveBeenCalled();
      expect(attemptedAdapterLoad).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock('dexie');
      vi.doUnmock('@/lib/core/db');
      vi.doUnmock('@/lib/data/adapters/dexie/imageMaintenance');
      vi.doUnmock('@/lib/data/adapters/dexie/coffeeBeanImageRepository');
      vi.doUnmock('@/lib/data/adapters/dexie/brewingNoteImageRepository');
      vi.doUnmock('@/lib/settings/roasterLogoRecompression');
      vi.resetModules();
    }
  });
});
