import {
  applyDataImport,
  applyStreamedDataImport,
  type DataImportPersistence,
} from '../importData';
import { createSqliteCoffeeBeanRepository } from './repositories/coffeeBean';
import { createSqliteBrewingNoteRepository } from './repositories/brewingNote';
import type { SqliteDriver } from './driver';
import type { NativeImageFileStore } from '../images/nativeImageFileStore';
import { toImageRelativePath } from '../images/nativeImageFileStore';
import { createSqliteImageDataServices } from './imageDataServices';
import { createSqliteCustomEquipmentRepository } from './repositories/customEquipment';
import { createSqliteCustomMethodRepository } from './repositories/customMethod';
import { createSqliteGrinderRepository } from './repositories/grinder';
import { createSqliteAppSettingsRepository } from './repositories/appSettings';
import { createSqliteLegacySettingsRepository } from './repositories/legacySettings';
import {
  cleanupUnreferencedPaths,
  hasRollbackDiagnostic,
} from './persistence/brewingNoteImagePersistence';
import { clearOptionalMcpTables } from './mcpMaintenance';

export function createSqliteDataImportPersistence(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore
): DataImportPersistence {
  return {
    async importData(plan) {
      const files = new Set<string>();
      let settled = true;
      const stagedFiles: NativeImageFileStore = {
        read: key => fileStore.read(key),
        exists: key => fileStore.exists(key),
        listObjectKeys: () => fileStore.listObjectKeys(),
        async write(key, bytes) {
          await fileStore.write(key, bytes);
          files.add(key);
        },
        async delete(key) {
          // Existing image cleanup must never delete pre-import files before COMMIT.
          files.add(key);
        },
      };
      try {
        await driver.transaction(async tx => {
          if (plan.methods)
            await tx.execute(
              "DELETE FROM legacy_settings WHERE substr(key, 1, 14) = 'customMethods_'"
            );
          const scoped: SqliteDriver = {
            execute: (sql, params) => tx.execute(sql, params),
            query: (sql, params) => tx.query(sql, params),
            transaction: work => work(tx),
            close: async () => {
              throw new Error('Cannot close an import transaction');
            },
          };
          const imageServices = createSqliteImageDataServices(
            scoped,
            stagedFiles
          );
          await applyDataImport(
            {
              ...imageServices,
              customEquipmentRepository:
                createSqliteCustomEquipmentRepository(scoped),
              customMethodRepository:
                createSqliteCustomMethodRepository(scoped),
              grinderRepository: createSqliteGrinderRepository(scoped),
              appSettingsRepository: createSqliteAppSettingsRepository(scoped),
              legacySettingsRepository:
                createSqliteLegacySettingsRepository(scoped),
            },
            plan
          );
          if (plan.streamed)
            await applyStreamedDataImport(
              {
                ...imageServices,
                coffeeBeanRepository: createSqliteCoffeeBeanRepository(scoped),
                brewingNoteRepository:
                  createSqliteBrewingNoteRepository(scoped),
              },
              plan.streamed
            );
          await clearOptionalMcpTables(tx);
        });
      } catch (error) {
        settled = !hasRollbackDiagnostic(error);
        throw error;
      } finally {
        // Query committed references after COMMIT or ROLLBACK; uncertain reads retain files.
        if (settled)
          await cleanupUnreferencedPaths(
            driver,
            fileStore,
            [...files].map(toImageRelativePath),
            message => console.warn(`[DataImport] ${message}`)
          );
      }
    },
  };
}
