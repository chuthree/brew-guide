import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type {
  CoffeeBeanImageRecord,
  CoffeeBeanImageThumbnailRecord,
} from './imageRecords';

const mocks = vi.hoisted(() => {
  const beans = new Map<string, CoffeeBean>();
  const images = new Map<string, CoffeeBeanImageRecord>();
  const thumbnails = new Map<string, CoffeeBeanImageThumbnailRecord>();
  const compressBase64Image = vi.fn();

  const table = <T extends object>(records: Map<string, T>, key: keyof T) => ({
    get: vi.fn((id: string) => Promise.resolve(records.get(id))),
    put: vi.fn((record: T) => {
      records.set(String(record[key]), record);
      return Promise.resolve();
    }),
    bulkGet: vi.fn((ids: string[]) =>
      Promise.resolve(ids.map(id => records.get(id)))
    ),
    bulkPut: vi.fn((nextRecords: T[]) => {
      nextRecords.forEach(record => records.set(String(record[key]), record));
      return Promise.resolve();
    }),
    delete: vi.fn((id: string) => {
      records.delete(id);
      return Promise.resolve();
    }),
    bulkDelete: vi.fn((ids: string[]) => {
      ids.forEach(id => records.delete(id));
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      records.clear();
      return Promise.resolve();
    }),
    count: vi.fn(() => Promise.resolve(records.size)),
    toArray: vi.fn(() => Promise.resolve(Array.from(records.values()))),
    toCollection: vi.fn(() => ({
      primaryKeys: vi.fn(() => Promise.resolve(Array.from(records.keys()))),
    })),
    where: vi.fn(() => ({
      anyOf: (ids: string[]) => ({
        primaryKeys: vi.fn(() =>
          Promise.resolve(ids.filter(id => records.has(id)))
        ),
      }),
    })),
  });

  return {
    beans,
    images,
    thumbnails,
    compressBase64Image,
    db: {
      coffeeBeans: table(beans, 'id'),
      coffeeBeanImages: table(images, 'beanId'),
      coffeeBeanImageThumbnails: table(thumbnails, 'beanId'),
      transaction: vi.fn(async (...args: unknown[]) => {
        const callback = args[args.length - 1] as () => Promise<void>;
        await callback();
      }),
    },
  };
});

vi.mock('@/lib/core/db', () => ({ db: mocks.db }));
vi.mock('@/lib/utils/imageCompression', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/utils/imageCompression')
  >('@/lib/utils/imageCompression');
  return {
    ...actual,
    compressBase64Image: mocks.compressBase64Image,
  };
});

import {
  coffeeBeanImageRepository,
  coffeeBeanPersistence,
} from '@/lib/data/adapters/dexie/coffeeBeanImageRepository';
import {
  createDexieImageMaintenance,
  type DexieImageMaintenanceDatabase,
} from '@/lib/data/adapters/dexie/imageMaintenance';

const baseBean: CoffeeBean = {
  id: 'bean-1',
  timestamp: 1,
  name: 'Bean',
};

