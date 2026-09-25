import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDexieOfflineQueueRepository } from './offlineQueueRepository';
import type { StoredPendingOperation } from '@/lib/data/models';
import type { PendingOperationUpdate } from '@/lib/data/contracts';
import type { PendingOperation } from '@/lib/supabase/realtime/types';

class OfflineQueueTestDatabase extends Dexie {
  pendingOperations!: Table<StoredPendingOperation, string>;

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

function rawPatch(value: unknown): PendingOperationUpdate {
  return value as PendingOperationUpdate;
}

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
    const storedOperation: StoredPendingOperation = {
      ...operation('extra', 40),
      table: 'historical_table',
      type: 'historical_action',
      lastError: 'Network unavailable',
      failedAt: 1234,
      legacyDiagnostic: { source: 'older-app' },
      futureMetadata: { state: 'kept', values: [1, null, true] },
    };

    await database.pendingOperations.add(storedOperation);
    await repository.update('extra', { type: 'delete', retryCount: 2 });

    expect(await repository.count()).toBe(1);
    expect(await repository.get('extra')).toEqual({
      ...storedOperation,
      type: 'delete',
      retryCount: 2,
    });
    expect(await repository.listOrdered()).toEqual([
      { ...storedOperation, type: 'delete', retryCount: 2 },
    ]);
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

  it.each(['type', 'timestamp', 'retryCount'] as const)(
    'confirms raw Dexie removes required %s when patched with undefined',
    async field => {
      const original = operation(`raw-required-${field}`, 70);
      await database.pendingOperations.add({ ...original });

      await database.pendingOperations.update(original.id, {
        [field]: undefined,
      } as never);

      const updated = await database.pendingOperations.get(original.id);
      expect(updated).toBeDefined();
      expect(Object.hasOwn(updated!, field)).toBe(false);
    }
  );

  it.each(['type', 'timestamp', 'retryCount'] as const)(
    'rejects an explicit undefined %s patch without changing the row',
    async field => {
      const original = operation(`required-${field}`, 80);
      await repository.add(original);

      await expect(
        repository.update(original.id, rawPatch({ [field]: undefined }))
      ).rejects.toThrow(new RegExp(field));
      expect(await repository.get(original.id)).toEqual(original);
    }
  );

  it('rejects a mixed valid and invalid patch before changing any field', async () => {
    const original = operation('mixed-invalid', 90);
    await repository.add(original);

    await expect(
      repository.update(
        original.id,
        rawPatch({ retryCount: 5, type: undefined })
      )
    ).rejects.toThrow(/type/);
    expect(await repository.get(original.id)).toEqual(original);
  });

  it('validates before looking up a missing row', async () => {
    await expect(
      repository.update('missing', rawPatch({ type: undefined }))
    ).rejects.toThrow(/type/);
    expect(await repository.get('missing')).toBeUndefined();
  });

  it('keeps empty and absent patches unchanged and removes optional undefined fields', async () => {
    const original: PendingOperation = {
      ...operation('optional-fields', 100),
      lastError: 'offline',
      failedAt: 99,
    };
    await repository.add(original);

    await repository.update(original.id, {});
    expect(await repository.get(original.id)).toEqual(original);

    await repository.update(original.id, { retryCount: 1 });
    expect(await repository.get(original.id)).toEqual({
      ...original,
      retryCount: 1,
    });

    await repository.update(
      original.id,
      rawPatch({ data: undefined, lastError: undefined, failedAt: undefined })
    );
    const updated = await repository.get(original.id);
    expect(updated).toBeDefined();
    expect(Object.hasOwn(updated!, 'data')).toBe(false);
    expect(Object.hasOwn(updated!, 'lastError')).toBe(false);
    expect(Object.hasOwn(updated!, 'failedAt')).toBe(false);
    expect(updated).toMatchObject({
      id: original.id,
      retryCount: 1,
      timestamp: original.timestamp,
    });
  });

  it('applies valid field replacements and preserves contract-supported null data', async () => {
    const original = operation('valid-patch', 120);
    await repository.add(original);

    await repository.update(original.id, {
      type: 'delete',
      data: null,
      timestamp: 123,
      retryCount: 2,
      lastError: 'offline',
      failedAt: 456,
    });

    expect(await repository.get(original.id)).toEqual({
      ...original,
      type: 'delete',
      data: null,
      timestamp: 123,
      retryCount: 2,
      lastError: 'offline',
      failedAt: 456,
    });
  });

  it.each(['lastError', 'failedAt'] as const)(
    'rejects null for non-nullable %s without changing the row',
    async field => {
      const original: PendingOperation = {
        ...operation(`null-${field}`, 130),
        lastError: 'offline',
        failedAt: 456,
      };
      await repository.add(original);

      await expect(
        repository.update(original.id, rawPatch({ [field]: null }))
      ).rejects.toThrow(new RegExp(field));
      expect(await repository.get(original.id)).toEqual(original);
    }
  );

  it('allows valid updates to unknown stored rows without narrowing them', async () => {
    const storedOperation: StoredPendingOperation = {
      ...operation('unknown-row', 110),
      table: 'legacyTable',
      type: 'legacyAction',
      futureField: { nested: ['preserved', 1] },
    };
    await database.pendingOperations.add(storedOperation);

    await repository.update(storedOperation.id, {
      type: 'delete',
      retryCount: 3,
    });

    expect(await repository.get(storedOperation.id)).toEqual({
      ...storedOperation,
      type: 'delete',
      retryCount: 3,
    });
  });
});
