import { dbUtils } from '@/lib/core/db';
import { recordCrashCheckpoint } from '@/lib/app/crashDiagnostics';
import { brewingNoteMaintenance as dexieBrewingNoteMaintenance } from '@/lib/data/adapters/dexie/brewingNoteMaintenance';
import { dexieImageMaintenance } from '@/lib/data/adapters/dexie/imageMaintenance';
import { dexieBackendDataMaintenance } from '@/lib/data/adapters/dexie/backendDataMaintenance';
import { appSettingsRepository as dexieAppSettingsRepository } from '@/lib/data/adapters/dexie/settingsRepository';
import { grinderRepository as dexieGrinderRepository } from '@/lib/data/adapters/dexie/grinderRepository';
import { customEquipmentRepository as dexieCustomEquipmentRepository } from '@/lib/data/adapters/dexie/customEquipmentRepository';
import { customMethodRepository as dexieCustomMethodRepository } from '@/lib/data/adapters/dexie/customMethodRepository';
import { coffeeBeanRepository as dexieCoffeeBeanRepository } from '@/lib/data/adapters/dexie/coffeeBeanRepository';
import { brewingNoteRepository as dexieBrewingNoteRepository } from '@/lib/data/adapters/dexie/brewingNoteRepository';
import {
  coffeeBeanImageRepository as dexieCoffeeBeanImageRepository,
  coffeeBeanPersistence as dexieCoffeeBeanPersistence,
} from '@/lib/data/adapters/dexie/coffeeBeanImageRepository';
import {
  brewingNoteImageRepository as dexieBrewingNoteImageRepository,
  brewingNotePersistence as dexieBrewingNotePersistence,
} from '@/lib/data/adapters/dexie/brewingNoteImageRepository';
import { offlineQueueRepository as dexieOfflineQueueRepository } from '@/lib/data/adapters/dexie/offlineQueueRepository';
import { legacySettingsRepository as dexieLegacySettingsRepository } from '@/lib/data/adapters/dexie/legacySettingsRepository';
import { roasterRenamePersistence as dexieRoasterRenamePersistence } from '@/lib/data/adapters/dexie/roasterRenamePersistence';
import { configureRepositories } from '@/lib/data/repositories';

const dexieRepositories = {
  appSettingsRepository: dexieAppSettingsRepository,
  grinderRepository: dexieGrinderRepository,
  customEquipmentRepository: dexieCustomEquipmentRepository,
  customMethodRepository: dexieCustomMethodRepository,
  coffeeBeanRepository: dexieCoffeeBeanRepository,
  brewingNoteRepository: dexieBrewingNoteRepository,
  coffeeBeanImageRepository: dexieCoffeeBeanImageRepository,
  coffeeBeanPersistence: dexieCoffeeBeanPersistence,
  brewingNoteImageRepository: dexieBrewingNoteImageRepository,
  brewingNotePersistence: dexieBrewingNotePersistence,
  offlineQueueRepository: dexieOfflineQueueRepository,
  legacySettingsRepository: dexieLegacySettingsRepository,
  roasterRenamePersistence: dexieRoasterRenamePersistence,
  imageMaintenance: dexieImageMaintenance,
  backendDataMaintenance: dexieBackendDataMaintenance,
};

/**
 * Active Dexie startup: bind the existing adapters, then open and maintain
 * BrewGuideDB exactly as the current Web/Native/Desktop path does.
 *
 * Historical Dexie migrations and note/image normalization stay in this
 * backend-specific module. Domain-level roaster migration remains in dataLayer.
 */
export async function initializeDexieDataRuntime(): Promise<void> {
  configureRepositories(dexieRepositories);

  await dbUtils.initialize();
  recordCrashCheckpoint('data-layer:db:maintain');
  await dbUtils.migrateCoffeeBeanImages();
  recordCrashCheckpoint('data-layer:notes:normalize');
  await dexieBrewingNoteMaintenance.normalizeStoredNotes();
}

/** Bind the production Dexie adapters for test fixtures that use BrewGuideDB. */
export function bindDexieRepositories(): void {
  configureRepositories(dexieRepositories);
}
