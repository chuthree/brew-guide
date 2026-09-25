import type {
  OfflineQueueRepository,
  PendingOperationUpdate,
} from '@/lib/data/contracts';
import type { StoredPendingOperation } from '@/lib/data/models';
import { assertValidPendingOperationUpdate } from '@/lib/data/pendingOperationUpdate';
import type { PendingOperation } from '@/lib/supabase/realtime/types';
import { decodePendingOperation, encodePendingOperation } from '../codecs';
import type { PendingOperationRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import { countTable, queryOptionalRow } from './sqlHelpers';

const SELECT_PENDING_OPERATIONS = `
  SELECT
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
  FROM pending_operations`;

const PATCH_FIELDS = [
  'type',
  'data',
  'timestamp',
  'retryCount',
  'lastError',
  'failedAt',
] as const;

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function decodePendingRow(
  row: Readonly<Record<string, unknown>>
): StoredPendingOperation {
  return decodePendingOperation(row as unknown as PendingOperationRow);
}

async function findPendingOperationsByTarget(
  executor: SqliteExecutor,
  table: PendingOperation['table'],
  recordId: string
): Promise<StoredPendingOperation[]> {
  const rows = await executor.query(
    `${SELECT_PENDING_OPERATIONS}
     WHERE table_name = ?
       AND record_id = ?
     ORDER BY id ASC`,
    [table, recordId]
  );
  return rows.map(decodePendingRow);
}

async function getStoredOperation(
  executor: SqliteExecutor,
  id: string
): Promise<StoredPendingOperation | undefined> {
  const row = await queryOptionalRow(
    executor,
    `${SELECT_PENDING_OPERATIONS}
     WHERE id = ?`,
    [id]
  );
  return row ? decodePendingRow(row) : undefined;
}

async function listStoredOperations(
  executor: SqliteExecutor
): Promise<StoredPendingOperation[]> {
  const rows = await executor.query(
    `${SELECT_PENDING_OPERATIONS}
     ORDER BY timestamp_ms ASC, id ASC`
  );
  return rows.map(decodePendingRow);
}

async function insertOperation(
  executor: SqliteExecutor,
  operation: PendingOperation
): Promise<void> {
  const row = encodePendingOperation(operation);
  await executor.execute(
    `INSERT INTO pending_operations (
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
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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
    ]
  );
}

function applyPendingOperationUpdate(
  current: StoredPendingOperation,
  changes: PendingOperationUpdate
): StoredPendingOperation {
  const next: Record<string, unknown> = { ...current };
  const patch = changes as unknown as Record<string, unknown>;

  for (const field of PATCH_FIELDS) {
    if (!hasOwn(patch, field)) continue;

    const value = patch[field];
    if (value === undefined) {
      if (field === 'data' || field === 'lastError' || field === 'failedAt') {
        delete next[field];
        continue;
      }
      throw new TypeError(
        `Invalid pending operation update at ${field}: required field cannot be removed`
      );
    }

    next[field] = value;
  }

  return next as unknown as StoredPendingOperation;
}

async function updateStoredOperation(
  executor: SqliteExecutor,
  id: string,
  changes: PendingOperationUpdate
): Promise<void> {
  const current = await getStoredOperation(executor, id);
  if (!current) return;

  const updated = applyPendingOperationUpdate(current, changes);
  const row = encodePendingOperation(updated);
  await executor.execute(
    `UPDATE pending_operations
     SET
       table_name = ?,
       operation_type = ?,
       record_id = ?,
       timestamp_ms = ?,
       retry_count = ?,
       last_error = ?,
       failed_at_ms = ?,
       data_json = ?,
       extra_json = ?
     WHERE id = ?`,
    [
      row.table_name,
      row.operation_type,
      row.record_id,
      row.timestamp_ms,
      row.retry_count,
      row.last_error,
      row.failed_at_ms,
      row.data_json,
      row.extra_json,
      id,
    ]
  );
}

async function deleteStoredOperation(
  executor: SqliteExecutor,
  id: string
): Promise<void> {
  await executor.execute('DELETE FROM pending_operations WHERE id = ?', [id]);
}

async function clearStoredOperations(executor: SqliteExecutor): Promise<void> {
  await executor.execute('DELETE FROM pending_operations');
}

export function createSqliteOfflineQueueRepository(
  driver: SqliteDriver
): OfflineQueueRepository {
  return {
    findByTarget: (table, recordId) =>
      findPendingOperationsByTarget(driver, table, recordId),
    add: operation => insertOperation(driver, operation),
    async update(id, changes) {
      assertValidPendingOperationUpdate(changes);
      if (Reflect.ownKeys(changes).length === 0) return;

      await driver.transaction(tx => updateStoredOperation(tx, id, changes));
    },
    get: id => getStoredOperation(driver, id),
    listOrdered: () => listStoredOperations(driver),
    count: () => countTable(driver, 'pending_operations'),
    delete: id => deleteStoredOperation(driver, id),
    clear: () => clearStoredOperations(driver),
  };
}
