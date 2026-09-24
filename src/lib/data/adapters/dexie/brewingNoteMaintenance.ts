import { db } from '@/lib/core/db';
import type { BrewGuideDB } from '@/lib/core/db';
import { recordCrashCheckpoint } from '@/lib/app/crashDiagnostics';
import type {
  BrewingNoteMaintenance,
  BrewingNoteNormalizationStats,
} from '@/lib/data/contracts';
import { normalizeLegacyBrewingNote } from '@/lib/notes/cleanup';

export type DexieBrewingNoteMaintenanceDatabase = Pick<
  BrewGuideDB,
  'brewingNotes' | 'brewingNoteImages' | 'transaction'
>;

export function createDexieBrewingNoteMaintenance(
  database: DexieBrewingNoteMaintenanceDatabase = db
): BrewingNoteMaintenance {
  let cleanupPromise: Promise<BrewingNoteNormalizationStats> | null = null;

  const runNormalization = async (): Promise<BrewingNoteNormalizationStats> => {
    const stats: BrewingNoteNormalizationStats = {
      scannedCount: 0,
      cleanedCount: 0,
    };

    await database.transaction(
      'rw',
      database.brewingNotes,
      database.brewingNoteImages,
      async () => {
        const writeTasks: Promise<void>[] = [];
        let writeFailed = false;
        let writeFailure: unknown;

        await database.brewingNotes.each(note => {
          stats.scannedCount += 1;
          const normalized = normalizeLegacyBrewingNote(note);

          if (!normalized.changed) return;

          const writeTask = (async () => {
            if (normalized.imageRecord) {
              await database.brewingNoteImages.put(normalized.imageRecord);
            }
            await database.brewingNotes.put(normalized.note);
            stats.cleanedCount += 1;
          })();

          writeTasks.push(
            writeTask.catch(error => {
              if (!writeFailed) {
                writeFailed = true;
                writeFailure = error;
              }
            })
          );
        });

        await Promise.all(writeTasks);
        if (writeFailed) throw writeFailure;
      }
    );

    if (stats.cleanedCount > 0) {
      recordCrashCheckpoint('brewing-notes:normalized', { ...stats });
    }

    return stats;
  };

  return {
    normalizeStoredNotes() {
      if (cleanupPromise) return cleanupPromise;

      cleanupPromise = runNormalization().catch(error => {
        cleanupPromise = null;
        throw error;
      });
      return cleanupPromise;
    },
  };
}

export const brewingNoteMaintenance = createDexieBrewingNoteMaintenance();
