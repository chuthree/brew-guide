import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import {
  parseImageRelativePath,
  toImageRelativePath,
} from '@/lib/data/images/nativeImageFileStore';
import type { SqlRow, SqlValue, SqliteDriver, SqliteExecutor } from './driver';
import { decodeImageDataUrl } from '@/lib/data/images/imageBinary';
import {
  planLegacySqliteMigration,
  type LegacyMigrationSource,
  type LegacyMigrationImageFile,
  type LegacySqliteMigrationPlan,
} from './legacyMigrationPlan';
import { hasLegacyMigrationSourceData } from './legacyMigrationSource';

export const LEGACY_DEXIE_MIGRATION_ID = 'legacy-dexie-import-v1';

export type LegacySqliteMigrationResult =
  | { status: 'migrated'; sourceVersion: number | null }
  | { status: 'fresh-install' }
  | { status: 'already-completed' };

export interface LegacySqliteMigrationOptions {
  driver: SqliteDriver;
  imageFileStore: NativeImageFileStore;
  loadSource: () => Promise<LegacyMigrationSource>;
  beforeMigration?: (
    source: LegacyMigrationSource,
    plan: LegacySqliteMigrationPlan,
    planSha256: string
  ) => Promise<void>;
}

interface MigrationState {
  status: 'in_progress' | 'completed' | 'failed';
  sourcePresenceJson: string;
  detailsJson: string;
}

interface TargetTableSpec {
  table: string;
  keyColumn: string;
  columns: readonly string[];
  rows: readonly object[];
}

interface TargetTableLayout {
  table: string;
  keyColumn: string;
  columns: readonly string[];
  rowsKey: keyof LegacySqliteMigrationPlan['rows'];
}

type TargetSnapshot = Map<string, SqlRow[]>;

const inFlightByDriver = new WeakMap<
  SqliteDriver,
  Promise<LegacySqliteMigrationResult>
>();

const TARGET_TABLE_LAYOUTS: readonly TargetTableLayout[] = [
  {
    table: 'coffee_beans',
    keyColumn: 'id',
    columns: ['id', 'timestamp_ms', 'record_json'],
    rowsKey: 'coffeeBeans',
  },
  {
    table: 'brewing_notes',
    keyColumn: 'id',
    columns: ['id', 'timestamp_ms', 'updated_at_ms', 'bean_id', 'record_json'],
    rowsKey: 'brewingNotes',
  },
  {
    table: 'custom_equipments',
    keyColumn: 'id',
    columns: ['id', 'record_json'],
    rowsKey: 'customEquipments',
  },
  {
    table: 'custom_methods',
    keyColumn: 'equipment_id',
    columns: ['equipment_id', 'methods_json', 'extra_json'],
    rowsKey: 'customMethods',
  },
  {
    table: 'grinders',
    keyColumn: 'id',
    columns: ['id', 'record_json'],
    rowsKey: 'grinders',
  },
  {
    table: 'app_settings',
    keyColumn: 'id',
    columns: ['id', 'data_json'],
    rowsKey: 'appSettings',
  },
  {
    table: 'legacy_settings',
    keyColumn: 'key',
    columns: ['key', 'value'],
    rowsKey: 'legacySettings',
  },
  {
    table: 'pending_operations',
    keyColumn: 'id',
    columns: [
      'id',
      'table_name',
      'operation_type',
      'record_id',
      'timestamp_ms',
      'retry_count',
      'last_error',
      'failed_at_ms',
      'data_json',
      'extra_json',
    ],
    rowsKey: 'pendingOperations',
  },
  {
    table: 'historical_yearly_reports',
    keyColumn: 'id',
    columns: [
      'id',
      'year',
      'username',
      'content',
      'created_at_ms',
      'extra_json',
    ],
    rowsKey: 'historicalYearlyReports',
  },
  {
    table: 'coffee_bean_images',
    keyColumn: 'image_id',
    columns: [
      'image_id',
      'bean_id',
      'slot',
      'variant',
      'source_kind',
      'relative_path',
      'mime_type',
      'size_bytes',
      'sha256',
      'external_url',
      'updated_at_ms',
    ],
    rowsKey: 'coffeeBeanImages',
  },
  {
    table: 'brewing_note_images',
    keyColumn: 'image_id',
    columns: [
      'image_id',
      'note_id',
      'position',
      'variant',
      'source_kind',
      'relative_path',
      'mime_type',
      'size_bytes',
      'sha256',
      'external_url',
      'updated_at_ms',
    ],
    rowsKey: 'brewingNoteImages',
  },
];

