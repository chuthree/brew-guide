import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDexieOfflineQueueRepository } from '@/lib/data/adapters/dexie/offlineQueueRepository';
import type {
  OfflineQueueRepository,
  PendingOperationUpdate,
} from '@/lib/data/contracts';
import type { StoredPendingOperation } from '@/lib/data/models';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import { encodePendingOperation } from '../codecs';
import type { PendingOperationRow } from '../schemaV1';
import { createSqliteOfflineQueueRepository } from './offlineQueue';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from './testing/nodeSqliteTestDriver';
import type { PendingOperation } from '@/lib/supabase/realtime/types';

class OfflineQueueParityDatabase extends Dexie {
  pendingOperations!: Table<StoredPendingOperation, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      pendingOperations: 'id, table, recordId, timestamp',
    });
  }
}

const makeOperation = (
  id: string,
  timestamp: number,
  overrides: Partial<PendingOperation> = {}
): PendingOperation => ({
  id,
  table: 'coffee_beans',
  type: 'upsert',
  recordId: `bean-${id}`,
  timestamp,
  retryCount: 0,
  ...overrides,
});

const INSERT_SQL = `
  INSERT INTO pending_operations (
    id,
    table_name,
    operation_type,
    record_id,
    timestamp_ms,
    retry_count,
    last_error,
    failed_at_ms,
    data_json,
    extra_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function getDatabase(): NodeSqliteTestDatabase {
  if (!database) throw new Error('Node SQLite test database is not open');
  return database;
}

let database: NodeSqliteTestDatabase | undefined;
let repository: OfflineQueueRepository;
let dexieDatabase: OfflineQueueParityDatabase;
let dexieRepository: OfflineQueueRepository;

async function insertEncodedStoredOperation(
  operation: unknown,
  overrides: Partial<PendingOperationRow> = {}
): Promise<void> {
  const row = { ...encodePendingOperation(operation), ...overrides };
  await getDatabase().driver.execute(INSERT_SQL, [
    row.id,
    row.table_name,
    row.operation_type,
    row.record_id,
    row.timestamp_ms,
    row.retry_count,
    row.last_error,
    row.failed_at_ms,
    row.data_json,
    row.extra_json,
  ]);
}

async function readRawRow(
  id: string
): Promise<Record<string, unknown> | undefined> {
  const rows = await getDatabase().driver.query(
    `SELECT
       id,
       table_name,
       operation_type,
       record_id,
       timestamp_ms,
       retry_count,
       last_error,
       failed_at_ms,
       data_json,
       extra_json
     FROM pending_operations
     WHERE id = ?`,
    [id]
  );
  return rows[0];
}

function createFailAfterUpdateDriver(driver: SqliteDriver): SqliteDriver {
  return {
    execute: (sql, params) => driver.execute(sql, params),
    query: (sql, params) => driver.query(sql, params),
    transaction<T>(work: (tx: SqliteExecutor) => Promise<T>): Promise<T> {
      return driver.transaction(tx =>
        work({
          query: (sql, params) => tx.query(sql, params),
          async execute(sql, params) {
            const result = await tx.execute(sql, params);
            if (/^\s*UPDATE\s+pending_operations/i.test(sql)) {
              throw new Error(
                'Injected failure after pending operation UPDATE'
              );
            }
            return result;
          },
        })
      );
    },
    close: () => driver.close(),
  };
}

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;
const nodeSqliteLabel = supportsNodeSqlite()
  ? `real SQLite (node:sqlite, Node ${process.versions.node})`
  : `SKIPPED: node:sqlite unavailable on Node ${process.versions.node}; requires Node >=22.13`;

describeNodeSqlite(`${nodeSqliteLabel} OfflineQueueRepository`, () => {
  beforeEach(async () => {
    database = await createNodeSqliteTestDatabase();
    repository = createSqliteOfflineQueueRepository(getDatabase().driver);

    dexieDatabase = new OfflineQueueParityDatabase(
      `BrewGuideOfflineQueueParity-${Date.now()}-${Math.random()}`
    );
    await dexieDatabase.open();
    dexieRepository = createDexieOfflineQueueRepository(
      dexieDatabase.pendingOperations
    );
  });

  afterEach(async () => {
    await dexieDatabase?.delete();
    await database?.close();
    database = undefined;
  });

  it('adds, gets, counts, deletes, and clears queue records', async () => {
    const operation = makeOperation('normal', 10, { data: { value: 1 } });
    expect(await repository.get('missing')).toBeUndefined();
    expect(await repository.count()).toBe(0);

    await repository.add(operation);
    expect(await repository.get(operation.id)).toEqual(operation);
    expect(await repository.count()).toBe(1);

    await repository.delete('missing');
    await repository.delete(operation.id);
    expect(await repository.get(operation.id)).toBeUndefined();
    expect(await repository.count()).toBe(0);

    await repository.add(makeOperation('clear-a', 20));
    await repository.add(makeOperation('clear-b', 30));
    await repository.clear();
    expect(await repository.count()).toBe(0);
  });

  it('uses insert-only semantics and preserves the first row on duplicate id', async () => {
    const first = makeOperation('same-id', 10, { data: { first: true } });
    const second = makeOperation('same-id', 20, { data: { second: true } });
    await repository.add(first);

    await expect(repository.add(second)).rejects.toThrow();
    expect(await repository.get(first.id)).toEqual(first);
    expect(await repository.count()).toBe(1);
  });

  it('returns every duplicate target ordered by id ascending', async () => {
    await repository.add(makeOperation('z-id', 1, { recordId: 'same-target' }));
    await repository.add(makeOperation('m-id', 2, { recordId: 'same-target' }));
    await repository.add(makeOperation('a-id', 3, { recordId: 'same-target' }));

    const matching = await repository.findByTarget(
      'coffee_beans',
      'same-target'
    );
    expect(matching.map(item => item.id)).toEqual(['a-id', 'm-id', 'z-id']);
    expect(await repository.count()).toBe(3);
  });

  it('orders queue records by timestamp then id ascending', async () => {
    await repository.add(makeOperation('c', 100));
    await repository.add(makeOperation('a', 100));
    await repository.add(makeOperation('b', 50));

    expect((await repository.listOrdered()).map(item => item.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('applies valid patches and preserves explicit null data', async () => {
    const original = makeOperation('patch-all', 10, {
      data: { before: true },
      lastError: 'old error',
      failedAt: 9,
    });
    await repository.add(original);

    await repository.update(original.id, {
      type: 'delete',
      data: null,
      timestamp: 123,
      retryCount: 0,
      lastError: 'offline',
      failedAt: 456,
    });

    expect(await repository.get(original.id)).toEqual({
      ...original,
      type: 'delete',
      data: null,
      timestamp: 123,
      retryCount: 0,
      lastError: 'offline',
      failedAt: 456,
    });
  });

  it('keeps absent optional fields unchanged and removes optional undefined fields', async () => {
    const original = makeOperation('optional-patch', 20, {
      data: { before: true },
      lastError: 'keep until patched',
      failedAt: 99,
    });
    await repository.add(original);

    await repository.update(original.id, { retryCount: 2 });
    expect(await repository.get(original.id)).toEqual({
      ...original,
      retryCount: 2,
    });

    await repository.update(original.id, {
      data: undefined,
      lastError: undefined,
      failedAt: undefined,
    });
    const updated = await repository.get(original.id);
    expect(updated).toBeDefined();
    expect(Object.hasOwn(updated!, 'data')).toBe(false);
    expect(Object.hasOwn(updated!, 'lastError')).toBe(false);
    expect(Object.hasOwn(updated!, 'failedAt')).toBe(false);
    expect(updated).toMatchObject({
      id: original.id,
      timestamp: original.timestamp,
      retryCount: 2,
    });
  });

  it('rejects invalid patches before row access and leaves existing rows unchanged', async () => {
    const original = makeOperation('invalid-patch', 30);
    await repository.add(original);

    const invalidPatch = {
      retryCount: 3,
      type: undefined,
    } as unknown as PendingOperationUpdate;
    await expect(repository.update(original.id, invalidPatch)).rejects.toThrow(
      /type/
    );
    expect(await repository.get(original.id)).toEqual(original);

    await expect(
      repository.update('missing-invalid', {
        type: undefined,
      } as unknown as PendingOperationUpdate)
    ).rejects.toThrow(/type/);
    expect(await repository.get('missing-invalid')).toBeUndefined();
  });

  it('resolves for an empty patch and a valid patch on a missing id', async () => {
    const original = makeOperation('empty-patch', 40);
    await repository.add(original);

    await expect(repository.update(original.id, {})).resolves.toBeUndefined();
    expect(await repository.get(original.id)).toEqual(original);

    await expect(
      repository.update('missing-valid', { retryCount: 4 })
    ).resolves.toBeUndefined();
    expect(await repository.get('missing-valid')).toBeUndefined();
    expect(await repository.count()).toBe(1);
  });

  it('preserves unknown stored rows through get, list, count, and update', async () => {
    const stored: StoredPendingOperation = {
      ...makeOperation('legacy-row', 50),
      table: 'legacyTable',
      type: 'legacyAction',
      lastError: 'old error',
      futureField: { nested: ['kept', null, true] },
    };
    await insertEncodedStoredOperation(stored);

    expect(await repository.get(stored.id)).toEqual(stored);
    expect(await repository.listOrdered()).toEqual([stored]);
    expect(await repository.count()).toBe(1);

    await repository.update(stored.id, { retryCount: 2 });
    expect(await repository.get(stored.id)).toEqual({
      ...stored,
      retryCount: 2,
    });

    await repository.update(stored.id, { lastError: undefined });
    const updated = await repository.get(stored.id);
    const expected = { ...stored, retryCount: 2 };
    delete expected.lastError;
    expect(updated).toEqual(expected);
    expect(Object.hasOwn(updated!, 'lastError')).toBe(false);
  });

  it('allows a valid type patch on a row with an unknown table', async () => {
    const stored: StoredPendingOperation = {
      ...makeOperation('legacy-type-row', 60),
      table: 'legacyTable',
      type: 'legacyAction',
      futureField: { keep: true },
    };
    await insertEncodedStoredOperation(stored);

    await repository.update(stored.id, { type: 'delete' });
    expect(await repository.get(stored.id)).toEqual({
      ...stored,
      type: 'delete',
    });
  });

  it('counts and clears unknown rows without touching other tables', async () => {
    await repository.add(makeOperation('known', 70));
    await insertEncodedStoredOperation({
      ...makeOperation('unknown', 80),
      table: 'legacyTable',
      type: 'legacyAction',
    });
    await getDatabase().driver.execute(
      'INSERT INTO legacy_settings (key, value) VALUES (?, ?)',
      ['retain', 'value']
    );

    expect(await repository.count()).toBe(2);
    await repository.delete('unknown');
    await repository.delete('missing');
    expect(await repository.count()).toBe(1);

    await repository.clear();
    expect(await repository.count()).toBe(0);
    expect(
      await getDatabase().driver.query(
        'SELECT key, value FROM legacy_settings WHERE key = ?',
        ['retain']
      )
    ).toEqual([{ key: 'retain', value: 'value' }]);
  });

  it('rejects malformed JSON and invalid required projections in get and list', async () => {
    await insertEncodedStoredOperation(makeOperation('bad-data-json', 90), {
      data_json: '{',
    });
    await expect(repository.get('bad-data-json')).rejects.toThrow(/JSON/i);
    await expect(repository.listOrdered()).rejects.toThrow(/JSON/i);

    await insertEncodedStoredOperation(makeOperation('bad-extra-json', 91), {
      extra_json: '{',
    });
    await expect(repository.get('bad-extra-json')).rejects.toThrow(/JSON/i);

    await insertEncodedStoredOperation(makeOperation('bad-timestamp', 92), {
      timestamp_ms: 1.5,
    });
    await expect(repository.get('bad-timestamp')).rejects.toThrow(/timestamp/i);
  });

  it('does not overwrite a corrupt row during update', async () => {
    await insertEncodedStoredOperation(makeOperation('corrupt-update', 100), {
      data_json: '{',
    });
    const before = await readRawRow('corrupt-update');

    await expect(
      repository.update('corrupt-update', { retryCount: 2 })
    ).rejects.toThrow(/JSON/i);
    expect(await readRawRow('corrupt-update')).toEqual(before);
  });

  it('rolls back an update failure after SQL has modified the row', async () => {
    const original = makeOperation('rollback-update', 110, {
      data: { original: true },
      futureField: { state: 'before' },
    } as Partial<PendingOperation>);
    await repository.add(original);
    const before = await readRawRow(original.id);

    const failingRepository = createSqliteOfflineQueueRepository(
      createFailAfterUpdateDriver(getDatabase().driver)
    );
    await expect(
      failingRepository.update(original.id, { retryCount: 3 })
    ).rejects.toThrow(/Injected failure/);

    expect(await readRawRow(original.id)).toEqual(before);
    expect(await repository.get(original.id)).toEqual(original);
  });

  const parityCases: Array<[string, PendingOperationUpdate]> = [
    ['data undefined removes the property', { data: undefined }],
    ['data null preserves explicit null', { data: null }],
    ['lastError undefined removes the property', { lastError: undefined }],
    ['failedAt undefined removes the property', { failedAt: undefined }],
    ['valid type patch', { type: 'delete' }],
    ['valid timestamp patch', { timestamp: 999 }],
    ['valid retry count patch', { retryCount: 4 }],
    ['absent optional fields remain unchanged', { retryCount: 5 }],
  ];

  it.each(parityCases)(
    'matches Dexie patch semantics: %s',
    async (_label, patch) => {
      const operation = Object.assign(makeOperation('parity', 200), {
        data: { original: true },
        lastError: 'old error',
        failedAt: 150,
        futureField: { nested: ['same', 1] },
      });
      await repository.add(operation);
      await dexieRepository.add(operation);

      await repository.update(operation.id, patch);
      await dexieRepository.update(operation.id, patch);

      expect(await repository.get(operation.id)).toEqual(
        await dexieRepository.get(operation.id)
      );
    }
  );
});
