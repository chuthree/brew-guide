import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { BrewGuideDB } from '@/lib/core/db';
import type { CoffeeBean } from '@/types/app';
import type {
  BrewingNoteImageRecord,
  BrewingNoteImageThumbnailRecord,
} from '@/lib/notes/imageRecords';
import type {
  CoffeeBeanImageRecord,
  CoffeeBeanImageThumbnailRecord,
} from '@/lib/coffee-beans/imageRecords';
import { createDexieBrewingNotePersistence } from './brewingNoteImageRepository';
import { createDexieCoffeeBeanPersistence } from './coffeeBeanImageRepository';

class ImagePersistenceTestDatabase extends Dexie {
  brewingNotes!: Table<BrewingNote, string>;
  brewingNoteImages!: Table<BrewingNoteImageRecord, string>;
  brewingNoteImageThumbnails!: Table<BrewingNoteImageThumbnailRecord, string>;
  coffeeBeans!: Table<CoffeeBean, string>;
  coffeeBeanImages!: Table<CoffeeBeanImageRecord, string>;
  coffeeBeanImageThumbnails!: Table<CoffeeBeanImageThumbnailRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      brewingNotes: 'id',
      brewingNoteImages: 'noteId',
      brewingNoteImageThumbnails: 'noteId',
      coffeeBeans: 'id',
      coffeeBeanImages: 'beanId',
      coffeeBeanImageThumbnails: 'beanId',
    });
  }
}

