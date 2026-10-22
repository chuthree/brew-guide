import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { bootstrapSqliteSchema } from '@/lib/data/sqlite/schemaBootstrap';
import {
  runLegacySqliteMigration,
  LEGACY_DEXIE_MIGRATION_ID,
} from '@/lib/data/sqlite/legacyMigrationExecutor';
import { createAbsentLegacyMigrationSource } from '@/lib/data/sqlite/legacyMigrationSource';
import { McpToolError } from '@/lib/mcp/validation';

/** Shared migration ownership: a Provider never adopts unknown legacy data. */
export async function initializeProviderStorage(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  canAdoptFresh: boolean
): Promise<void> {
  const tables = await driver.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migration_state'"
  );
  const states = tables.length
    ? await driver.query('SELECT id, status FROM migration_state')
    : [];
  const completed = states.some(
    row => row.id === LEGACY_DEXIE_MIGRATION_ID && row.status === 'completed'
  );
  if (!completed && (!canAdoptFresh || states.length > 0)) {
    throw new McpToolError(
      'MIGRATION_REQUIRED',
      'Open Brew Guide once to complete the existing data migration before connecting other applications.'
    );
  }
  await bootstrapSqliteSchema(driver);
  await runLegacySqliteMigration({
    driver,
    imageFileStore: fileStore,
    loadSource: async () => {
      if (!canAdoptFresh)
        throw new McpToolError(
          'MIGRATION_REQUIRED',
          'Existing data requires migration in Brew Guide.'
        );
      return createAbsentLegacyMigrationSource();
    },
  });
}
