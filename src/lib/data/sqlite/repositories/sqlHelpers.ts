import type { SqliteExecutor, SqlValue } from '../driver';

export async function queryOptionalRow(
  executor: SqliteExecutor,
  sql: string,
  params: readonly SqlValue[] = []
) {
  const rows = await executor.query(sql, params);
  if (rows.length > 1) {
    throw new Error(`Expected at most one SQLite row, received ${rows.length}`);
  }
  return rows[0];
}

export async function countTable(
  executor: SqliteExecutor,
  tableName: string
): Promise<number> {
  const rows = await executor.query(
    `SELECT COUNT(*) AS count FROM ${tableName}`
  );
  if (rows.length !== 1) {
    throw new Error(
      `Expected one SQLite COUNT row for ${tableName}, received ${rows.length}`
    );
  }

  const count = rows[0]?.count;
  if (
    typeof count !== 'number' ||
    !Number.isFinite(count) ||
    !Number.isSafeInteger(count) ||
    count < 0
  ) {
    throw new Error(
      `Invalid SQLite row count for ${tableName}: ${String(count)}`
    );
  }
  return count;
}

export function placeholders(count: number): string {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error(`SQLite placeholder count must be positive: ${count}`);
  }
  return Array.from({ length: count }, () => '?').join(', ');
}
