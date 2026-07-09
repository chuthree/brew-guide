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
  getCoffeeBeanImageBeanIds,
  getCoffeeBeanImageSource,
  recompressOversizedCoffeeBeanImages,
  replaceCoffeeBeansWithSplitImages,
} from './imageRepository';

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

    await expect(getCoffeeBeanImageBeanIds()).resolves.toEqual(
      expect.arrayContaining(['image-only', 'thumbnail-only'])
    );
  });

  it('falls back to original image when thumbnail is missing', async () => {
    mocks.images.set('bean-1', {
      beanId: 'bean-1',
      image: 'original',
      updatedAt: 1,
    });

    await expect(getCoffeeBeanImageSource('bean-1')).resolves.toBe('original');
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
      getCoffeeBeanImageBeanIds(['front-only', 'back-only'], {
        side: 'front',
      })
    ).resolves.toEqual(['front-only']);
    await expect(
      getCoffeeBeanImageBeanIds(['front-only', 'back-only'], {
        side: 'back',
      })
    ).resolves.toEqual(['back-only']);
    await expect(
      getCoffeeBeanImageBeanIds(['front-only', 'back-only'])
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
      getCoffeeBeanImageBeanIds(beanIds, { side: 'front' })
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

    await replaceCoffeeBeansWithSplitImages([{ ...baseBean, timestamp: 2 }]);

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

    const replaced = await replaceCoffeeBeansWithSplitImages([
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

    const replaced = await replaceCoffeeBeansWithSplitImages(
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

    const stats = await recompressOversizedCoffeeBeanImages();

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
