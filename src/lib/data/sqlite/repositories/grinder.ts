import type { GrinderRepository } from '@/lib/data/contracts';
import type { Grinder } from '@/lib/data/models';
import { decodeGrinder, encodeGrinder } from '../codecs';
import type { GrinderRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import { countTable } from './sqlHelpers';

async function listGrinders(executor: SqliteExecutor): Promise<Grinder[]> {
  const rows = await executor.query(
    'SELECT id, record_json FROM grinders ORDER BY id ASC'
  );
  return rows.map(row => decodeGrinder(row as unknown as GrinderRow));
}

async function saveGrinder(
  executor: SqliteExecutor,
  grinder: Grinder
): Promise<void> {
  const row = encodeGrinder(grinder);
  await executor.execute(
    `INSERT INTO grinders (id, record_json)
     VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json`,
    [row.id, row.record_json]
  );
}

async function upsertGrinders(
  executor: SqliteExecutor,
  grinders: Grinder[]
): Promise<void> {
  for (const grinder of grinders) {
    await saveGrinder(executor, grinder);
  }
}

async function clearGrinders(executor: SqliteExecutor): Promise<void> {
  await executor.execute('DELETE FROM grinders');
}

async function deleteGrinder(
  executor: SqliteExecutor,
  id: string
): Promise<void> {
  await executor.execute('DELETE FROM grinders WHERE id = ?', [id]);
}

export function createSqliteGrinderRepository(
  driver: SqliteDriver
): GrinderRepository {
  return {
    list: () => listGrinders(driver),
    count: () => countTable(driver, 'grinders'),
    save: grinder => saveGrinder(driver, grinder),
    upsertMany: grinders => upsertGrinders(driver, grinders),
    delete: id => deleteGrinder(driver, id),
    async replaceAll(grinders) {
      await clearGrinders(driver);
      await upsertGrinders(driver, grinders);
    },
    clear: () => clearGrinders(driver),
  };
}
