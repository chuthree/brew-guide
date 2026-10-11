import { db } from '@/lib/core/db';
import type { BrewGuideDB } from '@/lib/core/db';
import { brewingNoteRepository } from '@/lib/data/adapters/dexie/brewingNoteRepository';
import type {
  BrewingNoteImageRepository,
  BrewingNotePersistence,
  ImageRecordCounts,
} from '@/lib/data/contracts';
import type { BrewingNote } from '@/lib/core/config';
import {
  type BrewingNoteImageRecord,
  mergeBrewingNoteImages,
  mergeBrewingNotesWithImages,
  splitBrewingNoteImages,
  stripBrewingNoteImages,
} from '@/lib/notes/imageRecords';
import { shouldSkipDestructiveReplace } from '@/lib/core/safeReplace';

const hasImageFieldUpdate = (note: BrewingNote): boolean =>
  Object.prototype.hasOwnProperty.call(note, 'image') ||
  Object.prototype.hasOwnProperty.call(note, 'images');

const getRecordImages = (record: {
  image?: string;
  images?: string[];
}): string[] =>
  record.images?.length ? record.images : record.image ? [record.image] : [];

export async function persistBrewingNoteImagesFromNote(
  note: BrewingNote,
  _options: { generateThumbnails?: boolean } = {}
): Promise<BrewingNote> {
  const { note: strippedNote, imageRecord } = splitBrewingNoteImages(note);

  if (!imageRecord && !hasImageFieldUpdate(note)) {
    return strippedNote;
  }

  if (imageRecord) {
    await db.brewingNoteImages.put(imageRecord);
    await db.brewingNoteImageThumbnails.delete(note.id);
  } else {
    await db.brewingNoteImages.delete(note.id);
    await db.brewingNoteImageThumbnails.delete(note.id);
  }

  return strippedNote;
}

async function saveBrewingNoteWithImagesInDatabase(
  note: BrewingNote,
  database: BrewGuideDB = db
): Promise<BrewingNote> {
  const { note: strippedNote, imageRecord } = splitBrewingNoteImages(note);

  await database.transaction(
    'rw',
    database.brewingNotes,
    database.brewingNoteImages,
    database.brewingNoteImageThumbnails,
    async () => {
      if (imageRecord) {
        await database.brewingNoteImages.put(imageRecord);
        await database.brewingNoteImageThumbnails.delete(note.id);
      } else if (hasImageFieldUpdate(note)) {
        await database.brewingNoteImages.delete(note.id);
        await database.brewingNoteImageThumbnails.delete(note.id);
      }
      await database.brewingNotes.put(strippedNote);
    }
  );

  return strippedNote;
}

export async function getBrewingNoteImageRecord(
  noteId: string
): Promise<BrewingNoteImageRecord | undefined> {
  return db.brewingNoteImages.get(noteId);
}

export async function getBrewingNoteImageNoteIds(
  noteIds?: string[]
): Promise<string[]> {
  if (!noteIds) {
    const keys = await db.brewingNoteImages.toCollection().primaryKeys();
    return keys.map(String);
  }

  const uniqueNoteIds = Array.from(new Set(noteIds.filter(Boolean)));
  if (uniqueNoteIds.length === 0) return [];

  const keys = await db.brewingNoteImages
    .where('noteId')
    .anyOf(uniqueNoteIds)
    .primaryKeys();
  return keys.map(String);
}

export async function getBrewingNoteImageCounts(
  noteIds: string[]
): Promise<Map<string, number>> {
  const uniqueNoteIds = Array.from(new Set(noteIds.filter(Boolean)));
  if (uniqueNoteIds.length === 0) return new Map();

  const records = await db.brewingNoteImages.bulkGet(uniqueNoteIds);
  const counts = new Map<string, number>();

  records.forEach(record => {
    if (!record) return;
    const count = getRecordImages(record).length;
    if (count > 0) counts.set(record.noteId, count);
  });

  return counts;
}

export async function getBrewingNoteImages(noteId: string): Promise<string[]> {
  const record = await getBrewingNoteImageRecord(noteId);
  return record ? getRecordImages(record) : [];
}

export async function mergeNoteWithStoredImages(
  note: BrewingNote
): Promise<BrewingNote> {
  return mergeBrewingNoteImages(note, await getBrewingNoteImageRecord(note.id));
}

export async function mergeNotesWithStoredImages(
  notes: BrewingNote[]
): Promise<BrewingNote[]> {
  const noteIds = notes.map(note => note.id).filter(Boolean);
  if (noteIds.length === 0) return notes;

  const imageRecords = await db.brewingNoteImages.bulkGet(noteIds);
  return mergeBrewingNotesWithImages(
    notes,
    imageRecords.filter(Boolean) as BrewingNoteImageRecord[]
  );
}

export async function exportBrewingNotesWithImages(): Promise<BrewingNote[]> {
  const [notes, imageRecords] = await Promise.all([
    brewingNoteRepository.list(),
    db.brewingNoteImages.toArray(),
  ]);

  return mergeBrewingNotesWithImages(
    notes.map(stripBrewingNoteImages),
    imageRecords
  );
}

