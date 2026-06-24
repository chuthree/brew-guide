import { db } from '@/lib/core/db';
import type { BrewingNote } from '@/lib/core/config';
import {
  type BrewingNoteImageRecord,
  type BrewingNoteImageThumbnailRecord,
  mergeBrewingNoteImages,
  mergeBrewingNotesWithImages,
  splitBrewingNoteImages,
  stripBrewingNoteImages,
} from './imageRecords';
import { shouldSkipEmptyReplace } from '@/lib/core/safeReplace';
import {
  createImageThumbnailDataUrl,
  getUsableThumbnailDataUrl,
} from '@/lib/images/thumbnail';

export type BrewingNoteImageSourceMode = 'thumbnail' | 'original';

const hasImageFieldUpdate = (note: BrewingNote): boolean =>
  Object.prototype.hasOwnProperty.call(note, 'image') ||
  Object.prototype.hasOwnProperty.call(note, 'images');

const getRecordImages = (record: {
  image?: string;
  images?: string[];
}): string[] =>
  record.images?.length ? record.images : record.image ? [record.image] : [];

const getThumbnailRecordImages = (
  record: BrewingNoteImageThumbnailRecord | undefined
): string[] => {
  if (!record) return [];

  const thumbnails = record.imageThumbnails?.length
    ? record.imageThumbnails
    : record.imageThumbnail
      ? [record.imageThumbnail]
      : [];

  return thumbnails.map(getUsableThumbnailDataUrl).filter(Boolean) as string[];
};

const haveSameImages = (left: string[], right: string[]): boolean =>
  left.length === right.length &&
  left.every((image, index) => image === right[index]);

const createBrewingNoteImageThumbnailRecord = async (
  noteId: string,
  images: string[],
  updatedAt: number
): Promise<BrewingNoteImageThumbnailRecord | undefined> => {
  const thumbnails: string[] = [];

  for (const image of images) {
    const thumbnail = await createImageThumbnailDataUrl(image);
    if (thumbnail) thumbnails.push(thumbnail);
  }

  if (thumbnails.length === 0) return undefined;

  return {
    noteId,
    imageThumbnail: thumbnails[0],
    imageThumbnails: thumbnails,
    updatedAt,
  };
};

export async function persistBrewingNoteImagesFromNote(
  note: BrewingNote,
  options: { generateThumbnails?: boolean } = {}
): Promise<BrewingNote> {
  const { generateThumbnails = true } = options;
  const { note: strippedNote, imageRecord } = splitBrewingNoteImages(note);

  if (!imageRecord && !hasImageFieldUpdate(note)) {
    return strippedNote;
  }

  if (imageRecord) {
    const existingRecord = await db.brewingNoteImages.get(note.id);
    const existingThumbnailRecord = await db.brewingNoteImageThumbnails.get(
      note.id
    );
    const nextImages = getRecordImages(imageRecord);
    const existingImages = existingRecord
      ? getRecordImages(existingRecord)
      : [];
    const canReuseThumbnail =
      haveSameImages(nextImages, existingImages) && existingThumbnailRecord;
    const thumbnailRecord = canReuseThumbnail
      ? existingThumbnailRecord
      : generateThumbnails
        ? await createBrewingNoteImageThumbnailRecord(
            note.id,
            nextImages,
            imageRecord.updatedAt
          )
        : undefined;

    await db.brewingNoteImages.put(imageRecord);
    if (
      thumbnailRecord &&
      getThumbnailRecordImages(thumbnailRecord).length > 0
    ) {
      await db.brewingNoteImageThumbnails.put(thumbnailRecord);
    } else {
      await db.brewingNoteImageThumbnails.delete(note.id);
    }
  } else {
    await db.brewingNoteImages.delete(note.id);
    await db.brewingNoteImageThumbnails.delete(note.id);
  }

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
    const keys = await db.brewingNoteImageThumbnails
      .toCollection()
      .primaryKeys();
    return keys.map(String);
  }

  const uniqueNoteIds = Array.from(new Set(noteIds.filter(Boolean)));
  if (uniqueNoteIds.length === 0) return [];

  const keys = await db.brewingNoteImageThumbnails
    .where('noteId')
    .anyOf(uniqueNoteIds)
    .primaryKeys();
  return keys.map(String);
}

export async function getBrewingNoteImages(
  noteId: string,
  options: { mode?: BrewingNoteImageSourceMode } = {}
): Promise<string[]> {
  if (options.mode !== 'original') {
    return getThumbnailRecordImages(
      await db.brewingNoteImageThumbnails.get(noteId)
    );
  }

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
    db.brewingNotes.toArray(),
    db.brewingNoteImages.toArray(),
  ]);

  return mergeBrewingNotesWithImages(
    notes.map(stripBrewingNoteImages),
    imageRecords
  );
}

export async function replaceBrewingNotesWithSplitImages(
  notes: BrewingNote[],
  options: { allowEmptyReplace?: boolean } = {}
): Promise<boolean> {
  const existingCount = notes.length === 0 ? await db.brewingNotes.count() : 0;
  if (
    shouldSkipEmptyReplace({
      nextCount: notes.length,
      existingCount,
      allowEmptyReplace: options.allowEmptyReplace,
    })
  ) {
    console.warn('[BrewingNoteImage] 跳过空笔记列表替换，避免误清空数据');
    return false;
  }

  const strippedNotes: BrewingNote[] = [];
  const imageRecords: BrewingNoteImageRecord[] = [];

  for (const note of notes) {
    const split = splitBrewingNoteImages(note);
    strippedNotes.push(split.note);
    if (split.imageRecord) {
      imageRecords.push(split.imageRecord);
    }
  }

  await db.transaction(
    'rw',
    db.brewingNotes,
    db.brewingNoteImages,
    db.brewingNoteImageThumbnails,
    async () => {
      await db.brewingNotes.clear();
      await db.brewingNoteImages.clear();
      await db.brewingNoteImageThumbnails.clear();

      if (strippedNotes.length > 0) {
        await db.brewingNotes.bulkPut(strippedNotes);
      }

      if (imageRecords.length > 0) {
        await db.brewingNoteImages.bulkPut(imageRecords);
      }
    }
  );

  return true;
}
