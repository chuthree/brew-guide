import {
  decodeBrewingNoteImageMetadata,
  decodeCoffeeBeanImageMetadata,
  encodeBrewingNoteImageMetadata,
  encodeCoffeeBeanImageMetadata,
} from './imageMetadata';
import type {
  BrewingNoteImageMetadata,
  CoffeeBeanImageMetadata,
} from './imageMetadata';
import type {
  BrewingNoteImageMetadataRow,
  CoffeeBeanImageMetadataRow,
} from './schemaV1';
import type { SqliteExecutor, SqlRow, SqlValue } from './driver';

const BEAN_COLUMNS =
  'image_id, bean_id, slot, variant, source_kind, relative_path, mime_type, size_bytes, sha256, external_url, updated_at_ms';
const NOTE_COLUMNS =
  'image_id, note_id, position, variant, source_kind, relative_path, mime_type, size_bytes, sha256, external_url, updated_at_ms';

const BEAN_LIST_ORDER =
  " ORDER BY CASE slot WHEN 'front' THEN 0 WHEN 'back' THEN 1 ELSE 2 END ASC, CASE variant WHEN 'original' THEN 0 WHEN 'thumbnail' THEN 1 ELSE 2 END ASC, image_id ASC";
const NOTE_LIST_ORDER =
  " ORDER BY position ASC, CASE variant WHEN 'original' THEN 0 WHEN 'thumbnail' THEN 1 ELSE 2 END ASC, image_id ASC";
const OWNER_QUERY_BATCH_SIZE = 400;

const BEAN_INSERT_SQL =
  'INSERT INTO coffee_bean_images (' +
  BEAN_COLUMNS +
  ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const NOTE_INSERT_SQL =
  'INSERT INTO brewing_note_images (' +
  NOTE_COLUMNS +
  ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

function beanRow(row: SqlRow): CoffeeBeanImageMetadata {
  return decodeCoffeeBeanImageMetadata(
    row as unknown as CoffeeBeanImageMetadataRow
  );
}

function noteRow(row: SqlRow): BrewingNoteImageMetadata {
  return decodeBrewingNoteImageMetadata(
    row as unknown as BrewingNoteImageMetadataRow
  );
}

function beanValues(row: CoffeeBeanImageMetadataRow): readonly SqlValue[] {
  return [
    row.image_id,
    row.bean_id,
    row.slot,
    row.variant,
    row.source_kind,
    row.relative_path,
    row.mime_type,
    row.size_bytes,
    row.sha256,
    row.external_url,
    row.updated_at_ms,
  ];
}

function noteValues(row: BrewingNoteImageMetadataRow): readonly SqlValue[] {
  return [
    row.image_id,
    row.note_id,
    row.position,
    row.variant,
    row.source_kind,
    row.relative_path,
    row.mime_type,
    row.size_bytes,
    row.sha256,
    row.external_url,
    row.updated_at_ms,
  ];
}

function assertUniqueImageIds(
  rows: readonly { image_id: string }[],
  table: string
): void {
  const imageIds = new Set<string>();
  for (const row of rows) {
    if (imageIds.has(row.image_id)) {
      throw new Error(
        'Duplicate image_id in desired ' + table + ' metadata: ' + row.image_id
      );
    }
    imageIds.add(row.image_id);
  }
}

export async function getCoffeeBeanImageMetadata(
  executor: SqliteExecutor,
  beanId: string,
  slot: CoffeeBeanImageMetadata['slot'],
  variant: CoffeeBeanImageMetadata['variant']
): Promise<CoffeeBeanImageMetadata | undefined> {
  const rows = await executor.query(
    'SELECT ' +
      BEAN_COLUMNS +
      ' FROM coffee_bean_images WHERE bean_id = ? AND slot = ? AND variant = ?',
    [beanId, slot, variant]
  );
  if (rows.length > 1) {
    throw new Error(
      'Coffee bean image metadata identity returned multiple rows for ' +
        beanId +
        '/' +
        slot +
        '/' +
        variant
    );
  }
  return rows.length === 0 ? undefined : beanRow(rows[0]);
}

export async function listCoffeeBeanImageMetadata(
  executor: SqliteExecutor,
  beanId: string
): Promise<CoffeeBeanImageMetadata[]> {
  const rows = await executor.query(
    'SELECT ' +
      BEAN_COLUMNS +
      ' FROM coffee_bean_images WHERE bean_id = ?' +
      BEAN_LIST_ORDER,
    [beanId]
  );
  return rows.map(beanRow);
}

