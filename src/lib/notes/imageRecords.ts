import type { BrewingNote } from '@/lib/core/config';

export interface BrewingNoteImageRecord {
  noteId: string;
  image?: string;
  images?: string[];
  updatedAt: number;
}

export interface BrewingNoteImageThumbnailRecord {
  noteId: string;
  imageThumbnail?: string;
  imageThumbnails?: string[];
  updatedAt: number;
}

export interface SplitBrewingNoteImagesResult {
  note: BrewingNote;
  imageRecord?: BrewingNoteImageRecord;
}

export const getBrewingNoteImages = (note: BrewingNote): string[] => {
  if (Array.isArray(note.images) && note.images.length > 0) {
    return note.images.filter(Boolean);
  }

  return note.image ? [note.image] : [];
};

export const stripBrewingNoteImages = (note: BrewingNote): BrewingNote => {
  const { image: _image, images: _images, ...noteWithoutImages } = note;
  return noteWithoutImages;
};

export const splitBrewingNoteImages = (
  note: BrewingNote
): SplitBrewingNoteImagesResult => {
  const strippedNote = stripBrewingNoteImages(note);
  const images = getBrewingNoteImages(note);

  if (images.length === 0) {
    return { note: strippedNote };
  }

  return {
    note: strippedNote,
    imageRecord: {
      noteId: note.id,
      image: images[0],
      images,
      updatedAt: note.updatedAt || note.timestamp || Date.now(),
    },
  };
};

export const mergeBrewingNoteImages = (
  note: BrewingNote,
  imageRecord?: BrewingNoteImageRecord | null
): BrewingNote => {
  if (!imageRecord) return note;

  const images = imageRecord.images?.length
    ? imageRecord.images
    : imageRecord.image
      ? [imageRecord.image]
      : [];

  if (images.length === 0) return note;

  return {
    ...note,
    image: images[0],
    images,
  };
};

export const mergeBrewingNotesWithImages = (
  notes: BrewingNote[],
  imageRecords: BrewingNoteImageRecord[]
): BrewingNote[] => {
  const imageRecordByNoteId = new Map(
    imageRecords.map(record => [record.noteId, record])
  );

  return notes.map(note =>
    mergeBrewingNoteImages(note, imageRecordByNoteId.get(note.id))
  );
};
