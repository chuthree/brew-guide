import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { BrewGuideDB } from '@/lib/core/db';
import type {
  BrewingNoteImageRecord,
  BrewingNoteImageThumbnailRecord,
} from '@/lib/notes/imageRecords';
import { createDexieBrewingNotePersistence } from '@/lib/data/adapters/dexie/brewingNoteImageRepository';

class BrewingNotePersistenceParityDatabase extends Dexie {
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

const baseNote = (
  id: string,
  timestamp: number,
  extra: Record<string, unknown> = {}
): BrewingNote =>
  ({
    id,
    timestamp,
    updatedAt: timestamp,
    rating: 4,
    taste: { sweet: 4 },
    notes: `Note ${id}`,
    ...extra,
  }) as BrewingNote;

describe('Stage 3G-4C Dexie observable behavior reference', () => {
  let database: BrewingNotePersistenceParityDatabase;

  beforeEach(async () => {
    database = new BrewingNotePersistenceParityDatabase(
      `BrewingNotePersistenceParity-${Date.now()}-${Math.random()}`
    );
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('preserves split images and thumbnails when image fields are absent', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    const imageRecord: BrewingNoteImageRecord = {
      noteId: 'note',
      image: 'first',
      images: ['first', 'second'],
      updatedAt: 10,
    };
    const thumbnailRecord: BrewingNoteImageThumbnailRecord = {
      noteId: 'note',
      imageThumbnail: 'first-thumbnail',
      imageThumbnails: ['first-thumbnail', 'second-thumbnail'],
      updatedAt: 10,
    };
    await database.brewingNoteImages.put(imageRecord);
    await database.brewingNoteImageThumbnails.put(thumbnailRecord);

    await persistence.saveWithImages(
      baseNote('note', 20, { notes: 'text only' })
    );

    expect(await database.brewingNoteImages.get('note')).toEqual(imageRecord);
    expect(await database.brewingNoteImageThumbnails.get('note')).toEqual(
      thumbnailRecord
    );
    expect(await database.brewingNotes.get('note')).toMatchObject({
      notes: 'text only',
    });
  });

  it('uses the non-empty images array before image and preserves order', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );

    const returned = await persistence.saveWithImages(
      baseNote('note', 40, {
        image: 'ignored-single-image',
        images: ['first', '', 'third'],
      })
    );

    expect(returned).not.toHaveProperty('image');
    expect(returned).not.toHaveProperty('images');
    expect(await database.brewingNoteImages.get('note')).toEqual({
      noteId: 'note',
      image: 'first',
      images: ['first', 'third'],
      updatedAt: 40,
    });
    expect(
      await database.brewingNoteImageThumbnails.get('note')
    ).toBeUndefined();
  });

  it('falls back to singular image when images is empty', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );

    await persistence.saveWithImages(
      baseNote('note', 40, { image: 'single', images: [] })
    );

    expect(await database.brewingNoteImages.get('note')).toEqual({
      noteId: 'note',
      image: 'single',
      images: ['single'],
      updatedAt: 40,
    });
  });

  it('uses a truthy singular image when images is absent', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );

    await persistence.saveWithImages(
      baseNote('image-only', 40, { image: 'single' })
    );

    expect(await database.brewingNoteImages.get('image-only')).toEqual({
      noteId: 'image-only',
      image: 'single',
      images: ['single'],
      updatedAt: 40,
    });
  });

  it('does not fall back to image when a non-empty images array filters to empty', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    await database.brewingNoteImages.put({
      noteId: 'filtered-empty',
      image: 'old',
      images: ['old'],
      updatedAt: 10,
    });
    await database.brewingNoteImageThumbnails.put({
      noteId: 'filtered-empty',
      imageThumbnail: 'old-thumbnail',
      updatedAt: 10,
    });

    await persistence.saveWithImages(
      baseNote('filtered-empty', 40, { image: 'fallback', images: [''] })
    );

    expect(
      await database.brewingNoteImages.get('filtered-empty')
    ).toBeUndefined();
    expect(
      await database.brewingNoteImageThumbnails.get('filtered-empty')
    ).toBeUndefined();
  });

  it('clears image rows when images is explicitly undefined', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    await database.brewingNoteImages.put({
      noteId: 'images-undefined',
      image: 'old',
      images: ['old'],
      updatedAt: 10,
    });
    await database.brewingNoteImageThumbnails.put({
      noteId: 'images-undefined',
      imageThumbnail: 'old-thumbnail',
      updatedAt: 10,
    });

    await persistence.saveWithImages(
      baseNote('images-undefined', 40, { images: undefined })
    );

    expect(
      await database.brewingNoteImages.get('images-undefined')
    ).toBeUndefined();
    expect(
      await database.brewingNoteImageThumbnails.get('images-undefined')
    ).toBeUndefined();
  });

  it('preserves duplicate images and compacts mixed falsy values in order', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );

    await persistence.saveWithImages(
      baseNote('duplicates', 40, {
        images: ['', 'same', 'same', '', 'last'],
      })
    );

    expect(await database.brewingNoteImages.get('duplicates')).toEqual({
      noteId: 'duplicates',
      image: 'same',
      images: ['same', 'same', 'last'],
      updatedAt: 40,
    });
  });

  it('advances the shared image-record timestamp on every explicit update', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );

    await persistence.saveWithImages(
      baseNote('timestamp-update', 40, { images: ['first', 'second'] })
    );
    await persistence.saveWithImages(
      baseNote('timestamp-update', 80, { images: ['second', 'first'] })
    );

    expect(await database.brewingNoteImages.get('timestamp-update')).toEqual({
      noteId: 'timestamp-update',
      image: 'second',
      images: ['second', 'first'],
      updatedAt: 80,
    });
  });

  it('clears image rows when the singular image is explicitly empty', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    await database.brewingNoteImages.put({
      noteId: 'empty-image',
      image: 'old',
      images: ['old'],
      updatedAt: 10,
    });

    await persistence.saveWithImages(
      baseNote('empty-image', 40, { image: '' })
    );

    expect(await database.brewingNoteImages.get('empty-image')).toBeUndefined();
  });

  it('clears image and thumbnail rows for an explicit undefined image field', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    await database.brewingNoteImages.put({
      noteId: 'note',
      image: 'stored-image',
      images: ['stored-image'],
      updatedAt: 10,
    });
    await database.brewingNoteImageThumbnails.put({
      noteId: 'note',
      imageThumbnail: 'stored-thumbnail',
      imageThumbnails: ['stored-thumbnail'],
      updatedAt: 10,
    });

    const returned = await persistence.saveWithImages(
      baseNote('note', 40, { image: undefined })
    );

    expect(returned).not.toHaveProperty('image');
    expect(await database.brewingNoteImages.get('note')).toBeUndefined();
    expect(
      await database.brewingNoteImageThumbnails.get('note')
    ).toBeUndefined();
  });

  it('lets the last valid duplicate image record win over an explicit-empty duplicate', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    await database.brewingNoteImageThumbnails.put({
      noteId: 'note',
      imageThumbnail: 'old-thumbnail',
      imageThumbnails: ['old-thumbnail'],
      updatedAt: 10,
    });

    await persistence.replaceAllWithImages(
      [
        baseNote('note', 20, { images: ['first', 'second'] }),
        baseNote('note', 30, { images: [] }),
      ],
      { allowDestructiveReplace: true }
    );

    expect(await database.brewingNotes.get('note')).toMatchObject({
      timestamp: 30,
    });
    expect(await database.brewingNoteImages.get('note')).toEqual({
      noteId: 'note',
      image: 'first',
      images: ['first', 'second'],
      updatedAt: 20,
    });
    expect(
      await database.brewingNoteImageThumbnails.get('note')
    ).toBeUndefined();
  });

  it('matches replaceAll image field precedence, own undefined, and explicit empties', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    const ids = [
      'replace-absent',
      'replace-image-undefined',
      'replace-images-undefined',
      'replace-image-empty',
      'replace-images-empty',
      'replace-images-falsy',
      'replace-images-wins',
      'replace-duplicates',
    ];
    await database.brewingNotes.bulkPut(ids.map(id => baseNote(id, 10)));
    await database.brewingNoteImages.bulkPut(
      ids.map(id => ({
        noteId: id,
        image: `old-${id}`,
        images: [`old-${id}`],
        updatedAt: 10,
      }))
    );
    await database.brewingNoteImageThumbnails.bulkPut(
      ids.map(id => ({
        noteId: id,
        imageThumbnail: `thumbnail-${id}`,
        updatedAt: 10,
      }))
    );

    await persistence.replaceAllWithImages(
      [
        baseNote('replace-absent', 20),
        baseNote('replace-image-undefined', 20, { image: undefined }),
        baseNote('replace-images-undefined', 20, { images: undefined }),
        baseNote('replace-image-empty', 20, { image: '' }),
        baseNote('replace-images-empty', 20, {
          image: 'fallback',
          images: [],
        }),
        baseNote('replace-images-falsy', 20, {
          image: 'must-not-fallback',
          images: [''],
        }),
        baseNote('replace-images-wins', 20, {
          image: 'ignored',
          images: ['first', '', 'second'],
        }),
        baseNote('replace-duplicates', 20, {
          images: ['', 'same', 'same', '', 'last'],
        }),
      ],
      { allowDestructiveReplace: true }
    );

    expect(await database.brewingNoteImages.get('replace-absent')).toEqual({
      noteId: 'replace-absent',
      image: 'old-replace-absent',
      images: ['old-replace-absent'],
      updatedAt: 10,
    });
    expect(
      await database.brewingNoteImageThumbnails.get('replace-absent')
    ).toBeDefined();
    for (const id of [
      'replace-image-undefined',
      'replace-images-undefined',
      'replace-image-empty',
      'replace-images-falsy',
    ]) {
      expect(await database.brewingNoteImages.get(id)).toBeUndefined();
      expect(await database.brewingNoteImageThumbnails.get(id)).toBeUndefined();
    }
    expect(
      await database.brewingNoteImages.get('replace-images-empty')
    ).toEqual({
      noteId: 'replace-images-empty',
      image: 'fallback',
      images: ['fallback'],
      updatedAt: 20,
    });
    expect(await database.brewingNoteImages.get('replace-images-wins')).toEqual(
      {
        noteId: 'replace-images-wins',
        image: 'first',
        images: ['first', 'second'],
        updatedAt: 20,
      }
    );
    expect(await database.brewingNoteImages.get('replace-duplicates')).toEqual({
      noteId: 'replace-duplicates',
      image: 'same',
      images: ['same', 'same', 'last'],
      updatedAt: 20,
    });
  });

  it('preserves incoming notes without image fields and removes stale note images', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    const retained: BrewingNoteImageRecord = {
      noteId: 'retained',
      image: 'retained-image',
      images: ['retained-image'],
      updatedAt: 10,
    };
    await database.brewingNotes.bulkPut([
      baseNote('retained', 1),
      baseNote('stale', 1),
    ]);
    await database.brewingNoteImages.bulkPut([
      retained,
      {
        noteId: 'stale',
        image: 'stale-image',
        images: ['stale-image'],
        updatedAt: 10,
      },
    ]);
    await database.brewingNoteImageThumbnails.put({
      noteId: 'stale',
      imageThumbnail: 'stale-thumbnail',
      updatedAt: 10,
    });

    await persistence.replaceAllWithImages([baseNote('retained', 20)], {
      allowDestructiveReplace: true,
    });

    expect(await database.brewingNoteImages.get('retained')).toEqual(retained);
    expect(await database.brewingNoteImages.get('stale')).toBeUndefined();
    expect(
      await database.brewingNoteImageThumbnails.get('stale')
    ).toBeUndefined();
    expect(await database.brewingNotes.get('stale')).toBeUndefined();
  });

  it('skips destructive empty replacement unless explicitly allowed', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    await database.brewingNotes.put(baseNote('note', 10));
    await database.brewingNoteImages.put({
      noteId: 'note',
      image: 'image',
      images: ['image'],
      updatedAt: 10,
    });

    await expect(
      persistence.replaceAllWithImages([], { allowEmptyReplace: false })
    ).resolves.toBe(false);

    expect(await database.brewingNotes.get('note')).toBeDefined();
    expect(await database.brewingNoteImages.get('note')).toBeDefined();
  });

  it('deletes note subjects, originals, and thumbnails through aggregate methods', async () => {
    const persistence = createDexieBrewingNotePersistence(
      database as unknown as BrewGuideDB
    );
    await database.brewingNotes.bulkPut([
      baseNote('delete-a', 10),
      baseNote('delete-b', 10),
    ]);
    await database.brewingNoteImages.bulkPut([
      { noteId: 'delete-a', image: 'a', images: ['a'], updatedAt: 10 },
      { noteId: 'delete-b', image: 'b', images: ['b'], updatedAt: 10 },
    ]);
    await database.brewingNoteImageThumbnails.bulkPut([
      { noteId: 'delete-a', imageThumbnail: 'ta', updatedAt: 10 },
      { noteId: 'delete-b', imageThumbnail: 'tb', updatedAt: 10 },
    ]);

    await persistence.deleteManyWithImages(['delete-a']);

    expect(await database.brewingNotes.get('delete-a')).toBeUndefined();
    expect(await database.brewingNoteImages.get('delete-a')).toBeUndefined();
    expect(
      await database.brewingNoteImageThumbnails.get('delete-a')
    ).toBeUndefined();
    expect(await database.brewingNotes.get('delete-b')).toBeDefined();
    expect(await database.brewingNoteImages.get('delete-b')).toBeDefined();
    expect(
      await database.brewingNoteImageThumbnails.get('delete-b')
    ).toBeDefined();
  });
});