describe('coffee bean image repository records', () => {
  beforeEach(() => {
    mocks.beans.clear();
    mocks.images.clear();
    mocks.thumbnails.clear();
    mocks.compressBase64Image.mockReset();
    vi.clearAllMocks();
  });

  it('finds bean image ids from original records when thumbnails are missing', async () => {
    mocks.images.set('image-only', {
      beanId: 'image-only',
      image: 'original',
      updatedAt: 1,
    });
    mocks.thumbnails.set('thumbnail-only', {
      beanId: 'thumbnail-only',
      imageThumbnail: 'thumbnail',
      updatedAt: 1,
    });

    await expect(coffeeBeanImageRepository.getBeanIds()).resolves.toEqual(
      expect.arrayContaining(['image-only', 'thumbnail-only'])
    );
  });

  it('falls back to the original when no usable thumbnail is available', async () => {
    const original = 'data:image/jpeg;base64,original-source';
    const unusableThumbnail = 'x'.repeat(512 * 1024 + 1);
    mocks.images.set('bean-1', {
      beanId: 'bean-1',
      image: original,
      imageThumbnail: unusableThumbnail,
      updatedAt: 1,
    });
    mocks.thumbnails.set('bean-1', {
      beanId: 'bean-1',
      imageThumbnail: unusableThumbnail,
      updatedAt: 1,
    });

    await expect(coffeeBeanImageRepository.getSource('bean-1')).resolves.toBe(
      original
    );
  });

  it('reads front, back, and thumbnail display sources without altering Data URLs', async () => {
    const record: CoffeeBeanImageRecord = {
      beanId: 'bean-1',
      image: 'data:image/jpeg;base64,front-original',
      backImage: 'data:image/png;base64,back-original',
      updatedAt: 1,
    };
    const thumbnail: CoffeeBeanImageThumbnailRecord = {
      beanId: 'bean-1',
      imageThumbnail: 'data:image/webp;base64,front-thumbnail',
      backImageThumbnail: 'data:image/webp;base64,back-thumbnail',
      updatedAt: 1,
    };
    mocks.images.set('bean-1', record);
    mocks.thumbnails.set('bean-1', thumbnail);

    await expect(
      coffeeBeanImageRepository.getSource('bean-1', { mode: 'original' })
    ).resolves.toBe(record.image);
    await expect(
      coffeeBeanImageRepository.getSource('bean-1', {
        side: 'back',
        mode: 'original',
      })
    ).resolves.toBe(record.backImage);
    await expect(coffeeBeanImageRepository.getSource('bean-1')).resolves.toBe(
      thumbnail.imageThumbnail
    );
    await expect(
      coffeeBeanImageRepository.getSource('bean-1', { side: 'back' })
    ).resolves.toBe(thumbnail.backImageThumbnail);
  });

  it('returns no source when the bean has no image record', async () => {
    await expect(
      coffeeBeanImageRepository.getSource('missing', { mode: 'original' })
    ).resolves.toBeUndefined();
  });

  it('filters image ids by requested side', async () => {
    mocks.images.set('front-only', {
      beanId: 'front-only',
      image: 'front-original',
      updatedAt: 1,
    });
    mocks.images.set('back-only', {
      beanId: 'back-only',
      backImage: 'back-original',
      updatedAt: 1,
    });

    await expect(
      coffeeBeanImageRepository.getBeanIds(['front-only', 'back-only'], {
        side: 'front',
      })
    ).resolves.toEqual(['front-only']);
    await expect(
      coffeeBeanImageRepository.getBeanIds(['front-only', 'back-only'], {
        side: 'back',
      })
    ).resolves.toEqual(['back-only']);
    await expect(
      coffeeBeanImageRepository.getBeanIds(['front-only', 'back-only'])
    ).resolves.toEqual(expect.arrayContaining(['front-only', 'back-only']));
  });

  it('reads side-specific image records in bounded batches', async () => {
    const beanIds = Array.from({ length: 65 }, (_, index) => `bean-${index}`);
    beanIds.forEach(beanId => {
      mocks.images.set(beanId, {
        beanId,
        image: 'front-original',
        updatedAt: 1,
      });
    });

    await expect(
      coffeeBeanImageRepository.getBeanIds(beanIds, { side: 'front' })
    ).resolves.toHaveLength(beanIds.length);

    expect(mocks.db.coffeeBeanImages.bulkGet).toHaveBeenCalledTimes(3);
    expect(
      vi
        .mocked(mocks.db.coffeeBeanImages.bulkGet)
        .mock.calls.every(([ids]) => ids.length <= 32)
    ).toBe(true);
  });

  it('preserves stored images when replacing lightweight beans', async () => {
    mocks.images.set('bean-1', {
      beanId: 'bean-1',
      image: 'original',
      updatedAt: 1,
    });

    await coffeeBeanPersistence.replaceAllWithImages([
      { ...baseBean, timestamp: 2 },
    ]);

    expect(mocks.images.get('bean-1')?.image).toBe('original');
  });

  it('writes the bean and its image records in one transaction', async () => {
    await coffeeBeanPersistence.saveWithImages({
      ...baseBean,
      image: 'original',
    });

    expect(mocks.db.transaction).toHaveBeenCalledWith(
      'rw',
      mocks.db.coffeeBeans,
      mocks.db.coffeeBeanImages,
      mocks.db.coffeeBeanImageThumbnails,
      expect.any(Function)
    );
    expect(mocks.beans.get('bean-1')).toBeDefined();
    expect(mocks.images.get('bean-1')?.image).toBe('original');
  });

  it('blocks accidental destructive bean replacements', async () => {
    for (let index = 0; index < 20; index += 1) {
      mocks.beans.set(`bean-${index}`, {
        ...baseBean,
        id: `bean-${index}`,
        name: `Bean ${index}`,
      });
    }

    const replaced = await coffeeBeanPersistence.replaceAllWithImages([
      { ...baseBean, id: 'incoming-bean', name: 'Incoming Bean' },
    ]);

    expect(replaced).toBe(false);
    expect(mocks.beans.size).toBe(20);
    expect(mocks.db.coffeeBeans.clear).not.toHaveBeenCalled();
  });

  it('allows explicit destructive bean replacements', async () => {
    for (let index = 0; index < 20; index += 1) {
      mocks.beans.set(`bean-${index}`, {
        ...baseBean,
        id: `bean-${index}`,
        name: `Bean ${index}`,
      });
    }

    const replaced = await coffeeBeanPersistence.replaceAllWithImages(
      [{ ...baseBean, id: 'incoming-bean', name: 'Incoming Bean' }],
      { allowDestructiveReplace: true }
    );

    expect(replaced).toBe(true);
    expect(mocks.beans.size).toBe(1);
    expect(mocks.beans.has('incoming-bean')).toBe(true);
  });

  it('recompresses oversized bean images and expires changed-side thumbnails', async () => {
    const oversizedImage = `data:image/jpeg;base64,${'a'.repeat(440 * 1024)}`;
    const smallBackImage = 'data:image/jpeg;base64,abcd';
    const compressedImage = `data:image/webp;base64,${'b'.repeat(120 * 1024)}`;

    mocks.images.set('bean-1', {
      beanId: 'bean-1',
      image: oversizedImage,
      backImage: smallBackImage,
      imageThumbnail: 'front-thumbnail',
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 1,
    });
    mocks.thumbnails.set('bean-1', {
      beanId: 'bean-1',
      imageThumbnail: 'front-thumbnail',
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 1,
    });
    mocks.compressBase64Image.mockResolvedValue(compressedImage);

    const stats = await createDexieImageMaintenance(
      mocks.db as unknown as DexieImageMaintenanceDatabase
    ).recompressCoffeeBeanImages();

    expect(mocks.compressBase64Image).toHaveBeenCalledTimes(1);
    expect(mocks.images.get('bean-1')).toMatchObject({
      image: compressedImage,
      backImage: smallBackImage,
      backImageThumbnail: 'back-thumbnail',
    });
    expect(mocks.images.get('bean-1')?.imageThumbnail).toBeUndefined();
    expect(mocks.thumbnails.get('bean-1')).toMatchObject({
      backImageThumbnail: 'back-thumbnail',
    });
    expect(mocks.thumbnails.get('bean-1')?.imageThumbnail).toBeUndefined();
    expect(stats).toMatchObject({
      scannedCount: 1,
      candidateCount: 1,
      compressedCount: 1,
      failedCount: 0,
    });
    expect(stats.savedBytes).toBeGreaterThan(0);
  });
});
