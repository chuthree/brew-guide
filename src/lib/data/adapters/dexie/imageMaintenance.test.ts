import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import type {
  CoffeeBeanImageRecord,
  CoffeeBeanImageThumbnailRecord,
} from '@/lib/coffee-beans/imageRecords';
import type {
  BrewingNoteImageRecord,
  BrewingNoteImageThumbnailRecord,
} from '@/lib/notes/imageRecords';
import { createDexieImageMaintenance } from './imageMaintenance';

const mocks = vi.hoisted(() => ({
  compressBase64Image: vi.fn(),
}));

vi.mock('@/lib/utils/imageCompression', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/utils/imageCompression')
  >('@/lib/utils/imageCompression');
  return {
    ...actual,
    compressBase64Image: mocks.compressBase64Image,
  };
});

class ImageMaintenanceTestDatabase extends Dexie {
  coffeeBeans!: Table<CoffeeBean, string>;
  coffeeBeanImages!: Table<CoffeeBeanImageRecord, string>;
  coffeeBeanImageThumbnails!: Table<CoffeeBeanImageThumbnailRecord, string>;
  brewingNotes!: Table<BrewingNote, string>;
  brewingNoteImages!: Table<BrewingNoteImageRecord, string>;
  brewingNoteImageThumbnails!: Table<BrewingNoteImageThumbnailRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      coffeeBeans: 'id',
      coffeeBeanImages: 'beanId',
      coffeeBeanImageThumbnails: 'beanId',
      brewingNotes: 'id',
      brewingNoteImages: 'noteId',
      brewingNoteImageThumbnails: 'noteId',
    });
  }
}

const oversizedBeanImage = `data:image/jpeg;base64,${'a'.repeat(440 * 1024)}`;
const oversizedNoteImage = `data:image/jpeg;base64,${'a'.repeat(200 * 1024)}`;
const oversizedGifImage = `data:image/gif;base64,${'a'.repeat(440 * 1024)}`;
const smallImage = 'data:image/jpeg;base64,abcd';
const compressedFrontImage = `data:image/webp;base64,${'b'.repeat(40 * 1024)}`;
const compressedBackImage = `data:image/webp;base64,${'c'.repeat(40 * 1024)}`;
const compressedNoteImage = compressedFrontImage;