/** Read all bean image metadata in one query, or bounded owner batches. */
export async function listCoffeeBeanImageMetadataForOwners(
  executor: SqliteExecutor,
  beanIds?: readonly string[]
): Promise<CoffeeBeanImageMetadata[]> {
  if (beanIds === undefined) {
    const rows = await executor.query(
      'SELECT ' +
        BEAN_COLUMNS +
        ' FROM coffee_bean_images ORDER BY bean_id ASC,' +
        BEAN_LIST_ORDER.slice(' ORDER BY'.length)
    );
    return rows.map(beanRow);
  }

  const ownerIds = Array.from(new Set(beanIds.filter(Boolean)));
  const records: CoffeeBeanImageMetadata[] = [];
  for (
    let offset = 0;
    offset < ownerIds.length;
    offset += OWNER_QUERY_BATCH_SIZE
  ) {
    const batch = ownerIds.slice(offset, offset + OWNER_QUERY_BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(', ');
    const rows = await executor.query(
      'SELECT ' +
        BEAN_COLUMNS +
        ` FROM coffee_bean_images WHERE bean_id IN (${placeholders})` +
        ' ORDER BY bean_id ASC,' +
        BEAN_LIST_ORDER.slice(' ORDER BY'.length),
      batch
    );
    records.push(...rows.map(beanRow));
  }
  return records;
}

export async function replaceCoffeeBeanImageMetadata(
  executor: SqliteExecutor,
  beanId: string,
  metadata: readonly CoffeeBeanImageMetadata[]
): Promise<void> {
  const rows = metadata.map(encodeCoffeeBeanImageMetadata);

  for (const row of rows) {
    if (row.bean_id !== beanId) {
      throw new Error(
        'Coffee bean image metadata owner mismatch: expected ' +
          beanId +
          ', received ' +
          row.bean_id
      );
    }
  }

  assertUniqueImageIds(rows, 'coffee bean');
  const logicalKeys = new Set<string>();
  for (const row of rows) {
    const logicalKey = JSON.stringify([row.slot, row.variant]);
    if (logicalKeys.has(logicalKey)) {
      throw new Error(
        'Duplicate coffee bean image slot and variant in desired metadata: ' +
          logicalKey
      );
    }
    logicalKeys.add(logicalKey);
  }

  await executor.execute('DELETE FROM coffee_bean_images WHERE bean_id = ?', [
    beanId,
  ]);
  for (const row of rows) {
    await executor.execute(BEAN_INSERT_SQL, beanValues(row));
  }
}

export async function getBrewingNoteImageMetadata(
  executor: SqliteExecutor,
  noteId: string,
  position: number,
  variant: BrewingNoteImageMetadata['variant']
): Promise<BrewingNoteImageMetadata | undefined> {
  const rows = await executor.query(
    'SELECT ' +
      NOTE_COLUMNS +
      ' FROM brewing_note_images WHERE note_id = ? AND position = ? AND variant = ?',
    [noteId, position, variant]
  );
  if (rows.length > 1) {
    throw new Error(
      'Brewing note image metadata identity returned multiple rows for ' +
        noteId +
        '/' +
        position +
        '/' +
        variant
    );
  }
  return rows.length === 0 ? undefined : noteRow(rows[0]);
}

export async function listBrewingNoteImageMetadata(
  executor: SqliteExecutor,
  noteId: string
): Promise<BrewingNoteImageMetadata[]> {
  const rows = await executor.query(
    'SELECT ' +
      NOTE_COLUMNS +
      ' FROM brewing_note_images WHERE note_id = ?' +
      NOTE_LIST_ORDER,
    [noteId]
  );
  return rows.map(noteRow);
}

/** Read all note image metadata in one query, or bounded owner batches. */
export async function listBrewingNoteImageMetadataForOwners(
  executor: SqliteExecutor,
  noteIds?: readonly string[]
): Promise<BrewingNoteImageMetadata[]> {
  if (noteIds === undefined) {
    const rows = await executor.query(
      'SELECT ' +
        NOTE_COLUMNS +
        ' FROM brewing_note_images ORDER BY note_id ASC,' +
        NOTE_LIST_ORDER.slice(' ORDER BY'.length)
    );
    return rows.map(noteRow);
  }

  const ownerIds = Array.from(new Set(noteIds.filter(Boolean)));
  const records: BrewingNoteImageMetadata[] = [];
  for (
    let offset = 0;
    offset < ownerIds.length;
    offset += OWNER_QUERY_BATCH_SIZE
  ) {
    const batch = ownerIds.slice(offset, offset + OWNER_QUERY_BATCH_SIZE);
    const placeholders = batch.map(() => '?').join(', ');
    const rows = await executor.query(
      'SELECT ' +
        NOTE_COLUMNS +
        ` FROM brewing_note_images WHERE note_id IN (${placeholders})` +
        ' ORDER BY note_id ASC,' +
        NOTE_LIST_ORDER.slice(' ORDER BY'.length),
      batch
    );
    records.push(...rows.map(noteRow));
  }
  return records;
}

export async function replaceBrewingNoteImageMetadata(
  executor: SqliteExecutor,
  noteId: string,
  metadata: readonly BrewingNoteImageMetadata[]
): Promise<void> {
  const rows = metadata.map(encodeBrewingNoteImageMetadata);

  for (const row of rows) {
    if (row.note_id !== noteId) {
      throw new Error(
        'Brewing note image metadata owner mismatch: expected ' +
          noteId +
          ', received ' +
          row.note_id
      );
    }
  }

  assertUniqueImageIds(rows, 'brewing note');
  const logicalKeys = new Set<string>();
  for (const row of rows) {
    const logicalKey = JSON.stringify([row.position, row.variant]);
    if (logicalKeys.has(logicalKey)) {
      throw new Error(
        'Duplicate brewing note image position and variant in desired metadata: ' +
          logicalKey
      );
    }
    logicalKeys.add(logicalKey);
  }

  await executor.execute('DELETE FROM brewing_note_images WHERE note_id = ?', [
    noteId,
  ]);
  for (const row of rows) {
    await executor.execute(NOTE_INSERT_SQL, noteValues(row));
  }
}
