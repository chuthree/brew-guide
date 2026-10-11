import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { BrewGuideDB } from '@/lib/core/db';
import type {
  CoffeeBeanImageRecord,
  CoffeeBeanImageThumbnailRecord,
} from '@/lib/coffee-beans/imageRecords';

vi.mock('@/lib/core/db', () => ({ db: {} }));

import { createDexieCoffeeBeanPersistence } from '@/lib/data/adapters/dexie/coffeeBeanImageRepository';

class CoffeeBeanParityDatabase extends Dexie {
  coffeeBeans!: Table<CoffeeBean, string>;
  coffeeBeanImages!: Table<CoffeeBeanImageRecord, string>;
  coffeeBeanImageThumbnails!: Table<CoffeeBeanImageThumbnailRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      coffeeBeans: 'id',
      coffeeBeanImages: 'beanId',
      coffeeBeanImageThumbnails: 'beanId',
    });
  }
}

const baseBean = (id: string, timestamp: number, extra = {}): CoffeeBean =>
  ({ id, timestamp, name: `Bean ${id}`, ...extra }) as CoffeeBean;

describe('Stage 3G-4B Dexie observable behavior reference', () => {
  let database: CoffeeBeanParityDatabase;

  beforeEach(async () => {
    database = new CoffeeBeanParityDatabase(
      `CoffeeBeanPersistenceParity-${Date.now()}-${Math.random()}`
    );
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('distinguishes a missing image property from an own undefined property', async () => {
    const persistence = createDexieCoffeeBeanPersistence(
      database as unknown as BrewGuideDB
    );
    const imageRecord: CoffeeBeanImageRecord = {
      beanId: 'bean',
      image: 'front-original',
      backImage: 'back-original',
      updatedAt: 10,
    };
    const thumbnailRecord: CoffeeBeanImageThumbnailRecord = {
      beanId: 'bean',
      imageThumbnail: 'front-thumbnail',
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 10,
    };
    await database.coffeeBeanImages.put(imageRecord);
    await database.coffeeBeanImageThumbnails.put(thumbnailRecord);

    await persistence.saveWithImages(baseBean('bean', 20));
    expect(await database.coffeeBeanImages.get('bean')).toEqual(imageRecord);
    expect(await database.coffeeBeanImageThumbnails.get('bean')).toEqual(
      thumbnailRecord
    );

    await persistence.saveWithImages(
      baseBean('bean', 30, { image: undefined })
    );
    expect(await database.coffeeBeanImages.get('bean')).toEqual({
      beanId: 'bean',
      image: 'front-original',
      backImage: 'back-original',
      updatedAt: 30,
      imageThumbnail: 'front-thumbnail',
      backImageThumbnail: 'back-thumbnail',
    });
    expect(await database.coffeeBeanImageThumbnails.get('bean')).toEqual({
      beanId: 'bean',
      imageThumbnail: 'front-thumbnail',
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 30,
    });
  });

  it('updates the shared image-record timestamp when only one non-empty side is patched', async () => {
    const persistence = createDexieCoffeeBeanPersistence(
      database as unknown as BrewGuideDB
    );
    await database.coffeeBeanImages.put({
      beanId: 'bean',
      image: 'front-original',
      backImage: 'back-original',
      updatedAt: 10,
    });
    await database.coffeeBeanImageThumbnails.put({
      beanId: 'bean',
      imageThumbnail: 'front-thumbnail',
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 10,
    });

    await persistence.saveWithImages(
      baseBean('bean', 40, { image: 'front-updated' })
    );

    expect(await database.coffeeBeanImages.get('bean')).toEqual({
      beanId: 'bean',
      image: 'front-updated',
      backImage: 'back-original',
      imageThumbnail: undefined,
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 40,
    });
    expect(await database.coffeeBeanImageThumbnails.get('bean')).toEqual({
      beanId: 'bean',
      imageThumbnail: undefined,
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 40,
    });
  });

  it('clears only the explicitly empty side on ordinary save', async () => {
    const persistence = createDexieCoffeeBeanPersistence(
      database as unknown as BrewGuideDB
    );
    await database.coffeeBeanImages.put({
      beanId: 'bean',
      image: 'front-original',
      backImage: 'back-original',
      imageThumbnail: 'front-thumbnail',
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 10,
    });
    await database.coffeeBeanImageThumbnails.put({
      beanId: 'bean',
      imageThumbnail: 'front-thumbnail',
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 10,
    });

    await persistence.saveWithImages(baseBean('bean', 40, { image: '' }));

    expect(await database.coffeeBeanImages.get('bean')).toEqual({
      beanId: 'bean',
      backImage: 'back-original',
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 40,
    });
    expect(await database.coffeeBeanImageThumbnails.get('bean')).toEqual({
      beanId: 'bean',
      backImageThumbnail: 'back-thumbnail',
      updatedAt: 40,
    });
  });

  it('uses last duplicate-key image record in replaceAll and removes thumbnails', async () => {
    const persistence = createDexieCoffeeBeanPersistence(
      database as unknown as BrewGuideDB
    );
    await database.coffeeBeans.put(baseBean('bean', 1));
    await database.coffeeBeanImages.put({
      beanId: 'bean',
      image: 'old-front',
      backImage: 'old-back',
      updatedAt: 1,
    });
    await database.coffeeBeanImageThumbnails.put({
      beanId: 'bean',
      imageThumbnail: 'old-front-thumb',
      backImageThumbnail: 'old-back-thumb',
      updatedAt: 1,
    });

    await persistence.replaceAllWithImages(
      [
        baseBean('bean', 20, { name: 'first', image: 'first-front' }),
        baseBean('bean', 30, { name: 'last', backImage: 'last-back' }),
      ],
      { allowDestructiveReplace: true }
    );

    expect(await database.coffeeBeans.get('bean')).toMatchObject({
      name: 'last',
    });
    expect(await database.coffeeBeanImages.get('bean')).toEqual({
      beanId: 'bean',
      backImage: 'last-back',
      updatedAt: 30,
    });
    expect(
      await database.coffeeBeanImageThumbnails.get('bean')
    ).toBeUndefined();
  });

  it('lets a valid duplicate image record win over an explicit-empty duplicate', async () => {
    const persistence = createDexieCoffeeBeanPersistence(
      database as unknown as BrewGuideDB
    );

    await persistence.replaceAllWithImages(
      [
        baseBean('bean', 20, { image: 'valid-front' }),
        baseBean('bean', 30, { image: undefined }),
      ],
      { allowDestructiveReplace: true }
    );

    expect(await database.coffeeBeanImages.get('bean')).toEqual({
      beanId: 'bean',
      image: 'valid-front',
      updatedAt: 20,
    });
  });
});
