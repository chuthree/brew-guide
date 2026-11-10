import type { DataRepositories } from './repositories';
import type { AppSettings, Grinder } from './models';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment } from '@/lib/core/config';
import type { CustomMethodRecord } from './contracts';

export interface DataImportPlan {
  coffeeBeans?: CoffeeBean[];
  brewingNotes?: BrewingNote[];
  customEquipments?: CustomEquipment[];
  grinders?: Grinder[];
  methods?: CustomMethodRecord[];
  settings?: AppSettings;
  legacy: Record<string, string>;
}

export interface DataImportPersistence {
  importData(plan: DataImportPlan): Promise<void>;
}

/** Only the backend calls this, with repositories bound to one transaction. */
export async function applyDataImport(
  repositories: Pick<
    DataRepositories,
    | 'coffeeBeanPersistence'
    | 'brewingNotePersistence'
    | 'customEquipmentRepository'
    | 'grinderRepository'
    | 'customMethodRepository'
    | 'appSettingsRepository'
    | 'legacySettingsRepository'
  >,
  plan: DataImportPlan
): Promise<void> {
  if (plan.coffeeBeans)
    await repositories.coffeeBeanPersistence.replaceAllWithImages(
      plan.coffeeBeans,
      { allowDestructiveReplace: true }
    );
  if (plan.brewingNotes)
    await repositories.brewingNotePersistence.replaceAllWithImages(
      plan.brewingNotes,
      { allowDestructiveReplace: true }
    );
  if (plan.customEquipments) {
    await repositories.customEquipmentRepository.replaceAll(
      plan.customEquipments
    );
    await repositories.legacySettingsRepository.delete('customEquipments');
  }
  if (plan.grinders)
    await repositories.grinderRepository.replaceAll(plan.grinders);
  if (plan.methods) {
    await repositories.customMethodRepository.clear();
    await repositories.customMethodRepository.upsertMany(plan.methods);
  }
  if (plan.settings)
    await repositories.appSettingsRepository.save(plan.settings);
  for (const [key, value] of Object.entries(plan.legacy)) {
    await repositories.legacySettingsRepository.set(key, value);
  }
}
