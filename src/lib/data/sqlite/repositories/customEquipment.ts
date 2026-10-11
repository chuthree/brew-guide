import type { CustomEquipmentRepository } from '@/lib/data/contracts';
import type { CustomEquipment } from '@/lib/core/config';
import { decodeCustomEquipment, encodeCustomEquipment } from '../codecs';
import type { CustomEquipmentRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import { countTable, placeholders, queryOptionalRow } from './sqlHelpers';

async function listCustomEquipment(
  executor: SqliteExecutor
): Promise<CustomEquipment[]> {
  const rows = await executor.query(
    'SELECT id, record_json FROM custom_equipments ORDER BY id ASC'
  );
  return rows.map(row =>
    decodeCustomEquipment(row as unknown as CustomEquipmentRow)
  );
}

async function getCustomEquipment(
  executor: SqliteExecutor,
  id: string
): Promise<CustomEquipment | undefined> {
  const row = await queryOptionalRow(
    executor,
    'SELECT id, record_json FROM custom_equipments WHERE id = ?',
    [id]
  );
  return row
    ? decodeCustomEquipment(row as unknown as CustomEquipmentRow)
    : undefined;
}

async function saveCustomEquipment(
  executor: SqliteExecutor,
  equipment: CustomEquipment
): Promise<void> {
  const row = encodeCustomEquipment(equipment);
  await executor.execute(
    `INSERT INTO custom_equipments (id, record_json)
     VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json`,
    [row.id, row.record_json]
  );
}

async function upsertCustomEquipment(
  executor: SqliteExecutor,
  equipments: CustomEquipment[]
): Promise<void> {
  for (const equipment of equipments) {
    await saveCustomEquipment(executor, equipment);
  }
}

async function clearCustomEquipment(executor: SqliteExecutor): Promise<void> {
  await executor.execute('DELETE FROM custom_equipments');
}

async function deleteCustomEquipment(
  executor: SqliteExecutor,
  id: string
): Promise<void> {
  await executor.execute('DELETE FROM custom_equipments WHERE id = ?', [id]);
}

async function deleteManyCustomEquipment(
  executor: SqliteExecutor,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  await executor.execute(
    `DELETE FROM custom_equipments WHERE id IN (${placeholders(ids.length)})`,
    ids
  );
}

export function createSqliteCustomEquipmentRepository(
  driver: SqliteDriver
): CustomEquipmentRepository {
  return {
    list: () => listCustomEquipment(driver),
    get: id => getCustomEquipment(driver, id),
    count: () => countTable(driver, 'custom_equipments'),
    save: equipment => saveCustomEquipment(driver, equipment),
    upsertMany: equipments => upsertCustomEquipment(driver, equipments),
    delete: id => deleteCustomEquipment(driver, id),
    deleteMany: ids => deleteManyCustomEquipment(driver, ids),
    async replaceAll(equipments) {
      await clearCustomEquipment(driver);
      await upsertCustomEquipment(driver, equipments);
    },
    clear: () => clearCustomEquipment(driver),
  };
}
