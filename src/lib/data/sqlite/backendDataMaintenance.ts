import type { BackendDataMaintenance } from '@/lib/data/contracts';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { validateImageObjectKey } from '@/lib/data/images/nativeImageFileStore';
import type { SqliteDriver } from './driver';

const CLEARED_TABLES = [
  'brewing_notes',
  'brewing_note_images',
  'coffee_beans',
  'coffee_bean_images',
  'custom_equipments',
  'custom_methods',
  'grinders',
  'app_settings',
  'legacy_settings',
] as const;

/** Match Dexie's reset boundary while removing files after metadata is gone. */
export function createSqliteBackendDataMaintenance(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore
): BackendDataMaintenance {
  return {
    async clearAllData() {
      const objectKeys = await fileStore.listObjectKeys();
      objectKeys.forEach(validateImageObjectKey);

      await driver.transaction(async tx => {
        for (const table of CLEARED_TABLES) {
          await tx.execute(`DELETE FROM ${table}`);
        }
      });

      for (const objectKey of objectKeys) {
        await fileStore.delete(objectKey);
        if (await fileStore.exists(objectKey)) {
          throw new Error('Native image object remained after database reset');
        }
      }
    },
  };
}
