import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type {
  BrewingNoteImageRecord,
  BrewingNoteImageThumbnailRecord,
} from '@/lib/notes/imageRecords';
import {
  createDexieBrewingNoteMaintenance,
  type DexieBrewingNoteMaintenanceDatabase,
} from './brewingNoteMaintenance';

class BrewingNoteMaintenanceTestDatabase extends Dexie {
  brewingNotes!: Table<BrewingNote, string>;
  brewingNoteImages!: Table<BrewingNoteImageRecord, string>;
  brewingNoteImageThumbnails!: Table<BrewingNoteImageThumbnailRecord, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      brewingNotes: 'id',
      brewingNoteImages: 'noteId',
      brewingNoteImageThumbnails: 'noteId',
    });
  }
}

type MaintenanceTableName = 'brewingNotes' | 'brewingNoteImages';

const withWriteFailure = (
  database: BrewingNoteMaintenanceTestDatabase,
  tableName: MaintenanceTableName,
  failAt: number
): DexieBrewingNoteMaintenanceDatabase => {
  let writeCount = 0;
  const table = database[tableName] as unknown as object;
  const failingTable = new Proxy(table, {
    get(target, property) {
      if (property === 'put') {
        return (...args: unknown[]) => {
          writeCount += 1;
          if (writeCount === failAt) {
            throw new Error(`Injected ${tableName}.put failure`);
          }

          const put = Reflect.get(target, property, target) as (
            ...values: unknown[]
          ) => unknown;
          return put.apply(target, args);
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
  }) as unknown as DexieBrewingNoteMaintenanceDatabase;
};

const asMaintenanceDatabase = (
  database: BrewingNoteMaintenanceTestDatabase
): DexieBrewingNoteMaintenanceDatabase =>
  database as unknown as DexieBrewingNoteMaintenanceDatabase;

const legacyNote = (
  id: string,
  overrides: Record<string, unknown> = {}
): BrewingNote =>
  ({
    id,
    timestamp: 100,
    rating: 4,
    taste: {},
    notes: `note ${id}`,
    ...overrides,
  }) as unknown as BrewingNote;

describe('Dexie BrewingNoteMaintenance', () => {
  let database: BrewingNoteMaintenanceTestDatabase;

  beforeEach(async () => {
    database = new BrewingNoteMaintenanceTestDatabase(
      `BrewGuideBrewingNoteMaintenanceTest-${Date.now()}-${Math.random()}`
    );
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('preserves note normalization, image merge rules, and transaction table scope', async () => {
    const noImage = legacyNote('a-no-image', {
      taste: null,
      coffeeBean: { name: 'old bean' },
    });
    const singularImage = legacyNote('b-singular-image', {
      taste: null,
      image: 'data:image/jpeg;base64,singular',
    });
    const arrayImages = legacyNote('c-array-images', {
      coffeeBean: { name: 'old bean' },
      image: 'data:image/jpeg;base64,ignored-singular',
      images: [
        'data:image/jpeg;base64,first',
        '',
        'data:image/jpeg;base64,second',
      ],
    });
    const unchangedInline = legacyNote('d-unchanged-inline', {
      image: 'data:image/jpeg;base64,kept-inline',
    });
    const changedWithoutInline = legacyNote('e-existing-split-image', {
      taste: null,
    });
    const oldArrayRecord: BrewingNoteImageRecord = {
      noteId: arrayImages.id,
      image: 'data:image/jpeg;base64,old-split',
      images: ['data:image/jpeg;base64,old-split'],
      updatedAt: 1,
    };
    const existingSplitRecord: BrewingNoteImageRecord = {
      noteId: changedWithoutInline.id,
      image: 'data:image/jpeg;base64,already-split',
      images: ['data:image/jpeg;base64,already-split'],
      updatedAt: 2,
    };
    const thumbnailRecord: BrewingNoteImageThumbnailRecord = {
      noteId: arrayImages.id,
      imageThumbnail: 'data:image/jpeg;base64,thumb',
      updatedAt: 3,
    };

    for (const note of [
      noImage,
      singularImage,
      arrayImages,
      unchangedInline,
      changedWithoutInline,
    ]) {
      await database.brewingNotes.put(note);
    }
    await database.brewingNoteImages.put(oldArrayRecord);
    await database.brewingNoteImages.put(existingSplitRecord);
    await database.brewingNoteImageThumbnails.put(thumbnailRecord);

    const transactionSpy = vi.spyOn(database, 'transaction');
    const stats = await createDexieBrewingNoteMaintenance(
      asMaintenanceDatabase(database)
    ).normalizeStoredNotes();

    expect(stats).toEqual({ scannedCount: 5, cleanedCount: 4 });
    expect(transactionSpy).toHaveBeenCalledWith(
      'rw',
      database.brewingNotes,
      database.brewingNoteImages,
      expect.any(Function)
    );
    transactionSpy.mockRestore();

    const savedNoImage = await database.brewingNotes.get(noImage.id);
    expect(savedNoImage?.taste).toEqual({});
    expect(savedNoImage).not.toHaveProperty('coffeeBean');

    const savedSingular = await database.brewingNotes.get(singularImage.id);
    expect(savedSingular?.taste).toEqual({});
    expect(savedSingular).not.toHaveProperty('image');
    expect(await database.brewingNoteImages.get(singularImage.id)).toEqual({
      noteId: singularImage.id,
      image: 'data:image/jpeg;base64,singular',
      images: ['data:image/jpeg;base64,singular'],
      updatedAt: singularImage.timestamp,
    });

    const savedArray = await database.brewingNotes.get(arrayImages.id);
    expect(savedArray).not.toHaveProperty('coffeeBean');
    expect(savedArray).not.toHaveProperty('image');
    expect(savedArray).not.toHaveProperty('images');
    expect(await database.brewingNoteImages.get(arrayImages.id)).toEqual({
      noteId: arrayImages.id,
      image: 'data:image/jpeg;base64,first',
      images: ['data:image/jpeg;base64,first', 'data:image/jpeg;base64,second'],
      updatedAt: arrayImages.timestamp,
    });

    expect(await database.brewingNotes.get(unchangedInline.id)).toEqual(
      unchangedInline
    );
    expect(
      await database.brewingNoteImages.get(unchangedInline.id)
    ).toBeUndefined();
    expect(await database.brewingNotes.get(changedWithoutInline.id)).toEqual({
      ...changedWithoutInline,
      taste: {},
    });
    expect(
      await database.brewingNoteImages.get(changedWithoutInline.id)
    ).toEqual(existingSplitRecord);
    expect(
      await database.brewingNoteImageThumbnails.get(arrayImages.id)
    ).toEqual(thumbnailRecord);
  });

  it('rolls back all note and image writes when a later note write fails', async () => {
    const firstNote = legacyNote('a-first', { taste: null });
    const secondNote = legacyNote('b-second', {
      taste: null,
      image: 'data:image/jpeg;base64,new-inline',
    });
    const oldImage: BrewingNoteImageRecord = {
      noteId: secondNote.id,
      image: 'data:image/jpeg;base64,old-split',
      images: ['data:image/jpeg;base64,old-split'],
      updatedAt: 1,
    };
    await database.brewingNotes.put(firstNote);
    await database.brewingNotes.put(secondNote);
    await database.brewingNoteImages.put(oldImage);

    const maintenance = createDexieBrewingNoteMaintenance(
      withWriteFailure(database, 'brewingNotes', 2)
    );

    await expect(maintenance.normalizeStoredNotes()).rejects.toThrow(
      'Injected brewingNotes.put failure'
    );
    expect(await database.brewingNotes.get(firstNote.id)).toEqual(firstNote);
    expect(await database.brewingNotes.get(secondNote.id)).toEqual(secondNote);
    expect(await database.brewingNoteImages.get(secondNote.id)).toEqual(
      oldImage
    );
  });

  it('rolls back earlier note writes when an inline image write fails', async () => {
    const firstNote = legacyNote('a-first', { taste: null });
    const secondNote = legacyNote('b-second', {
      taste: null,
      image: 'data:image/jpeg;base64,new-inline',
    });
    const oldImage: BrewingNoteImageRecord = {
      noteId: secondNote.id,
      image: 'data:image/jpeg;base64,old-split',
      images: ['data:image/jpeg;base64,old-split'],
      updatedAt: 1,
    };
    await database.brewingNotes.put(firstNote);
    await database.brewingNotes.put(secondNote);
    await database.brewingNoteImages.put(oldImage);

    const maintenance = createDexieBrewingNoteMaintenance(
      withWriteFailure(database, 'brewingNoteImages', 1)
    );

    await expect(maintenance.normalizeStoredNotes()).rejects.toThrow(
      'Injected brewingNoteImages.put failure'
    );
    expect(await database.brewingNotes.get(firstNote.id)).toEqual(firstNote);
    expect(await database.brewingNotes.get(secondNote.id)).toEqual(secondNote);
    expect(await database.brewingNoteImages.get(secondNote.id)).toEqual(
      oldImage
    );
  });

  it('is idempotent when a new maintenance instance rescans normalized data', async () => {
    const note = legacyNote('note-idempotent', {
      taste: null,
      coffeeBean: { name: 'old bean' },
      images: ['data:image/jpeg;base64,inline'],
    });
    await database.brewingNotes.put(note);

    const firstStats = await createDexieBrewingNoteMaintenance(
      asMaintenanceDatabase(database)
    ).normalizeStoredNotes();
    const noteAfterFirstRun = await database.brewingNotes.get(note.id);
    const imageAfterFirstRun = await database.brewingNoteImages.get(note.id);

    const secondStats = await createDexieBrewingNoteMaintenance(
      asMaintenanceDatabase(database)
    ).normalizeStoredNotes();

    expect(firstStats).toEqual({ scannedCount: 1, cleanedCount: 1 });
    expect(secondStats).toEqual({ scannedCount: 1, cleanedCount: 0 });
    expect(await database.brewingNotes.get(note.id)).toEqual(noteAfterFirstRun);
    expect(await database.brewingNoteImages.get(note.id)).toEqual(
      imageAfterFirstRun
    );
  });
});
