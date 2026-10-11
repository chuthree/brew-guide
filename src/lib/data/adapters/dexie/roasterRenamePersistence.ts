import { db } from '@/lib/core/db';
import type { BrewGuideDB } from '@/lib/core/db';
import type { RoasterRenamePersistence } from '@/lib/data/contracts';
import { transformRoasterRenameRecords } from '@/lib/data/roasterRename';

const MAIN_SETTINGS_ID = 'main';

export function createDexieRoasterRenamePersistence(
  database: BrewGuideDB = db
): RoasterRenamePersistence {
  return {
    renameReferences({ renames, now, getFallbackSettings }) {
      return database.transaction(
        'rw',
        database.coffeeBeans,
        database.brewingNotes,
        database.grinders,
        database.appSettings,
        async () => {
          const [beans, notes, grinders, settingsRecord] = await Promise.all([
            database.coffeeBeans.toArray(),
            database.brewingNotes.toArray(),
            database.grinders.toArray(),
            database.appSettings.get(MAIN_SETTINGS_ID),
          ]);
          const settings = settingsRecord?.data || getFallbackSettings();
          const changes = transformRoasterRenameRecords({
            beans,
            notes,
            grinders,
            settings,
            renames,
            now,
          });

          // Keep the existing write order and only write tables with changes.
          if (changes.updatedBeans.length > 0) {
            await database.coffeeBeans.bulkPut(changes.updatedBeans);
          }

          if (changes.updatedNotes.length > 0) {
            await database.brewingNotes.bulkPut(changes.updatedNotes);
          }

          if (changes.updatedGrinderCount > 0) {
            await database.grinders.bulkPut(changes.grinders);
          }

          if (changes.updatedConfigCount > 0) {
            await database.appSettings.put({
              id: MAIN_SETTINGS_ID,
              data: changes.settings,
            });
          }

          return changes;
        }
      );
    },
  };
}

export const roasterRenamePersistence = createDexieRoasterRenamePersistence();
