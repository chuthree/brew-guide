import type { BrewingNote } from '@/lib/core/config';
import { db } from '@/lib/core/db';
import { recordCrashCheckpoint } from '@/lib/app/crashDiagnostics';
import { splitBrewingNoteImages } from '@/lib/notes/imageRecords';

type StoredBrewingNote = BrewingNote & {
  coffeeBean?: unknown;
  taste?: BrewingNote['taste'] | null;
};

export interface BrewingNoteNormalizationStats {
  scannedCount: number;
  cleanedCount: number;
}

let cleanupPromise: Promise<BrewingNoteNormalizationStats> | null = null;

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

export async function normalizeStoredBrewingNotes(): Promise<BrewingNoteNormalizationStats> {
  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupPromise = runStoredBrewingNoteNormalization().catch(error => {
    cleanupPromise = null;
    throw error;
  });
  return cleanupPromise;
}

async function runStoredBrewingNoteNormalization(): Promise<BrewingNoteNormalizationStats> {
  const stats: BrewingNoteNormalizationStats = {
    scannedCount: 0,
    cleanedCount: 0,
  };

  await db.transaction(
    'rw',
    db.brewingNotes,
    db.brewingNoteImages,
    async () => {
      await db.brewingNotes.each(async note => {
        stats.scannedCount += 1;
        const cleaned = normalizeBrewingNote(note);

        if (!cleaned.changed) {
          return;
        }

        const split = splitBrewingNoteImages(cleaned.note);
        if (split.imageRecord) {
          await db.brewingNoteImages.put(split.imageRecord);
        }
        await db.brewingNotes.put(split.note);
        stats.cleanedCount += 1;
      });
    }
  );

  if (stats.cleanedCount > 0) {
    recordCrashCheckpoint('brewing-notes:normalized', {
      ...stats,
    });
  }

  return stats;
}
