import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  LEGACY_DEXIE_MIGRATION_ID,
  runLegacySqliteMigration,
} from '@/lib/data/sqlite/legacyMigrationExecutor';
import { createAbsentLegacyMigrationSource } from '@/lib/data/sqlite/legacyMigrationSource';
import {
  saveCoffeeBean,
  getCoffeeBean,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { initializeProviderStorage } from './storageBootstrap';
let db: NodeSqliteTestDatabase;
const files: NativeImageFileStore = {
  write: async () => undefined,
  read: async () => new Uint8Array(),
  delete: async () => undefined,
  exists: async () => false,
  listObjectKeys: async () => [],
};
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
});
afterEach(async () => {
  await db.close();
});
describe('Provider cold-start storage ownership', () => {
  it('uses canonical fresh-install marker so later foreground startup preserves Provider records', async () => {
    await initializeProviderStorage(db.driver, files, true);
    await saveCoffeeBean(db.driver, {
      id: 'cold',
      name: 'Provider created',
      timestamp: 1,
    });
    await expect(
      runLegacySqliteMigration({
        driver: db.driver,
        imageFileStore: files,
        loadSource: async () => createAbsentLegacyMigrationSource(),
      })
    ).resolves.toEqual({ status: 'already-completed' });
    await initializeProviderStorage(db.driver, files, false);
    expect((await getCoffeeBean(db.driver, 'cold'))?.name).toBe(
      'Provider created'
    );
    const rows = await db.driver.query('SELECT * FROM migration_state');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: LEGACY_DEXIE_MIGRATION_ID,
      status: 'completed',
    });
    expect(JSON.parse(String(rows[0].details_json))).toEqual({
      kind: 'fresh-install',
      schemaVersion: 1,
    });
  });
  it('rejects native-detected legacy data without writing a migration marker', async () => {
    await expect(
      initializeProviderStorage(db.driver, files, false)
    ).rejects.toMatchObject({ code: 'MIGRATION_REQUIRED' });
    expect(await db.driver.query('SELECT * FROM migration_state')).toHaveLength(
      0
    );
  });
  it('does not adopt unowned SQLite rows even if native storage looks fresh', async () => {
    await saveCoffeeBean(db.driver, {
      id: 'unowned',
      name: 'Keep',
      timestamp: 1,
    });
    await expect(
      initializeProviderStorage(db.driver, files, true)
    ).rejects.toThrow('ownership marker');
    expect(await getCoffeeBean(db.driver, 'unowned')).toBeDefined();
    expect(await db.driver.query('SELECT * FROM migration_state')).toHaveLength(
      0
    );
  });
  it('requires UI to recover an unfinished migration', async () => {
    await db.driver.execute('INSERT INTO migration_state VALUES (?, ?, ?, ?)', [
      LEGACY_DEXIE_MIGRATION_ID,
      'in_progress',
      '{}',
      '{}',
    ]);
    await expect(
      initializeProviderStorage(db.driver, files, true)
    ).rejects.toMatchObject({ code: 'MIGRATION_REQUIRED' });
    expect(
      (await db.driver.query('SELECT status FROM migration_state'))[0].status
    ).toBe('in_progress');
  });
});
