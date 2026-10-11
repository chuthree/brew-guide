import type {
  RoasterRenamePersistence,
  RoasterRenamePersistenceResult,
} from '@/lib/data/contracts';
import { transformRoasterRenameRecords } from '@/lib/data/roasterRename';
import { getAppSettings, saveAppSettings } from '../repositories/appSettings';
import {
  listBrewingNotes,
  upsertManyBrewingNotes,
} from '../repositories/brewingNote';
import {
  listCoffeeBeans,
  upsertManyCoffeeBeans,
} from '../repositories/coffeeBean';
import { listGrinders, upsertGrinders } from '../repositories/grinder';
import type { SqliteDriver } from '../driver';

/**
 * Persist one domain-level roaster rename in a single SQLite transaction.
 * The shared pure transform remains the source of rename behavior.
 */
export function createSqliteRoasterRenamePersistence(
  driver: SqliteDriver
): RoasterRenamePersistence {
  return {
    renameReferences({ renames, now, getFallbackSettings }) {
      return driver.transaction(async tx => {
        const beans = await listCoffeeBeans(tx);
        const notes = await listBrewingNotes(tx);
        const grinders = await listGrinders(tx);
        const storedSettings = await getAppSettings(tx);
        const settings = storedSettings || getFallbackSettings();

        const changes: RoasterRenamePersistenceResult =
          transformRoasterRenameRecords({
            beans,
            notes,
            grinders,
            settings,
            renames,
            now,
          });

        // Keep the Dexie persistence write order and only write changed data.
        if (changes.updatedBeans.length > 0) {
          await upsertManyCoffeeBeans(tx, changes.updatedBeans);
        }

        if (changes.updatedNotes.length > 0) {
          await upsertManyBrewingNotes(tx, changes.updatedNotes);
        }

        if (changes.updatedGrinderCount > 0) {
          await upsertGrinders(tx, changes.grinders);
        }

        if (changes.updatedConfigCount > 0) {
          await saveAppSettings(tx, changes.settings);
        }

        return changes;
      });
    },
  };
}
