import type {
  CustomMethodRecord,
  CustomMethodRepository,
} from '@/lib/data/contracts';
import { decodeCustomMethods, encodeCustomMethods } from '../codecs';
import type { CustomMethodsRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import { countTable, placeholders, queryOptionalRow } from './sqlHelpers';

async function listCustomMethods(
  executor: SqliteExecutor
): Promise<CustomMethodRecord[]> {
  const rows = await executor.query(
    `SELECT equipment_id, methods_json, extra_json
     FROM custom_methods
     ORDER BY equipment_id ASC`
  );
  return rows.map(row =>
    decodeCustomMethods(row as unknown as CustomMethodsRow)
  );
}

async function getCustomMethods(
  executor: SqliteExecutor,
  equipmentId: string
): Promise<CustomMethodRecord | undefined> {
  const row = await queryOptionalRow(
    executor,
    `SELECT equipment_id, methods_json, extra_json
     FROM custom_methods
     WHERE equipment_id = ?`,
    [equipmentId]
  );
  return row
    ? decodeCustomMethods(row as unknown as CustomMethodsRow)
    : undefined;
}

async function saveCustomMethods(
  executor: SqliteExecutor,
  record: CustomMethodRecord
): Promise<void> {
  const row = encodeCustomMethods(record);
  await executor.execute(
    `INSERT INTO custom_methods (equipment_id, methods_json, extra_json)
     VALUES (?, ?, ?)
     ON CONFLICT(equipment_id) DO UPDATE SET
       methods_json = excluded.methods_json,
       extra_json = excluded.extra_json`,
    [row.equipment_id, row.methods_json, row.extra_json]
  );
}

async function upsertCustomMethods(
  executor: SqliteExecutor,
  records: CustomMethodRecord[]
): Promise<void> {
  for (const record of records) {
    await saveCustomMethods(executor, record);
  }
}

async function deleteCustomMethods(
  executor: SqliteExecutor,
  equipmentId: string
): Promise<void> {
  await executor.execute('DELETE FROM custom_methods WHERE equipment_id = ?', [
    equipmentId,
  ]);
}

async function deleteManyCustomMethods(
  executor: SqliteExecutor,
  equipmentIds: string[]
): Promise<void> {
  if (equipmentIds.length === 0) return;
  await executor.execute(
    `DELETE FROM custom_methods WHERE equipment_id IN (${placeholders(equipmentIds.length)})`,
    equipmentIds
  );
}

async function clearCustomMethods(executor: SqliteExecutor): Promise<void> {
  await executor.execute('DELETE FROM custom_methods');
}

export function createSqliteCustomMethodRepository(
  driver: SqliteDriver
): CustomMethodRepository {
  return {
    list: () => listCustomMethods(driver),
    get: equipmentId => getCustomMethods(driver, equipmentId),
    count: () => countTable(driver, 'custom_methods'),
    save: record => saveCustomMethods(driver, record),
    upsertMany: records => upsertCustomMethods(driver, records),
    delete: equipmentId => deleteCustomMethods(driver, equipmentId),
    deleteMany: equipmentIds => deleteManyCustomMethods(driver, equipmentIds),
    clear: () => clearCustomMethods(driver),
  };
}
