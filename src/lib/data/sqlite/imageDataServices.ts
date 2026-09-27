import type { DataRepositories } from '@/lib/data/repositories';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import type { SqliteDriver } from './driver';
import {
  createSqliteBrewingNoteImageRepository,
  createSqliteCoffeeBeanImageRepository,
} from './imageReadRepositories';
import { sqliteImageSourcePayloadValidator } from './imageSourcePayloadValidator';
import { createSqliteBrewingNotePersistence } from './persistence/brewingNoteImagePersistence';
import { createSqliteCoffeeBeanPersistence } from './persistence/coffeeBeanImagePersistence';

/**
 * Constructable Native image services. This does not bind or initialize the
 * production data runtime.
 */
export type SqliteImageDataServices = Pick<
  DataRepositories,
  | 'coffeeBeanImageRepository'
  | 'coffeeBeanPersistence'
  | 'brewingNoteImageRepository'
  | 'brewingNotePersistence'
  | 'imageSourcePayloadValidator'
>;

export function createSqliteImageDataServices(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore
): SqliteImageDataServices {
  return {
    coffeeBeanImageRepository: createSqliteCoffeeBeanImageRepository(
      driver,
      fileStore
    ),
    coffeeBeanPersistence: createSqliteCoffeeBeanPersistence(driver, fileStore),
    brewingNoteImageRepository: createSqliteBrewingNoteImageRepository(
      driver,
      fileStore
    ),
    brewingNotePersistence: createSqliteBrewingNotePersistence(
      driver,
      fileStore
    ),
    imageSourcePayloadValidator: sqliteImageSourcePayloadValidator,
  };
}
