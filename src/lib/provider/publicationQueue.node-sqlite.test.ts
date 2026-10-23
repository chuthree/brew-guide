import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import { saveCoffeeBean } from '@/lib/data/sqlite/repositories/coffeeBean';
import { createSqliteOfflineQueueRepository } from '@/lib/data/sqlite/repositories/offlineQueue';
import { bootstrapSqliteSchema } from '@/lib/data/sqlite/schemaBootstrap';
import { materializeProviderPublication } from './publicationQueue';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import type { MutationChange } from '@/lib/mcp/storage';

let db: NodeSqliteTestDatabase;
const files: NativeImageFileStore = {
  write: async () => undefined,
  read: async () => {
    throw new Error('missing private image');
  },
  delete: async () => undefined,
  exists: async () => false,
  listObjectKeys: async () => [],
};
const dirty = vi.fn();
async function publish(id: string, changes: MutationChange[]) {
  await db.driver.execute(
    'INSERT INTO provider_publications VALUES (?, ?, ?)',
    [id, JSON.stringify(changes), 1]
  );
}
const beanChange: MutationChange = {
  entity: 'bean',
  id: 'bean',
  before: null,
  after: { id: 'bean' },
};
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  await db.driver.execute(
    'CREATE TABLE provider_publications (id TEXT NOT NULL PRIMARY KEY, changes_json TEXT NOT NULL, created_at_ms INTEGER NOT NULL)'
  );
  await saveCoffeeBean(db.driver, {
    id: 'bean',
    name: 'Current name',
    remaining: '88',
    timestamp: 100,
  });
  dirty.mockReset();
});
afterEach(async () => {
  await db.close();
});

describe('Android Provider durable publication handoff (real SQLite)', () => {
  it('hydrates current images into real sync queue, then atomically acknowledges and replays safely', async () => {
    await db.driver.execute(
      "INSERT INTO coffee_bean_images(image_id,bean_id,slot,variant,source_kind,external_url) VALUES ('img','bean','front','original','external','https://example.test/image.png')"
    );
    await publish('publication', [beanChange]);
    await materializeProviderPublication(
      db.driver,
      files,
      'publication',
      dirty
    );
    const queue = createSqliteOfflineQueueRepository(db.driver);
    const operations = await queue.listOrdered();
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      table: 'coffee_beans',
      recordId: 'bean',
      type: 'upsert',
      data: {
        name: 'Current name',
        remaining: '88',
        image: 'https://example.test/image.png',
      },
    });
    expect(
      await materializeProviderPublication(
        db.driver,
        files,
        'publication',
        dirty
      )
    ).toEqual([]);
    expect(await queue.count()).toBe(1);
    await expect(bootstrapSqliteSchema(db.driver)).resolves.toMatchObject({
      userVersion: 1,
    });
  });
  it('uses current deletion and coalesces earlier pending operations', async () => {
    const queue = createSqliteOfflineQueueRepository(db.driver);
    await queue.add({
      id: 'previous',
      table: 'coffee_beans',
      type: 'upsert',
      recordId: 'bean',
      data: { stale: true },
      timestamp: 1,
      retryCount: 2,
    });
    await db.driver.execute("DELETE FROM coffee_beans WHERE id = 'bean'");
    await publish('deleted', [beanChange]);
    await materializeProviderPublication(db.driver, files, 'deleted', dirty);
    const operations = await queue.listOrdered();
    expect(operations).toHaveLength(1);
    expect(operations[0]).toMatchObject({
      id: 'previous',
      type: 'delete',
      retryCount: 0,
    });
    expect(operations[0].data).toBeUndefined();
  });
  it('keeps the outbox and rolls back queue work when image reconstruction fails', async () => {
    await db.driver.execute(
      "INSERT INTO coffee_bean_images(image_id,bean_id,slot,variant,source_kind,relative_path,mime_type,size_bytes) VALUES ('img','bean','front','original','file','images/v1/objects/missing','image/png',12)"
    );
    await publish('broken', [beanChange]);
    await expect(
      materializeProviderPublication(db.driver, files, 'broken', dirty)
    ).rejects.toThrow('file-unavailable');
    expect(
      await db.driver.query('SELECT id FROM provider_publications')
    ).toHaveLength(1);
    expect(await createSqliteOfflineQueueRepository(db.driver).count()).toBe(0);
  });
  it('persists settings dirty before acknowledgement and does not enqueue unsupported sync tables', async () => {
    await publish('settings', [
      { entity: 'settings', id: 'main', before: {}, after: { language: 'zh' } },
    ]);
    await materializeProviderPublication(db.driver, files, 'settings', dirty);
    expect(dirty).toHaveBeenCalledOnce();
    expect(await createSqliteOfflineQueueRepository(db.driver).count()).toBe(0);
    expect(
      await db.driver.query('SELECT id FROM provider_publications')
    ).toHaveLength(0);
  });
  it('does not acknowledge when persisting settings marker fails', async () => {
    await publish('settings', [
      { entity: 'grinder', id: 'grinder', before: null, after: {} },
    ]);
    await expect(
      materializeProviderPublication(db.driver, files, 'settings', () => {
        throw new Error('local storage unavailable');
      })
    ).rejects.toThrow('local storage unavailable');
    expect(
      await db.driver.query('SELECT id FROM provider_publications')
    ).toHaveLength(1);
  });
});
