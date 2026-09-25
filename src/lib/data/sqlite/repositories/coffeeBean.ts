import type { CoffeeBeanRepository } from '@/lib/data/contracts';
import type { CoffeeBean } from '@/types/app';
import { decodeCoffeeBean, encodeCoffeeBean } from '../codecs';
import type { CoffeeBeanRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import { countTable, placeholders, queryOptionalRow } from './sqlHelpers';
import { assertNoInlineImageFields } from './subjectRepositoryGuards';

const COFFEE_BEAN_IMAGE_FIELDS = ['image', 'backImage'] as const;

/** Executor-scoped operations can be composed inside a storage transaction. */
export async function listCoffeeBeans(
  executor: SqliteExecutor
): Promise<CoffeeBean[]> {
  const rows = await executor.query(
    `SELECT id, timestamp_ms, record_json
     FROM coffee_beans
     ORDER BY id ASC`
  );
  return rows.map(row => decodeCoffeeBean(row as unknown as CoffeeBeanRow));
}

export async function getCoffeeBean(
  executor: SqliteExecutor,
  id: string
): Promise<CoffeeBean | undefined> {
  const row = await queryOptionalRow(
    executor,
    `SELECT id, timestamp_ms, record_json
     FROM coffee_beans
     WHERE id = ?`,
    [id]
  );
  return row ? decodeCoffeeBean(row as unknown as CoffeeBeanRow) : undefined;
}

export async function countCoffeeBeans(
  executor: SqliteExecutor
): Promise<number> {
  return countTable(executor, 'coffee_beans');
}

export async function saveCoffeeBean(
  executor: SqliteExecutor,
  bean: CoffeeBean
): Promise<void> {
  assertNoInlineImageFields(
    'CoffeeBeanRepository',
    bean,
    COFFEE_BEAN_IMAGE_FIELDS
  );
  const encoded = encodeCoffeeBean(bean);
  if (encoded.imageSources.length > 0) {
    throw new Error(
      'CoffeeBeanRepository cannot persist inline image descriptors; use aggregate persistence'
    );
  }

  const { row } = encoded;
  await executor.execute(
    `INSERT INTO coffee_beans (id, timestamp_ms, record_json)
     VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       timestamp_ms = excluded.timestamp_ms,
       record_json = excluded.record_json`,
    [row.id, row.timestamp_ms, row.record_json]
  );
}

export async function upsertManyCoffeeBeans(
  executor: SqliteExecutor,
  beans: CoffeeBean[]
): Promise<void> {
  for (const bean of beans) {
    await saveCoffeeBean(executor, bean);
  }
}

export async function deleteCoffeeBean(
  executor: SqliteExecutor,
  id: string
): Promise<void> {
  await executor.execute('DELETE FROM coffee_beans WHERE id = ?', [id]);
}

export async function deleteManyCoffeeBeans(
  executor: SqliteExecutor,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  await executor.execute(
    `DELETE FROM coffee_beans WHERE id IN (${placeholders(ids.length)})`,
    ids
  );
}

export async function clearCoffeeBeans(
  executor: SqliteExecutor
): Promise<void> {
  await executor.execute('DELETE FROM coffee_beans');
}

export function createSqliteCoffeeBeanRepository(
  driver: SqliteDriver
): CoffeeBeanRepository {
  return {
    list: () => listCoffeeBeans(driver),
    get: id => getCoffeeBean(driver, id),
    count: () => countCoffeeBeans(driver),
    save: bean => saveCoffeeBean(driver, bean),
    upsertMany: beans => upsertManyCoffeeBeans(driver, beans),
    delete: id => deleteCoffeeBean(driver, id),
    deleteMany: ids => deleteManyCoffeeBeans(driver, ids),
    clear: () => clearCoffeeBeans(driver),
  };
}
