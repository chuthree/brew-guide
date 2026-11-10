import { db, type BrewGuideDB } from '@/lib/core/db';
import { applyDataImport, type DataImportPersistence } from '../../importData';
import { createDexieCoffeeBeanPersistence } from './coffeeBeanImageRepository';
import { createDexieBrewingNotePersistence } from './brewingNoteImageRepository';
import { createDexieCustomEquipmentRepository } from './customEquipmentRepository';
import { createDexieCustomMethodRepository } from './customMethodRepository';
import { createDexieGrinderRepository } from './grinderRepository';
import { createDexieAppSettingsRepository } from './settingsRepository';
import { createDexieLegacySettingsRepository } from './legacySettingsRepository';

export function createDexieDataImportPersistence(
  database: BrewGuideDB = db
): DataImportPersistence {
  const repositories = {
    coffeeBeanPersistence: createDexieCoffeeBeanPersistence(database),
    brewingNotePersistence: createDexieBrewingNotePersistence(database),
    customEquipmentRepository: createDexieCustomEquipmentRepository(
      database.customEquipments
    ),
    customMethodRepository: createDexieCustomMethodRepository(
      database.customMethods
    ),
    grinderRepository: createDexieGrinderRepository(database.grinders),
    appSettingsRepository: createDexieAppSettingsRepository(
      database.appSettings
    ),
    legacySettingsRepository: createDexieLegacySettingsRepository(
      database.settings
    ),
  };
  return {
    async importData(plan) {
      await database.transaction('rw', database.tables, async () => {
        if (plan.methods)
          await database.settings
            .where('key')
            .startsWith('customMethods_')
            .delete();
        await applyDataImport(repositories, plan);
        await database.businessOperations.clear();
        await database.businessPublications.clear();
      });
    },
  };
}