function tableSpecs(plan: LegacySqliteMigrationPlan): TargetTableSpec[] {
  return TARGET_TABLE_LAYOUTS.map(layout => ({
    table: layout.table,
    keyColumn: layout.keyColumn,
    columns: layout.columns,
    rows: plan.rows[layout.rowsKey],
  }));
}

function emptyTableSpecs(): TargetTableSpec[] {
  return TARGET_TABLE_LAYOUTS.map(layout => ({ ...layout, rows: [] }));
}

function rowKey(row: Record<string, unknown>, keyColumn: string): string {
  const key = row[keyColumn];
  if (typeof key !== 'string' || key.length === 0) {
    throw new Error('Legacy migration row has an invalid primary key');
  }
  return key;
}

function rowSignature(
  row: Record<string, unknown>,
  columns: readonly string[]
): string {
  return JSON.stringify(columns.map(column => row[column]));
}

function sqlValues(
  row: Record<string, unknown>,
  columns: readonly string[]
): SqlValue[] {
  return columns.map(column => {
    const value = row[column];
    if (
      value === null ||
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      return value;
    }
    throw new Error('Legacy migration row has an invalid SQL value');
  });
}

function expectedRowsByKey(
  spec: TargetTableSpec
): Map<string, Record<string, unknown>> {
  const result = new Map<string, Record<string, unknown>>();
  for (const value of spec.rows) {
    const row = value as Record<string, unknown>;
    const key = rowKey(row, spec.keyColumn);
    if (result.has(key)) {
      throw new Error(
        'Legacy migration plan has duplicate rows in ' + spec.table
      );
    }
    // Validate every row before any target write begins.
    sqlValues(row, spec.columns);
    result.set(key, row);
  }
  return result;
}

async function readTargetSnapshot(
  executor: SqliteExecutor,
  specs: readonly TargetTableSpec[]
): Promise<TargetSnapshot> {
  const snapshot = new Map<string, SqlRow[]>();
  for (const spec of specs) {
    const rows = await executor.query(
      `SELECT ${spec.columns.join(', ')} FROM ${spec.table} ORDER BY ${spec.keyColumn} ASC`
    );
    snapshot.set(spec.table, rows);
  }
  return snapshot;
}

function assertTargetRowsAreOwnedSubset(
  snapshot: TargetSnapshot,
  specs: readonly TargetTableSpec[],
  requireComplete: boolean
): void {
  for (const spec of specs) {
    const expected = expectedRowsByKey(spec);
    const actualRows = snapshot.get(spec.table);
    if (!actualRows) throw new Error('Migration target snapshot is incomplete');
    for (const actual of actualRows) {
      const key = actual[spec.keyColumn];
      if (typeof key !== 'string') {
        throw new Error('Migration target contains an invalid row key');
      }
      const desired = expected.get(key);
      if (!desired) {
        throw new Error(
          'SQLite migration target contains an unowned row in ' + spec.table
        );
      }
      if (
        rowSignature(actual, spec.columns) !==
        rowSignature(desired, spec.columns)
      ) {
        throw new Error(
          'SQLite migration target row differs from its preflight plan in ' +
            spec.table
        );
      }
    }
    if (requireComplete && actualRows.length !== expected.size) {
      throw new Error(
        'SQLite migration target is missing expected rows in ' + spec.table
      );
    }
  }
}

function expectedCounts(
  specs: readonly TargetTableSpec[]
): Record<string, number> {
  return Object.fromEntries(specs.map(spec => [spec.table, spec.rows.length]));
}

function sourcePresenceJson(plan: LegacySqliteMigrationPlan): string {
  return JSON.stringify({
    tables: plan.sourcePresence,
    localStorage: plan.legacyLocalStoragePresence,
  });
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle || typeof TextEncoder === 'undefined') {
    throw new Error('SQLite migration requires Web Crypto SHA-256');
  }
  const digest = await subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(digest), byte =>
    byte.toString(16).padStart(2, '0')
  ).join('');
}

