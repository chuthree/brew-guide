import type { SqliteExecutor, SqlValue } from '../driver';

export const SQLITE_TEXT_CHUNK_SIZE = 256 * 1024;

/** Read a single TEXT column aliased as value, within the caller's transaction. */
export async function readChunkedText(
  executor: SqliteExecutor,
  sourceSql: string,
  params: readonly SqlValue[]
): Promise<string | undefined> {
  // SQLite substr offsets count codepoints; each result fits Android's CursorWindow.
  const first = await queryOptionalRow(
    executor,
    `SELECT substr(value, 1, ${SQLITE_TEXT_CHUNK_SIZE}) AS value,
            length(value) AS total, instr(value, char(0)) AS nul_position
     FROM (${sourceSql})`,
    params
  );
  if (!first) return undefined;
  if (
    first.nul_position !== 0 ||
    typeof first.total !== 'number' ||
    typeof first.value !== 'string'
  )
    throw new Error('Invalid SQLite chunked text');
  const chunks = [first.value];
  for (
    let position = SQLITE_TEXT_CHUNK_SIZE + 1;
    position <= first.total;
    position += SQLITE_TEXT_CHUNK_SIZE
  ) {
    const row = await queryOptionalRow(
      executor,
      `SELECT substr(value, ${position}, ${SQLITE_TEXT_CHUNK_SIZE}) AS value FROM (${sourceSql})`,
      params
    );
    if (!row || typeof row.value !== 'string')
      throw new Error('SQLite text disappeared during read');
    chunks.push(row.value);
  }
  return chunks.join('');
}

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