async function replaceBrewingNotesWithSplitImagesInDatabase(
  notes: BrewingNote[],
  options: {
    allowEmptyReplace?: boolean;
    allowDestructiveReplace?: boolean;
  } = {},
  database: BrewGuideDB = db
): Promise<boolean> {
  const existingCount = await database.brewingNotes.count();
  if (
    shouldSkipDestructiveReplace({
      nextCount: notes.length,
      existingCount,
      allowEmptyReplace: options.allowEmptyReplace,
      allowDestructiveReplace: options.allowDestructiveReplace,
    })
  ) {
    console.warn('[BrewingNoteImage] 跳过笔记列表替换，避免误清空数据');
    return false;
  }

  const strippedNotes: BrewingNote[] = [];
  const imageRecords: BrewingNoteImageRecord[] = [];
  const explicitEmptyImageNoteIds: string[] = [];
  const incomingNoteIds = notes.map(note => note.id).filter(Boolean);

  for (const note of notes) {
    const split = splitBrewingNoteImages(note);
    strippedNotes.push(split.note);
    if (split.imageRecord) {
      imageRecords.push(split.imageRecord);
    } else if (hasImageFieldUpdate(note)) {
      explicitEmptyImageNoteIds.push(note.id);
    }
  }

  await database.transaction(
    'rw',
    database.brewingNotes,
    database.brewingNoteImages,
    database.brewingNoteImageThumbnails,
    async () => {
      const [existingNoteRecords, existingImageIds] = await Promise.all([
        database.brewingNotes.toArray(),
        database.brewingNoteImages.toCollection().primaryKeys(),
      ]);
      const existingNoteIds = existingNoteRecords.map(note => note.id);
      const incomingIdSet = new Set(incomingNoteIds);
      const staleNoteIds = existingNoteIds.filter(
        noteId => !incomingIdSet.has(noteId)
      );
      const staleImageIds = existingImageIds
        .map(String)
        .filter(noteId => !incomingIdSet.has(noteId));
      const imageIdsToDelete = Array.from(
        new Set([...staleImageIds, ...explicitEmptyImageNoteIds])
      );

      if (strippedNotes.length > 0) {
        await database.brewingNotes.bulkPut(strippedNotes);
      }

      if (staleNoteIds.length > 0) {
        await database.brewingNotes.bulkDelete(staleNoteIds);
      }

      if (imageIdsToDelete.length > 0) {
        await database.brewingNoteImages.bulkDelete(imageIdsToDelete);
        await database.brewingNoteImageThumbnails.bulkDelete(imageIdsToDelete);
      }

      if (imageRecords.length > 0) {
        await database.brewingNoteImageThumbnails.bulkDelete(
          imageRecords.map(record => record.noteId)
        );
        await database.brewingNoteImages.bulkPut(imageRecords);
      }
    }
  );

  return true;
}

export function createDexieBrewingNotePersistence(
  database: BrewGuideDB = db
): BrewingNotePersistence {
  return {
    saveWithImages(note) {
      return saveBrewingNoteWithImagesInDatabase(note, database);
    },

    async deleteWithImages(id) {
      await database.transaction(
        'rw',
        database.brewingNotes,
        database.brewingNoteImages,
        database.brewingNoteImageThumbnails,
        async () => {
          await database.brewingNotes.delete(id);
          await database.brewingNoteImages.delete(id);
          await database.brewingNoteImageThumbnails.delete(id);
        }
      );
    },

    async deleteManyWithImages(ids) {
      if (ids.length === 0) return;

      await database.transaction(
        'rw',
        database.brewingNotes,
        database.brewingNoteImages,
        database.brewingNoteImageThumbnails,
        async () => {
          await database.brewingNotes.bulkDelete(ids);
          await database.brewingNoteImages.bulkDelete(ids);
          await database.brewingNoteImageThumbnails.bulkDelete(ids);
        }
      );
    },

    replaceAllWithImages(notes, options) {
      return replaceBrewingNotesWithSplitImagesInDatabase(
        notes,
        options,
        database
      );
    },

    async clearWithImages() {
      await database.brewingNotes.clear();
      await database.brewingNoteImages.clear();
      await database.brewingNoteImageThumbnails.clear();
    },
  };
}

export const brewingNotePersistence = createDexieBrewingNotePersistence();

export const brewingNoteImageRepository: BrewingNoteImageRepository = {
  getRecord: getBrewingNoteImageRecord,
  getNoteIds: getBrewingNoteImageNoteIds,
  getImageCounts: getBrewingNoteImageCounts,
  getImages: getBrewingNoteImages,
  mergeNote: mergeNoteWithStoredImages,
  mergeNotes: mergeNotesWithStoredImages,
  exportAll: exportBrewingNotesWithImages,
  async getRecordCounts(): Promise<ImageRecordCounts> {
    const [records, thumbnails] = await Promise.all([
      db.brewingNoteImages.count(),
      db.brewingNoteImageThumbnails.count(),
    ]);
    return { records, thumbnails };
  },
};

/** Dexie-adapter compatibility helpers; application code uses the contracts above. */
export function saveBrewingNoteWithImages(
  note: BrewingNote
): Promise<BrewingNote> {
  return brewingNotePersistence.saveWithImages(note);
}

export function replaceBrewingNotesWithSplitImages(
  notes: BrewingNote[],
  options: {
    allowEmptyReplace?: boolean;
    allowDestructiveReplace?: boolean;
  } = {}
): Promise<boolean> {
  return brewingNotePersistence.replaceAllWithImages(notes, options);
}