async function planDigest(
  plan: LegacySqliteMigrationPlan,
  specs: readonly TargetTableSpec[]
): Promise<string> {
  const files: Array<{
    objectKey: string;
    size: number;
    sha256: string;
  }> = [];
  for (const file of plan.imageFiles) {
    files.push({
      objectKey: file.objectKey,
      size: file.sizeBytes,
      sha256: file.sha256,
    });
  }
  const digestInput = JSON.stringify({
    sourceVersion: plan.sourceVersion,
    sourcePresence: sourcePresenceJson(plan),
    expectedCounts: expectedCounts(specs),
    rows: plan.rows,
    files,
  });
  return sha256Hex(new TextEncoder().encode(digestInput));
}

function imageFileMap(
  plan: LegacySqliteMigrationPlan
): Map<string, LegacyMigrationImageFile> {
  const result = new Map<string, LegacyMigrationImageFile>();
  for (const file of plan.imageFiles) {
    if (result.has(file.objectKey)) {
      throw new Error('Legacy migration plan has a duplicate image object');
    }
    if (
      typeof file.dataUrl !== 'string' ||
      typeof file.mimeType !== 'string' ||
      !Number.isSafeInteger(file.sizeBytes) ||
      file.sizeBytes < 0 ||
      !/^[0-9a-f]{64}$/.test(file.sha256)
    ) {
      throw new Error('Legacy migration plan contains invalid image source');
    }
    result.set(file.objectKey, file);
  }

  const referenced = new Set<string>();
  for (const row of [
    ...plan.rows.coffeeBeanImages,
    ...plan.rows.brewingNoteImages,
  ]) {
    if (row.source_kind !== 'file') continue;
    const objectKey = parseImageRelativePath(row.relative_path);
    const file = result.get(objectKey);
    if (
      !file ||
      file.sizeBytes !== row.size_bytes ||
      file.mimeType !== row.mime_type
    ) {
      throw new Error(
        'Legacy migration plan image metadata has no matching file payload'
      );
    }
    referenced.add(objectKey);
  }
  if (referenced.size !== result.size) {
    throw new Error(
      'Legacy migration plan contains an unreferenced image file'
    );
  }
  return result;
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

async function assertFileObjectsAreOwnedSubset(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  expected: ReadonlyMap<string, LegacyMigrationImageFile>,
  requireComplete: boolean,
  repairUnreferencedPartial: boolean
): Promise<void> {
  const existingKeys = await fileStore.listObjectKeys();
  for (const objectKey of existingKeys) {
    const expectedFile = expected.get(objectKey);
    if (!expectedFile) {
      throw new Error('Image store contains an unowned migration object');
    }
    const expectedBytes = decodeImageDataUrl(expectedFile.dataUrl).bytes;
    let matchesExpected = false;
    try {
      matchesExpected = bytesEqual(
        await fileStore.read(objectKey),
        expectedBytes
      );
    } catch (error) {
      if (!repairUnreferencedPartial) throw error;
    }
    if (!matchesExpected) {
      if (!repairUnreferencedPartial) {
        throw new Error('Existing migration image object differs from source');
      }

      const relativePath = toImageRelativePath(objectKey);
      const references = await driver.query(
        `SELECT 1 AS referenced FROM coffee_bean_images
         WHERE source_kind = 'file' AND relative_path = ?
         UNION ALL
         SELECT 1 AS referenced FROM brewing_note_images
         WHERE source_kind = 'file' AND relative_path = ?
         LIMIT 1`,
        [relativePath, relativePath]
      );
      if (references.length > 0) {
        throw new Error(
          'Migration image differs from source but is already referenced by SQLite'
        );
      }

      // The migration marker proves ownership, and the read-back proves this
      // object is not referenced. It is safe to remove an interrupted partial
      // file before retrying its write.
      await fileStore.delete(objectKey);
      if (await fileStore.exists(objectKey)) {
        throw new Error('Partial migration image could not be removed safely');
      }
      continue;
    }
  }
  if (requireComplete && existingKeys.length !== expected.size) {
    throw new Error('Migration image store is missing expected objects');
  }
}

async function writeImageFiles(
  fileStore: NativeImageFileStore,
  expected: ReadonlyMap<string, LegacyMigrationImageFile>
): Promise<void> {
  for (const [objectKey, file] of expected) {
    const decoded = decodeImageDataUrl(file.dataUrl);
    if (
      decoded.mimeType !== file.mimeType ||
      decoded.bytes.byteLength !== file.sizeBytes
    ) {
      throw new Error('Legacy migration image source changed after preflight');
    }
    const bytes = decoded.bytes;
    if (await fileStore.exists(objectKey)) {
      const existing = await fileStore.read(objectKey);
      if (!bytesEqual(existing, bytes)) {
        throw new Error('Existing migration image object differs from source');
      }
      continue;
    }

    try {
      await fileStore.write(objectKey, bytes);
    } catch (error) {
      // A filesystem write can finish before its acknowledgement is lost.
      // Reuse only if the complete object is now present and byte-identical.
      if (!(await fileStore.exists(objectKey))) throw error;
      const afterFailure = await fileStore.read(objectKey);
      if (!bytesEqual(afterFailure, bytes)) throw error;
      continue;
    }
    const written = await fileStore.read(objectKey);
    if (!bytesEqual(written, bytes)) {
      throw new Error('Migration image write failed read-back validation');
    }
  }
}

async function insertTargetRows(
  driver: SqliteDriver,
  specs: readonly TargetTableSpec[]
): Promise<void> {
  await driver.transaction(async tx => {
    for (const spec of specs) {
      const placeholders = spec.columns.map(() => '?').join(', ');
      const sql =
        `INSERT INTO ${spec.table} (${spec.columns.join(', ')}) ` +
        `VALUES (${placeholders}) ON CONFLICT(${spec.keyColumn}) DO NOTHING`;
      for (const value of spec.rows) {
        await tx.execute(
          sql,
          sqlValues(value as Record<string, unknown>, spec.columns)
        );
      }
    }
  });
}

function detailsJson(
  plan: LegacySqliteMigrationPlan,
  digest: string,
  specs: readonly TargetTableSpec[],
  fileKeys: readonly string[]
): string {
  return JSON.stringify({
    kind: 'legacy-dexie-import',
    planSha256: digest,
    sourceVersion: plan.sourceVersion,
    expectedCounts: expectedCounts(specs),
    imageObjectKeys: [...fileKeys].sort(),
  });
}

async function readMigrationState(driver: SqliteDriver): Promise<{
  state?: MigrationState;
  rowCount: number;
}> {
  const rows = await driver.query(
    'SELECT id, status, source_presence_json, details_json FROM migration_state ORDER BY id ASC'
  );
  const row = rows.find(value => value.id === LEGACY_DEXIE_MIGRATION_ID);
  if (!row) return { rowCount: rows.length };
  if (
    (row.status !== 'in_progress' &&
      row.status !== 'completed' &&
      row.status !== 'failed') ||
    typeof row.source_presence_json !== 'string' ||
    typeof row.details_json !== 'string'
  ) {
    throw new Error('Legacy SQLite migration state is malformed');
  }
  return {
    rowCount: rows.length,
    state: {
      status: row.status,
      sourcePresenceJson: row.source_presence_json,
      detailsJson: row.details_json,
    },
  };
}

function validateExistingPlanState(
  state: MigrationState,
  sourceJson: string,
  details: string
): void {
  if (
    state.sourcePresenceJson !== sourceJson ||
    state.detailsJson !== details
  ) {
    throw new Error(
      'Legacy migration retry source differs from the recorded preflight plan'
    );
  }
}

async function writeInitialState(
  driver: SqliteDriver,
  sourceJson: string,
  details: string
): Promise<void> {
  try {
    await driver.transaction(async tx => {
      await tx.execute(
        `INSERT INTO migration_state
          (id, status, source_presence_json, details_json)
         VALUES (?, 'in_progress', ?, ?)`,
        [LEGACY_DEXIE_MIGRATION_ID, sourceJson, details]
      );
    });
  } catch (error) {
    const observed = await readMigrationState(driver);
    if (
      observed.state?.status === 'in_progress' &&
      observed.state.sourcePresenceJson === sourceJson &&
      observed.state.detailsJson === details
    ) {
      return;
    }
    throw error;
  }
}

async function updateStateStatus(
  driver: SqliteDriver,
  status: 'in_progress' | 'completed' | 'failed',
  sourceJson: string,
  details: string
): Promise<void> {
  const isDurable = (state: MigrationState | undefined) =>
    state?.status === status &&
    state.sourcePresenceJson === sourceJson &&
    state.detailsJson === details;

  let result: { changes: number };
  try {
    result = await driver.execute(
      `UPDATE migration_state SET status = ?
       WHERE id = ? AND source_presence_json = ? AND details_json = ?`,
      [status, LEGACY_DEXIE_MIGRATION_ID, sourceJson, details]
    );
  } catch (error) {
    // A native bridge can lose the acknowledgement after SQLite committed.
    // Continue only when a read-back proves the requested state is durable.
    const observed = await readMigrationState(driver);
    if (isDurable(observed.state)) return;
    throw error;
  }

  if (result.changes !== 1) {
    const observed = await readMigrationState(driver);
    if (isDurable(observed.state)) return;
    throw new Error('Legacy SQLite migration state changed unexpectedly');
  }
}

async function markFailedBestEffort(
  driver: SqliteDriver,
  details: string
): Promise<void> {
  try {
    await driver.execute(
      `UPDATE migration_state SET status = 'failed'
       WHERE id = ? AND status = 'in_progress' AND details_json = ?`,
      [LEGACY_DEXIE_MIGRATION_ID, details]
    );
  } catch {
    // Keep the existing in_progress marker; retry still requires the same plan.
  }
}

async function completeFreshInstall(
  driver: SqliteDriver,
  source: LegacyMigrationSource,
  imageFileStore: NativeImageFileStore
): Promise<LegacySqliteMigrationResult> {
  await assertTargetAndFilesEmpty(driver, imageFileStore, emptyTableSpecs());
  const sourcePresenceJson = JSON.stringify({
    database: 'absent',
    localStorage: Object.fromEntries(
      Object.entries(source.localStorage).map(([key, value]) => [
        key,
        value !== null,
      ])
    ),
  });
  const details = JSON.stringify({ kind: 'fresh-install', schemaVersion: 1 });
  try {
    await driver.transaction(async tx => {
      await tx.execute(
        `INSERT INTO migration_state
          (id, status, source_presence_json, details_json)
         VALUES (?, 'completed', ?, ?)`,
        [LEGACY_DEXIE_MIGRATION_ID, sourcePresenceJson, details]
      );
    });
  } catch (error) {
    const observed = await readMigrationState(driver);
    if (
      observed.state?.status === 'completed' &&
      observed.state.sourcePresenceJson === sourcePresenceJson &&
      observed.state.detailsJson === details
    ) {
      return { status: 'fresh-install' };
    }
    throw error;
  }
  return { status: 'fresh-install' };
}

async function assertTargetAndFilesEmpty(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore,
  specs: readonly TargetTableSpec[]
): Promise<void> {
  const snapshot = await readTargetSnapshot(driver, specs);
  if (Array.from(snapshot.values()).some(rows => rows.length > 0)) {
    throw new Error(
      'SQLite target contains data without a migration ownership marker'
    );
  }
  if ((await fileStore.listObjectKeys()).length > 0) {
    throw new Error(
      'Image store contains objects without a migration ownership marker'
    );
  }
}

async function migrate(
  options: LegacySqliteMigrationOptions
): Promise<LegacySqliteMigrationResult> {
  const { driver, imageFileStore, loadSource } = options;
  let stateResult = await readMigrationState(driver);
  if (stateResult.state?.status === 'completed') {
    return { status: 'already-completed' };
  }
  if (stateResult.rowCount > 1) {
    throw new Error('SQLite contains an unknown migration state row');
  }
  if (!stateResult.state && stateResult.rowCount > 0) {
    throw new Error('SQLite contains an unknown migration state row');
  }

  const hadMigrationState = stateResult.state !== undefined;
  if (!hadMigrationState) {
    // Check all frozen data tables before opening the legacy source. A Native
    // database with unowned data is never treated as a blank migration target.
    await assertTargetAndFilesEmpty(driver, imageFileStore, emptyTableSpecs());
  }

  const source = await loadSource();
  if (source.info === null && !hasLegacyMigrationSourceData(source)) {
    if (hadMigrationState) {
      throw new Error('Legacy migration retry source is no longer available');
    }
    return completeFreshInstall(driver, source, imageFileStore);
  }

  const plan = await planLegacySqliteMigration(source);
  const specs = tableSpecs(plan);
  for (const spec of specs) {
    expectedRowsByKey(spec);
  }
  const files = imageFileMap(plan);
  const digest = await planDigest(plan, specs);
  const sourceJson = sourcePresenceJson(plan);
  const details = detailsJson(plan, digest, specs, [...files.keys()]);

  stateResult = await readMigrationState(driver);
  const existingState = stateResult.state;
  if (existingState?.status === 'completed') {
    validateExistingPlanState(existingState, sourceJson, details);
    return { status: 'already-completed' };
  }
  if (stateResult.rowCount > 1) {
    throw new Error('SQLite contains an unknown migration state row');
  }
  if (existingState) {
    validateExistingPlanState(existingState, sourceJson, details);
    const snapshot = await readTargetSnapshot(driver, specs);
    assertTargetRowsAreOwnedSubset(snapshot, specs, false);
    await assertFileObjectsAreOwnedSubset(
      driver,
      imageFileStore,
      files,
      false,
      true
    );
  } else if (stateResult.rowCount > 0 || hadMigrationState) {
    throw new Error('SQLite migration ownership marker disappeared');
  } else {
    // The target was checked before source preflight. Recheck before recording
    // ownership in case another initializer wrote to this database meanwhile.
    await assertTargetAndFilesEmpty(driver, imageFileStore, specs);
  }

  // Native startup pauses here: preflight passed, but no migration writes have
  // happened. The same frozen source is backed up and migrated after consent.
  await options.beforeMigration?.(source, plan, digest);

  if (!existingState) {
    await writeInitialState(driver, sourceJson, details);
  } else if (existingState.status === 'failed') {
    await updateStateStatus(driver, 'in_progress', sourceJson, details);
  }

  try {
    await writeImageFiles(imageFileStore, files);
    let transactionError: unknown;
    try {
      await insertTargetRows(driver, specs);
    } catch (error) {
      transactionError = error;
    }

    // If the native driver reported an uncertain commit, determine ownership
    // from the durable rows. Never delete files or replace divergent rows.
    const afterInsert = await readTargetSnapshot(driver, specs);
    assertTargetRowsAreOwnedSubset(afterInsert, specs, false);
    if (
      transactionError &&
      Array.from(afterInsert.entries()).some(([table, rows]) => {
        const spec = specs.find(candidate => candidate.table === table);
        return !spec || rows.length !== expectedRowsByKey(spec).size;
      })
    ) {
      throw transactionError;
    }

    assertTargetRowsAreOwnedSubset(afterInsert, specs, true);
    await assertFileObjectsAreOwnedSubset(
      driver,
      imageFileStore,
      files,
      true,
      false
    );

    try {
      await updateStateStatus(driver, 'completed', sourceJson, details);
    } catch (error) {
      const observed = await readMigrationState(driver);
      if (
        observed.state?.status === 'completed' &&
        observed.state.sourcePresenceJson === sourceJson &&
        observed.state.detailsJson === details
      ) {
        return { status: 'migrated', sourceVersion: plan.sourceVersion };
      }
      throw error;
    }

    const completed = await readMigrationState(driver);
    if (
      completed.state?.status !== 'completed' ||
      completed.state.sourcePresenceJson !== sourceJson ||
      completed.state.detailsJson !== details
    ) {
      throw new Error('SQLite migration completion could not be confirmed');
    }
    return { status: 'migrated', sourceVersion: plan.sourceVersion };
  } catch (error) {
    await markFailedBestEffort(driver, details);
    throw error;
  }
}

export function runLegacySqliteMigration(
  options: LegacySqliteMigrationOptions
): Promise<LegacySqliteMigrationResult> {
  const active = inFlightByDriver.get(options.driver);
  if (active) return active;

  const operation = migrate(options).finally(() => {
    if (inFlightByDriver.get(options.driver) === operation) {
      inFlightByDriver.delete(options.driver);
    }
  });
  inFlightByDriver.set(options.driver, operation);
  return operation;
}