const withTableFailure = (
  database: ImagePersistenceTestDatabase,
  tableName: keyof ImagePersistenceTestDatabase,
  methodName: string
): BrewGuideDB => {
  const table = (database as unknown as Record<string, object>)[tableName];
  const failingTable = new Proxy(table, {
    get(target, property) {
      if (property === methodName) {
        return async () => {
          throw new Error(
            `Injected ${String(tableName)}.${methodName} failure`
          );
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return new Proxy(database, {
    get(target, property) {
      if (property === tableName) return failingTable;

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as unknown as BrewGuideDB;
};

const bean: CoffeeBean = {
  id: 'bean-1',
  timestamp: 10,
  name: 'Old bean',
};

const note: BrewingNote = {
  id: 'note-1',
  timestamp: 10,
  rating: 4,
  taste: {},
  notes: 'Old note',
};

describe('Dexie CoffeeBeanPersistence transactions', () => {
  let database: ImagePersistenceTestDatabase;

  beforeEach(async () => {
    database = new ImagePersistenceTestDatabase(
      `BrewGuideCoffeeBeanPersistenceTest-${Date.now()}-${Math.random()}`
    );
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('rolls back bean, original, and thumbnail writes when save fails', async () => {
    const oldBean = { ...bean, name: 'Stored bean' };
    const oldImage: CoffeeBeanImageRecord = {
      beanId: bean.id,
      image: 'data:image/jpeg;base64,old',
      imageThumbnail: 'data:image/jpeg;base64,old-thumb',
      updatedAt: 10,
    };
    const oldThumbnail: CoffeeBeanImageThumbnailRecord = {
      beanId: bean.id,
      imageThumbnail: 'data:image/jpeg;base64,old-thumb',
      updatedAt: 10,
    };
    await database.coffeeBeans.put(oldBean);
    await database.coffeeBeanImages.put(oldImage);
    await database.coffeeBeanImageThumbnails.put(oldThumbnail);

    const persistence = createDexieCoffeeBeanPersistence(
      withTableFailure(database, 'coffeeBeans', 'put')
    );
    await expect(
      persistence.saveWithImages(
        {
          ...bean,
          name: 'New bean',
          image: 'data:image/jpeg;base64,new',
        },
        { generateThumbnails: false }
      )
    ).rejects.toThrow('Injected coffeeBeans.put failure');

    expect(await database.coffeeBeans.get(bean.id)).toEqual(oldBean);
    expect(await database.coffeeBeanImages.get(bean.id)).toEqual(oldImage);
    expect(await database.coffeeBeanImageThumbnails.get(bean.id)).toEqual(
      oldThumbnail
    );
  });

  it('rolls back bean and image deletions when deleting a bean fails', async () => {
    const image: CoffeeBeanImageRecord = {
      beanId: bean.id,
      image: 'data:image/jpeg;base64,stored',
      updatedAt: 10,
    };
    const thumbnail: CoffeeBeanImageThumbnailRecord = {
      beanId: bean.id,
      imageThumbnail: 'data:image/jpeg;base64,thumb',
      updatedAt: 10,
    };
    await database.coffeeBeans.put(bean);
    await database.coffeeBeanImages.put(image);
    await database.coffeeBeanImageThumbnails.put(thumbnail);

    const persistence = createDexieCoffeeBeanPersistence(
      withTableFailure(database, 'coffeeBeanImageThumbnails', 'delete')
    );
    await expect(persistence.deleteWithImages(bean.id)).rejects.toThrow(
      'Injected coffeeBeanImageThumbnails.delete failure'
    );

    expect(await database.coffeeBeans.get(bean.id)).toEqual(bean);
    expect(await database.coffeeBeanImages.get(bean.id)).toEqual(image);
    expect(await database.coffeeBeanImageThumbnails.get(bean.id)).toEqual(
      thumbnail
    );
  });

  it('rolls back replaceAll writes when image cleanup fails', async () => {
    const oldBean = { ...bean, name: 'Stored bean' };
    const oldImage: CoffeeBeanImageRecord = {
      beanId: bean.id,
      image: 'data:image/jpeg;base64,old',
      updatedAt: 10,
    };
    const oldThumbnail: CoffeeBeanImageThumbnailRecord = {
      beanId: bean.id,
      imageThumbnail: 'data:image/jpeg;base64,old-thumb',
      updatedAt: 10,
    };
    await database.coffeeBeans.put(oldBean);
    await database.coffeeBeanImages.put(oldImage);
    await database.coffeeBeanImageThumbnails.put(oldThumbnail);

    const persistence = createDexieCoffeeBeanPersistence(
      withTableFailure(database, 'coffeeBeanImageThumbnails', 'bulkDelete')
    );
    await expect(
      persistence.replaceAllWithImages([
        { ...bean, name: 'Restored bean', image: 'data:image/jpeg;base64,new' },
      ])
    ).rejects.toThrow('Injected coffeeBeanImageThumbnails.bulkDelete failure');

    expect(await database.coffeeBeans.get(bean.id)).toEqual(oldBean);
    expect(await database.coffeeBeanImages.get(bean.id)).toEqual(oldImage);
    expect(await database.coffeeBeanImageThumbnails.get(bean.id)).toEqual(
      oldThumbnail
    );
  });
});

describe('Dexie BrewingNotePersistence transactions', () => {
  let database: ImagePersistenceTestDatabase;

  beforeEach(async () => {
    database = new ImagePersistenceTestDatabase(
      `BrewGuideBrewingNotePersistenceTest-${Date.now()}-${Math.random()}`
    );
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('rolls back note, original, and thumbnail writes when save fails', async () => {
    const oldNote = { ...note, notes: 'Stored note' };
    const oldImage: BrewingNoteImageRecord = {
      noteId: note.id,
      image: 'data:image/jpeg;base64,old',
      images: ['data:image/jpeg;base64,old'],
      updatedAt: 10,
    };
    const oldThumbnail: BrewingNoteImageThumbnailRecord = {
      noteId: note.id,
      imageThumbnail: 'data:image/jpeg;base64,old-thumb',
      updatedAt: 10,
    };
    await database.brewingNotes.put(oldNote);
    await database.brewingNoteImages.put(oldImage);
    await database.brewingNoteImageThumbnails.put(oldThumbnail);

    const persistence = createDexieBrewingNotePersistence(
      withTableFailure(database, 'brewingNotes', 'put')
    );
    await expect(
      persistence.saveWithImages({
        ...note,
        notes: 'New note',
        image: 'data:image/jpeg;base64,new',
        images: ['data:image/jpeg;base64,new'],
      })
    ).rejects.toThrow('Injected brewingNotes.put failure');

    expect(await database.brewingNotes.get(note.id)).toEqual(oldNote);
    expect(await database.brewingNoteImages.get(note.id)).toEqual(oldImage);
    expect(await database.brewingNoteImageThumbnails.get(note.id)).toEqual(
      oldThumbnail
    );
  });

  it('rolls back note and image deletions when deleting a note fails', async () => {
    const image: BrewingNoteImageRecord = {
      noteId: note.id,
      image: 'data:image/jpeg;base64,stored',
      images: ['data:image/jpeg;base64,stored'],
      updatedAt: 10,
    };
    const thumbnail: BrewingNoteImageThumbnailRecord = {
      noteId: note.id,
      imageThumbnail: 'data:image/jpeg;base64,thumb',
      updatedAt: 10,
    };
    await database.brewingNotes.put(note);
    await database.brewingNoteImages.put(image);
    await database.brewingNoteImageThumbnails.put(thumbnail);

    const persistence = createDexieBrewingNotePersistence(
      withTableFailure(database, 'brewingNoteImageThumbnails', 'delete')
    );
    await expect(persistence.deleteWithImages(note.id)).rejects.toThrow(
      'Injected brewingNoteImageThumbnails.delete failure'
    );

    expect(await database.brewingNotes.get(note.id)).toEqual(note);
    expect(await database.brewingNoteImages.get(note.id)).toEqual(image);
    expect(await database.brewingNoteImageThumbnails.get(note.id)).toEqual(
      thumbnail
    );
  });

  it('rolls back replaceAll writes when image records fail to persist', async () => {
    const oldNote = { ...note, notes: 'Stored note' };
    const oldImage: BrewingNoteImageRecord = {
      noteId: note.id,
      image: 'data:image/jpeg;base64,old',
      images: ['data:image/jpeg;base64,old'],
      updatedAt: 10,
    };
    const oldThumbnail: BrewingNoteImageThumbnailRecord = {
      noteId: note.id,
      imageThumbnail: 'data:image/jpeg;base64,old-thumb',
      updatedAt: 10,
    };
    await database.brewingNotes.put(oldNote);
    await database.brewingNoteImages.put(oldImage);
    await database.brewingNoteImageThumbnails.put(oldThumbnail);

    const persistence = createDexieBrewingNotePersistence(
      withTableFailure(database, 'brewingNoteImages', 'bulkPut')
    );
    await expect(
      persistence.replaceAllWithImages([
        {
          ...note,
          notes: 'Restored note',
          image: 'data:image/jpeg;base64,new',
          images: ['data:image/jpeg;base64,new'],
        },
      ])
    ).rejects.toThrow('Injected brewingNoteImages.bulkPut failure');

    expect(await database.brewingNotes.get(note.id)).toEqual(oldNote);
    expect(await database.brewingNoteImages.get(note.id)).toEqual(oldImage);
    expect(await database.brewingNoteImageThumbnails.get(note.id)).toEqual(
      oldThumbnail
    );
  });
});
