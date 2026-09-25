import type {
  LegacySettingEntry,
  LegacySettingsRepository,
} from '@/lib/data/contracts';
import { decodeLegacySetting, encodeLegacySetting } from '../codecs';
import type { LegacySettingsRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import { countTable, queryOptionalRow } from './sqlHelpers';

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

async function setLegacySetting(
  executor: SqliteExecutor,
  key: string,
  value: string
): Promise<void> {
  const row = encodeLegacySetting({ key, value } satisfies LegacySettingEntry);
  await executor.execute(
    `INSERT INTO legacy_settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [row.key, row.value]
  );
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
    get: key => getLegacySetting(driver, key),
    set: (key, value) => setLegacySetting(driver, key, value),
    delete: key => deleteLegacySetting(driver, key),
    count: () => countTable(driver, 'legacy_settings'),
    clear: () => clearLegacySettings(driver),
  };
}
