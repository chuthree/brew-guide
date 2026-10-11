import type { BrewingNote } from '@/lib/core/config';
import {
  splitBrewingNoteImages,
  type BrewingNoteImageRecord,
} from '@/lib/notes/imageRecords';

type StoredBrewingNote = BrewingNote & {
  coffeeBean?: unknown;
  taste?: BrewingNote['taste'] | null;
};

export interface NormalizedLegacyBrewingNote {
  changed: boolean;
  note: BrewingNote;
  imageRecord?: BrewingNoteImageRecord;
}

const isTasteRecord = (value: unknown): value is BrewingNote['taste'] =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const normalizeBrewingNote = (
  note: BrewingNote
): { note: BrewingNote; changed: boolean } => {
  const cleanedNote = { ...(note as StoredBrewingNote) };
  let changed = false;

  if (Object.prototype.hasOwnProperty.call(cleanedNote, 'coffeeBean')) {
    delete cleanedNote.coffeeBean;
    changed = true;
  }

  if (!isTasteRecord(cleanedNote.taste)) {
    cleanedNote.taste = {};
    changed = true;
  }

  return { note: changed ? (cleanedNote as BrewingNote) : note, changed };
};

/**
 * Apply the existing normalization and inline-image split as a pure transform.
 * Inline images are split only when the note already requires normalization.
 */
export const normalizeLegacyBrewingNote = (
  note: BrewingNote
): NormalizedLegacyBrewingNote => {
  const normalized = normalizeBrewingNote(note);
  if (!normalized.changed) return normalized;

  return {
    ...splitBrewingNoteImages(normalized.note),
    changed: true,
  };
};
