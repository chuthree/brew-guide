import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import {
  mergeCoffeeBeansWithImages,
  type CoffeeBeanImageRecord,
} from '@/lib/coffee-beans/imageRecords';
import {
  mergeBrewingNotesWithImages,
  type BrewingNoteImageRecord,
} from '@/lib/notes/imageRecords';
import {
  decodeAppSettings,
  decodeCustomEquipment,
  decodeCustomMethods,
  decodeGrinder,
  decodeLegacySetting,
} from '@/lib/data/sqlite/codecs';
import type {
  LegacyMigrationSource,
  LegacySqliteMigrationPlan,
} from '@/lib/data/sqlite/legacyMigrationPlan';

function parseStoredValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** Frozen public data for the normal exporter before SQLite is initialized. */
export function createLegacyMigrationBackupData(
  source: LegacyMigrationSource,
  plan: LegacySqliteMigrationPlan
): Record<string, unknown> {
  const data: Record<string, unknown> = Object.fromEntries(
    plan.rows.legacySettings.map(row => {
      const { key, value } = decodeLegacySetting(row);
      return [key, parseStoredValue(value)];
    })
  );
  Object.assign(data, {
    coffeeBeans: mergeCoffeeBeansWithImages(
      source.active.coffeeBeans.records as unknown as CoffeeBean[],
      source.active.coffeeBeanImages
        .records as unknown as CoffeeBeanImageRecord[]
    ),
    brewingNotes: mergeBrewingNotesWithImages(
      source.active.brewingNotes.records as unknown as BrewingNote[],
      source.active.brewingNoteImages
        .records as unknown as BrewingNoteImageRecord[]
    ),
    customEquipments: plan.rows.customEquipments.map(decodeCustomEquipment),
    customMethodsByEquipment: Object.fromEntries(
      plan.rows.customMethods.map(row => {
        const { equipmentId, methods } = decodeCustomMethods(row);
        return [equipmentId, methods];
      })
    ),
    grinders: plan.rows.grinders.map(decodeGrinder),
  });
  data.brewGuideSettings = plan.rows.appSettings[0]
    ? decodeAppSettings(plan.rows.appSettings[0]).data
    : {};
  // Keep historical rows, queue entries, thumbnails and unknown legacy fields
  // in the backup too, including records outside the public export format.
  data.legacyIndexedDB = {
    info: source.info,
    active: source.active,
    historical: source.historical,
    localStorage: source.localStorage,
  };
  return data;
}
