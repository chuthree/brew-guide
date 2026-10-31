import type { DataRepositories } from '@/lib/data/repositories';
import { createSqliteRoastingPersistence } from './persistence/roastingPersistence';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import type { SqliteDriver } from './driver';
import { createSqliteImageDataServices } from './imageDataServices';
import { createSqliteImageMaintenance } from './imageMaintenance';
import { createSqliteBackendDataMaintenance } from './backendDataMaintenance';
import { createSqliteAppSettingsRepository } from './repositories/appSettings';
import { createSqliteBrewingNoteRepository } from './repositories/brewingNote';
import { createSqliteCoffeeBeanRepository } from './repositories/coffeeBean';
import { createSqliteCustomEquipmentRepository } from './repositories/customEquipment';
import { createSqliteCustomMethodRepository } from './repositories/customMethod';
import { createSqliteGrinderRepository } from './repositories/grinder';
import { createSqliteLegacySettingsRepository } from './repositories/legacySettings';
import { createSqliteOfflineQueueRepository } from './repositories/offlineQueue';
import { createSqliteRoasterRenamePersistence } from './persistence/roasterRename';

export function createSqliteRuntimeRepositories(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore
): DataRepositories {
  const imageServices = createSqliteImageDataServices(driver, fileStore);
  const repositories = {
    roastingPersistence: createSqliteRoastingPersistence(driver, fileStore),
    appSettingsRepository: createSqliteAppSettingsRepository(driver),
    grinderRepository: createSqliteGrinderRepository(driver),
    customEquipmentRepository: createSqliteCustomEquipmentRepository(driver),
    customMethodRepository: createSqliteCustomMethodRepository(driver),
    coffeeBeanRepository: createSqliteCoffeeBeanRepository(driver),
    brewingNoteRepository: createSqliteBrewingNoteRepository(driver),
    ...imageServices,
    offlineQueueRepository: createSqliteOfflineQueueRepository(driver),
    legacySettingsRepository: createSqliteLegacySettingsRepository(driver),
    roasterRenamePersistence: createSqliteRoasterRenamePersistence(driver),
    backendDataMaintenance: createSqliteBackendDataMaintenance(
      driver,
      fileStore
    ),
  } satisfies Omit<DataRepositories, 'imageMaintenance'>;

  return {
    ...repositories,
    imageMaintenance: createSqliteImageMaintenance(repositories),
  };
}
