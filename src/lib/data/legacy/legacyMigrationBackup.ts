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

/**
 * Keep a lossless legacy supplement without serializing public data twice.
 * To reconstruct the raw snapshot, assign each dataPath from export.data to
 * its snapshotPath in snapshot. Paths are arrays so legacy keys need no escaping.
 */
export function compactLegacyBackupSnapshot(
  snapshot: unknown,
  data: Record<string, unknown>
) {
  const exported = new Map<string, string[]>();
  const references: { snapshotPath: string[]; dataPath: string[] }[] = [];
  const children = (value: unknown): [string, unknown][] =>
    value !== null && typeof value === 'object' ? Object.entries(value) : [];
  const index = (value: unknown, path: string[]) => {
    const json = JSON.stringify(value);
    // Small values cost less to repeat than a reference and its paths.
    if (json && json.length > 256 && !exported.has(json)) {
      exported.set(json, path);
    }
    for (const [key, child] of children(value)) index(child, [...path, key]);
  };
  for (const [key, value] of Object.entries(data)) {
    if (key !== 'legacyIndexedDB') index(value, [key]);
  }
  const compact = (value: unknown, path: string[]): unknown => {
    const json = JSON.stringify(value);
    const dataPath = json && exported.get(json);
    if (dataPath) {
      references.push({ snapshotPath: path, dataPath });
      return null;
    }
    if (Array.isArray(value)) {
      return value.map((child, index) =>
        compact(child, [...path, String(index)])
      );
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        children(value).map(([key, child]) => [
          key,
          compact(child, [...path, key]),
        ])
      );
    }
    return value;
  };
  return {
    format: 'export-data-references-v1',
    snapshot: compact(snapshot, []),
    references,
  };
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
