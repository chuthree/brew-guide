import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDexieOfflineQueueRepository } from './offlineQueueRepository';
import type { PendingOperation } from '@/lib/supabase/realtime/types';

class OfflineQueueTestDatabase extends Dexie {
  pendingOperations!: Table<PendingOperation, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      pendingOperations: 'id, table, recordId, timestamp',
    });
  }
}

const operation = (
  id: string,
  timestamp: number,
  overrides: Partial<PendingOperation> = {}
): PendingOperation => ({
  id,
  table: 'coffee_beans',
  type: 'upsert',
  recordId: `bean-${id}`,
  data: { id: `bean-${id}` },
  timestamp,
  retryCount: 0,
  ...overrides,
});

describe('Dexie OfflineQueueRepository', () => {
  let database: OfflineQueueTestDatabase;
  let repository: ReturnType<typeof createDexieOfflineQueueRepository>;

  beforeEach(async () => {
    database = new OfflineQueueTestDatabase(
      `BrewGuideOfflineQueueRepositoryTest-${Date.now()}-${Math.random()}`
    );
    await database.open();
    repository = createDexieOfflineQueueRepository(database.pendingOperations);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('supports empty, add, get, update, delete, count, and clear', async () => {
    expect(await repository.listOrdered()).toEqual([]);
    expect(await repository.get('missing')).toBeUndefined();
    expect(await repository.count()).toBe(0);

    await repository.add(operation('one', 10));
    expect(await repository.get('one')).toEqual(operation('one', 10));
    expect(await repository.count()).toBe(1);

    await repository.update('one', { retryCount: 2, lastError: 'offline' });
    expect(await repository.get('one')).toMatchObject({
      id: 'one',
      retryCount: 2,
      lastError: 'offline',
    });

    await repository.delete('one');
    expect(await repository.get('one')).toBeUndefined();
    expect(await repository.count()).toBe(0);

    await repository.add(operation('two', 20));
    await repository.add(operation('three', 30));
    await repository.clear();
    expect(await repository.count()).toBe(0);
  });

  it('returns operations in ascending timestamp order', async () => {
    await repository.add(operation('late', 300));
    await repository.add(operation('early', 100));
    await repository.add(operation('middle', 200));

    expect((await repository.listOrdered()).map(item => item.id)).toEqual([
      'early',
      'middle',
      'late',
    ]);
  });

  it('preserves retry fields and unknown stored fields', async () => {
    const storedOperation = {
      ...operation('extra', 40),
      lastError: 'Network unavailable',
      failedAt: 1234,
      legacyDiagnostic: { source: 'older-app' },
    } as PendingOperation;

    await repository.add(storedOperation);
    await repository.update('extra', { retryCount: 2 });

    expect(await repository.get('extra')).toEqual({
      ...storedOperation,
      retryCount: 2,
    });
  });

  it('returns all target duplicates without imposing uniqueness', async () => {
    await repository.add(
      operation('duplicate-a', 50, { recordId: 'same-target' })
    );
    await repository.add(
      operation('duplicate-b', 60, { recordId: 'same-target' })
    );

    const duplicates = await repository.findByTarget(
      'coffee_beans',
      'same-target'
    );

    expect(duplicates.map(item => item.id)).toHaveLength(2);
    expect(new Set(duplicates.map(item => item.id))).toEqual(
      new Set(['duplicate-a', 'duplicate-b'])
    );
    expect(await repository.count()).toBe(2);
  });
});
