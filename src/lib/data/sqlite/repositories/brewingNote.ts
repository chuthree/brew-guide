import type { BrewingNoteRepository } from '@/lib/data/contracts';
import type { BrewingNote } from '@/lib/core/config';
import { decodeBrewingNote, encodeBrewingNote } from '../codecs';
import type { BrewingNoteRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import { countTable, placeholders, queryOptionalRow } from './sqlHelpers';
import { assertNoInlineImageFields } from './subjectRepositoryGuards';

const BREWING_NOTE_IMAGE_FIELDS = ['image', 'images'] as const;
const BREWING_NOTE_COLUMNS = `id, timestamp_ms, updated_at_ms, bean_id, record_json`;

/** Executor-scoped operations can be composed inside a storage transaction. */
export async function listBrewingNotes(
  executor: SqliteExecutor
): Promise<BrewingNote[]> {
  const rows = await executor.query(
    `SELECT ${BREWING_NOTE_COLUMNS}
     FROM brewing_notes
     ORDER BY id ASC`
  );
  return rows.map(row => decodeBrewingNote(row as unknown as BrewingNoteRow));
}

export async function listBrewingNotesByBeanId(
  executor: SqliteExecutor,
  beanId: string
): Promise<BrewingNote[]> {
  const rows = await executor.query(
    `SELECT ${BREWING_NOTE_COLUMNS}
     FROM brewing_notes
     WHERE bean_id = ?
     ORDER BY timestamp_ms DESC, id DESC`,
    [beanId]
  );
  return rows.map(row => decodeBrewingNote(row as unknown as BrewingNoteRow));
}

export async function getBrewingNote(
  executor: SqliteExecutor,
  id: string
): Promise<BrewingNote | undefined> {
  const row = await queryOptionalRow(
    executor,
    `SELECT ${BREWING_NOTE_COLUMNS}
     FROM brewing_notes
     WHERE id = ?`,
    [id]
  );
  return row ? decodeBrewingNote(row as unknown as BrewingNoteRow) : undefined;
}

export async function countBrewingNotes(
  executor: SqliteExecutor
): Promise<number> {
  return countTable(executor, 'brewing_notes');
}

export async function saveBrewingNote(
  executor: SqliteExecutor,
  note: BrewingNote
): Promise<void> {
  assertNoInlineImageFields(
    'BrewingNoteRepository',
    note,
    BREWING_NOTE_IMAGE_FIELDS
  );
  const encoded = encodeBrewingNote(note);
  if (encoded.imageSources.length > 0) {
    throw new Error(
      'BrewingNoteRepository cannot persist inline image descriptors; use aggregate persistence'
    );
  }

  const { row } = encoded;
  await executor.execute(
    `INSERT INTO brewing_notes (
       id, timestamp_ms, updated_at_ms, bean_id, record_json
     )
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       timestamp_ms = excluded.timestamp_ms,
       updated_at_ms = excluded.updated_at_ms,
       bean_id = excluded.bean_id,
       record_json = excluded.record_json`,
    [row.id, row.timestamp_ms, row.updated_at_ms, row.bean_id, row.record_json]
  );
}

export async function upsertManyBrewingNotes(
  executor: SqliteExecutor,
  notes: BrewingNote[]
): Promise<void> {
  for (const note of notes) {
    await saveBrewingNote(executor, note);
  }
}

export async function deleteBrewingNote(
  executor: SqliteExecutor,
  id: string
): Promise<void> {
  await executor.execute('DELETE FROM brewing_notes WHERE id = ?', [id]);
}

export async function deleteManyBrewingNotes(
  executor: SqliteExecutor,
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  await executor.execute(
    `DELETE FROM brewing_notes WHERE id IN (${placeholders(ids.length)})`,
    ids
  );
}

export async function clearBrewingNotes(
  executor: SqliteExecutor
): Promise<void> {
  await executor.execute('DELETE FROM brewing_notes');
}

export function createSqliteBrewingNoteRepository(
  driver: SqliteDriver
): BrewingNoteRepository {
  return {
    list: () => listBrewingNotes(driver),
    listByBeanId: beanId => listBrewingNotesByBeanId(driver, beanId),
    get: id => getBrewingNote(driver, id),
    count: () => countBrewingNotes(driver),
    save: note => saveBrewingNote(driver, note),
    upsertMany: notes => upsertManyBrewingNotes(driver, notes),
    delete: id => deleteBrewingNote(driver, id),
    deleteMany: ids => deleteManyBrewingNotes(driver, ids),
    clear: () => clearBrewingNotes(driver),
  };
}
