import { afterEach, describe, expect, it } from 'vitest';
import {
  toImageRelativePath,
  type NativeImageFileStore,
} from '@/lib/data/images/nativeImageFileStore';
import type { SqliteDriver } from './driver';
import { createSqliteBackendDataMaintenance } from './backendDataMaintenance';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from './repositories/testing/nodeSqliteTestDriver';

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;

class TestFileStore implements NativeImageFileStore {
  readonly objects = new Map<string, Uint8Array>([
    ['active-image', new Uint8Array([1])],
    ['orphan-image', new Uint8Array([2])],
  ]);

  async write(): Promise<void> {
    throw new Error('not used');
  }

  async read(objectKey: string): Promise<Uint8Array> {
    const bytes = this.objects.get(objectKey);
    if (!bytes) throw new Error('missing file');
    return bytes;
  }

  async delete(objectKey: string): Promise<void> {
    this.objects.delete(objectKey);
  }

  async exists(objectKey: string): Promise<boolean> {
    return this.objects.has(objectKey);
  }

  async listObjectKeys(): Promise<string[]> {
    return Array.from(this.objects.keys());
  }
}

let database: NodeSqliteTestDatabase | undefined;

describeNodeSqlite('SQLite backend data maintenance (node:sqlite)', () => {
  afterEach(async () => {
    await database?.close();
    database = undefined;
  });

  it('clears active records and image files while preserving queue and migration archive state', async () => {
    database = await createNodeSqliteTestDatabase();
    const driver: SqliteDriver = database.driver;
    const fileStore = new TestFileStore();
    await driver.transaction(async tx => {
      await tx.execute("INSERT INTO coffee_beans VALUES ('bean', 1, '{}')");
      await tx.execute(
        "INSERT INTO brewing_notes VALUES ('note', 1, NULL, NULL, '{}')"
      );
      await tx.execute(
        "INSERT INTO coffee_bean_images VALUES ('bean-image', 'bean', 'front', 'original', 'file', ?, 'image/png', 1, NULL, NULL, 1)",
        [toImageRelativePath('active-image')]
      );
      await tx.execute(
        "INSERT INTO brewing_note_images VALUES ('note-image', 'note', 0, 'original', 'file', ?, 'image/png', 1, NULL, NULL, 1)",
        [toImageRelativePath('active-image')]
      );
      await tx.execute(
        "INSERT INTO custom_equipments VALUES ('equipment', '{}')"
      );
      await tx.execute(
        "INSERT INTO custom_methods VALUES ('equipment', '[]', '{}')"
      );
      await tx.execute("INSERT INTO grinders VALUES ('grinder', '{}')");
      await tx.execute("INSERT INTO app_settings VALUES ('main', '{}')");
      await tx.execute("INSERT INTO legacy_settings VALUES ('key', 'value')");
      await tx.execute(
        "INSERT INTO pending_operations VALUES ('queue', 'future_table', 'future_action', 'record', 1, 0, NULL, NULL, NULL, '{}')"
      );
      await tx.execute(
        "INSERT INTO historical_yearly_reports VALUES ('report', 2020, 'user', 'content', 1, '{}')"
      );
      await tx.execute(
        "INSERT INTO migration_state VALUES ('legacy-dexie-import-v1', 'completed', '{}', '{}')"
      );
    });

    await createSqliteBackendDataMaintenance(driver, fileStore).clearAllData();

    const clearedTables = [
      'brewing_notes',
      'brewing_note_images',
      'coffee_beans',
      'coffee_bean_images',
      'custom_equipments',
      'custom_methods',
      'grinders',
      'app_settings',
      'legacy_settings',
    ];
    for (const table of clearedTables) {
      const [row] = await driver.query(
        `SELECT COUNT(*) AS count FROM ${table}`
      );
      expect(row.count, table).toBe(0);
    }
    for (const table of [
      'pending_operations',
      'historical_yearly_reports',
      'migration_state',
    ]) {
      const [row] = await driver.query(
        `SELECT COUNT(*) AS count FROM ${table}`
      );
      expect(row.count, table).toBe(1);
    }
    expect(fileStore.objects.size).toBe(0);
  });
});