describe('Dexie image maintenance', () => {
  let database: ImageMaintenanceTestDatabase;

  beforeEach(async () => {
    database = new ImageMaintenanceTestDatabase(
      `BrewGuideImageMaintenanceTest-${Date.now()}-${Math.random()}`
    );
    await database.open();
    mocks.compressBase64Image.mockReset();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await database.delete();
  });

  it('recompresses bean originals, expires only changed thumbnails, and skips other records', async () => {
    const bean = { id: 'bean-1', timestamp: 1, name: 'Bean' } as CoffeeBean;
    const beanBackImage = {
      id: 'bean-2',
      timestamp: 2,
      name: 'Back image',
    } as CoffeeBean;
    const beanNoImages = {
      id: 'bean-3',
      timestamp: 3,
      name: 'No image',
    } as CoffeeBean;
    const beanSmallImage = {
      id: 'bean-4',
      timestamp: 4,
      name: 'Small image',
    } as CoffeeBean;
    const beanGifImage = {
      id: 'bean-5',
      timestamp: 5,
      name: 'GIF image',
    } as CoffeeBean;
    await database.coffeeBeans.bulkPut([
      bean,
      beanBackImage,
      beanNoImages,
      beanSmallImage,
      beanGifImage,
    ]);

    const noImageRecord: CoffeeBeanImageRecord = {
      beanId: beanNoImages.id,
      updatedAt: 2,
    };
    const smallImageRecord: CoffeeBeanImageRecord = {
      beanId: beanSmallImage.id,
      image: smallImage,
      updatedAt: 4,
    };
    const gifImageRecord: CoffeeBeanImageRecord = {
      beanId: beanGifImage.id,
      image: oversizedGifImage,
      updatedAt: 5,
    };
    await database.coffeeBeanImages.bulkPut([
      {
        beanId: bean.id,
        image: oversizedBeanImage,
        backImage: smallImage,
        imageThumbnail: 'embedded-front-thumbnail',
        backImageThumbnail: 'embedded-back-thumbnail',
        updatedAt: 1,
      },
      {
        beanId: beanBackImage.id,
        backImage: oversizedBeanImage,
        backImageThumbnail: 'embedded-back-thumbnail',
        updatedAt: 2,
      },
      noImageRecord,
      smallImageRecord,
      gifImageRecord,
    ]);
    await database.coffeeBeanImageThumbnails.bulkPut([
      {
        beanId: bean.id,
        imageThumbnail: 'front-thumbnail',
        backImageThumbnail: 'back-thumbnail',
        updatedAt: 1,
      },
      {
        beanId: beanBackImage.id,
        imageThumbnail: 'front-thumbnail',
        backImageThumbnail: 'back-thumbnail',
        updatedAt: 2,
      },
      {
        beanId: beanSmallImage.id,
        imageThumbnail: 'small-thumbnail',
        updatedAt: 4,
      },
      {
        beanId: beanGifImage.id,
        imageThumbnail: 'gif-thumbnail',
        updatedAt: 5,
      },
    ]);
    mocks.compressBase64Image
      .mockResolvedValueOnce(compressedFrontImage)
      .mockResolvedValueOnce(compressedBackImage);

    const stats =
      await createDexieImageMaintenance(database).recompressCoffeeBeanImages();

    expect(mocks.compressBase64Image).toHaveBeenCalledTimes(2);
    expect(await database.coffeeBeanImages.get(bean.id)).toMatchObject({
      image: compressedFrontImage,
      backImage: smallImage,
      imageThumbnail: undefined,
      backImageThumbnail: 'embedded-back-thumbnail',
    });
    expect(await database.coffeeBeanImageThumbnails.get(bean.id)).toMatchObject(
      {
        imageThumbnail: undefined,
        backImageThumbnail: 'back-thumbnail',
      }
    );
    expect(await database.coffeeBeanImages.get(beanBackImage.id)).toMatchObject(
      {
        backImage: compressedBackImage,
        backImageThumbnail: undefined,
      }
    );
    expect(
      await database.coffeeBeanImageThumbnails.get(beanBackImage.id)
    ).toMatchObject({
      imageThumbnail: 'front-thumbnail',
      backImageThumbnail: undefined,
    });
    expect(await database.coffeeBeanImages.get(beanNoImages.id)).toEqual(
      noImageRecord
    );
    expect(await database.coffeeBeanImages.get(beanSmallImage.id)).toEqual(
      smallImageRecord
    );
    expect(await database.coffeeBeanImages.get(beanGifImage.id)).toEqual(
      gifImageRecord
    );
    expect(
      await database.coffeeBeanImageThumbnails.get(beanSmallImage.id)
    ).toEqual({
      beanId: beanSmallImage.id,
      imageThumbnail: 'small-thumbnail',
      updatedAt: 4,
    });
    expect(
      await database.coffeeBeanImageThumbnails.get(beanGifImage.id)
    ).toEqual({
      beanId: beanGifImage.id,
      imageThumbnail: 'gif-thumbnail',
      updatedAt: 5,
    });
    expect(await database.coffeeBeans.get(bean.id)).toEqual(bean);
    expect(stats).toMatchObject({
      scannedCount: 5,
      candidateCount: 2,
      compressedCount: 2,
      failedCount: 0,
    });
    expect(stats.savedBytes).toBeGreaterThan(0);
  });

  it('preserves brewing note image order and removes changed notes thumbnails', async () => {
    const single: BrewingNoteImageRecord = {
      noteId: 'note-single',
      image: oversizedNoteImage,
      updatedAt: 1,
    };
    const multiple: BrewingNoteImageRecord = {
      noteId: 'note-multiple',
      image: oversizedNoteImage,
      images: [oversizedNoteImage, smallImage, oversizedNoteImage],
      updatedAt: 2,
    };
    const noImages: BrewingNoteImageRecord = {
      noteId: 'note-empty',
      updatedAt: 3,
    };
    await database.brewingNoteImages.bulkPut([single, multiple, noImages]);
    await database.brewingNoteImageThumbnails.bulkPut([
      { noteId: single.noteId, imageThumbnail: 'single-thumb', updatedAt: 1 },
      { noteId: multiple.noteId, imageThumbnail: 'multi-thumb', updatedAt: 2 },
      { noteId: noImages.noteId, imageThumbnail: 'empty-thumb', updatedAt: 3 },
    ]);
    mocks.compressBase64Image.mockResolvedValue(compressedNoteImage);

    const stats =
      await createDexieImageMaintenance(database).recompressBrewingNoteImages();

    expect(mocks.compressBase64Image).toHaveBeenCalledTimes(3);
    expect(await database.brewingNoteImages.get(single.noteId)).toMatchObject({
      image: compressedNoteImage,
      images: [compressedNoteImage],
    });
    expect(await database.brewingNoteImages.get(multiple.noteId)).toMatchObject(
      {
        image: compressedNoteImage,
        images: [compressedNoteImage, smallImage, compressedNoteImage],
      }
    );
    expect(await database.brewingNoteImages.get(noImages.noteId)).toEqual(
      noImages
    );
    expect(
      await database.brewingNoteImageThumbnails.get(single.noteId)
    ).toBeUndefined();
    expect(
      await database.brewingNoteImageThumbnails.get(multiple.noteId)
    ).toBeUndefined();
    expect(
      await database.brewingNoteImageThumbnails.get(noImages.noteId)
    ).toEqual({
      noteId: noImages.noteId,
      imageThumbnail: 'empty-thumb',
      updatedAt: 3,
    });
    expect(stats).toMatchObject({
      scannedCount: 3,
      candidateCount: 3,
      compressedCount: 3,
      failedCount: 0,
    });
  });

  it('counts a failed image and continues with following images', async () => {
    const record: BrewingNoteImageRecord = {
      noteId: 'note-partial-compression',
      image: oversizedNoteImage,
      images: [oversizedNoteImage, oversizedNoteImage],
      updatedAt: 1,
    };
    await database.brewingNoteImages.put(record);
    mocks.compressBase64Image
      .mockRejectedValueOnce(new Error('injected compression failure'))
      .mockResolvedValueOnce(compressedNoteImage);
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const stats =
      await createDexieImageMaintenance(database).recompressBrewingNoteImages();

    expect(mocks.compressBase64Image).toHaveBeenCalledTimes(2);
    expect(await database.brewingNoteImages.get(record.noteId)).toMatchObject({
      image: oversizedNoteImage,
      images: [oversizedNoteImage, compressedNoteImage],
    });
    expect(consoleError).toHaveBeenCalledOnce();
    expect(stats).toMatchObject({
      candidateCount: 2,
      compressedCount: 1,
      failedCount: 1,
    });
  });

  it('keeps earlier writes and stops the batch when a storage write fails', async () => {
    const beanIds = ['bean-1', 'bean-2', 'bean-3'];
    await database.coffeeBeanImages.bulkPut(
      beanIds.map(beanId => ({
        beanId,
        image: oversizedBeanImage,
        updatedAt: 1,
      }))
    );
    mocks.compressBase64Image.mockResolvedValue(compressedFrontImage);

    const originalPut = database.coffeeBeanImages.put.bind(
      database.coffeeBeanImages
    );
    vi.spyOn(database.coffeeBeanImages, 'put').mockImplementation(record => {
      if (record.beanId === 'bean-2') {
        throw new Error('injected storage failure');
      }
      return originalPut(record);
    });

    await expect(
      createDexieImageMaintenance(database).recompressCoffeeBeanImages()
    ).rejects.toThrow('injected storage failure');

    expect(mocks.compressBase64Image).toHaveBeenCalledTimes(2);
    expect(await database.coffeeBeanImages.get('bean-1')).toMatchObject({
      image: compressedFrontImage,
    });
    expect(await database.coffeeBeanImages.get('bean-2')).toMatchObject({
      image: oversizedBeanImage,
    });
    expect(await database.coffeeBeanImages.get('bean-3')).toMatchObject({
      image: oversizedBeanImage,
    });
  });
});
