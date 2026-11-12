import type {
  LegacySettingEntry,
  LegacySettingsRepository,
} from '@/lib/data/contracts';
import { decodeLegacySetting, encodeLegacySetting } from '../codecs';
import type { LegacySettingsRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import {
  countTable,
  queryOptionalRow,
  readChunkedText,
  SQLITE_TEXT_CHUNK_SIZE as BASELINE_CHUNK_SIZE,
} from './sqlHelpers';

async function getLegacySetting(
  executor: SqliteExecutor,
  key: string
): Promise<string | undefined> {
  const row = await queryOptionalRow(
    executor,
    'SELECT key, value FROM legacy_settings WHERE key = ?',
    [key]
  );
  if (!row) return undefined;
  return decodeLegacySetting(row as unknown as LegacySettingsRow).value;
}

async function getSyncBaseline(
  executor: SqliteExecutor,
  key: string
): Promise<string | undefined> {
  return readChunkedText(
    executor,
    'SELECT value FROM legacy_settings WHERE key = ?',
    [key]
  );
}

async function setLegacySetting(
  executor: SqliteExecutor,
  key: string,
  value: string
): Promise<void> {
  const row = encodeLegacySetting({ key, value } satisfies LegacySettingEntry);
  await executor.execute(
    'INSERT OR REPLACE INTO legacy_settings (key, value) VALUES (?, ?)',
    [row.key, row.value]
  );
}

async function setLargeSyncBaseline(
  executor: SqliteExecutor,
  key: string,
  value: string
): Promise<void> {
  const row = encodeLegacySetting({ key, value } satisfies LegacySettingEntry);
  // Assemble inside SQLite so the full JSON never crosses the native bridge at once.
  await executor.execute(
    'CREATE TEMP TABLE sync_baseline_chunks (position INTEGER PRIMARY KEY, value TEXT NOT NULL)'
  );
  for (let position = 0; position < row.value.length; ) {
    let end = Math.min(position + BASELINE_CHUNK_SIZE, row.value.length);
    const last = row.value.charCodeAt(end - 1);
    if (end < row.value.length && last >= 0xd800 && last <= 0xdbff) end--;
    await executor.execute('INSERT INTO sync_baseline_chunks VALUES (?, ?)', [
      position,
      row.value.slice(position, end),
    ]);
    position = end;
  }
  await executor.execute(
    `INSERT OR REPLACE INTO legacy_settings (key, value)
     VALUES (?, (SELECT group_concat(value, '') FROM
       (SELECT value FROM sync_baseline_chunks ORDER BY position)))`,
    [row.key]
  );
  await executor.execute('DROP TABLE sync_baseline_chunks');
}

async function deleteLegacySetting(
  executor: SqliteExecutor,
  key: string
): Promise<void> {
  await executor.execute('DELETE FROM legacy_settings WHERE key = ?', [key]);
}

async function clearLegacySettings(executor: SqliteExecutor): Promise<void> {
  await executor.execute('DELETE FROM legacy_settings');
}

export function createSqliteLegacySettingsRepository(
  driver: SqliteDriver
): LegacySettingsRepository {
  return {
    get: key =>
      key.startsWith('cloud-sync-base-v1:')
        ? driver.transaction(tx => getSyncBaseline(tx, key))
        : getLegacySetting(driver, key),
    set: (key, value) =>
      key.startsWith('cloud-sync-base-v1:') &&
      value.length > BASELINE_CHUNK_SIZE
        ? driver.transaction(tx => setLargeSyncBaseline(tx, key, value))
        : setLegacySetting(driver, key, value),
    delete: key => deleteLegacySetting(driver, key),
    count: () => countTable(driver, 'legacy_settings'),
    clear: () => clearLegacySettings(driver),
  };
}
