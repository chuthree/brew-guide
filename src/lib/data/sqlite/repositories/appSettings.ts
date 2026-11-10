import type { AppSettingsRepository } from '@/lib/data/contracts';
import type { AppSettings } from '@/lib/data/models';
import { decodeAppSettings, encodeAppSettings } from '../codecs';
import type { AppSettingsRow } from '../schemaV1';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import { countTable, readChunkedText } from './sqlHelpers';

const MAIN_SETTINGS_ID = 'main';

/** Executor-scoped operations can be composed inside a storage transaction. */
export async function getAppSettings(
  executor: SqliteExecutor
): Promise<AppSettings | undefined> {
  const data = await readChunkedText(
    executor,
    'SELECT data_json AS value FROM app_settings WHERE id = ?',
    [MAIN_SETTINGS_ID]
  );
  if (data === undefined) return undefined;
  return decodeAppSettings({
    id: MAIN_SETTINGS_ID,
    data_json: data,
  } satisfies AppSettingsRow).data;
}

export async function saveAppSettings(
  executor: SqliteExecutor,
  settings: AppSettings
): Promise<void> {
  const row = encodeAppSettings({ id: MAIN_SETTINGS_ID, data: settings });
  await executor.execute(
    `INSERT INTO app_settings (id, data_json)
     VALUES (?, ?)
     ON CONFLICT(id) DO UPDATE SET data_json = excluded.data_json`,
    [row.id, row.data_json]
  );
}

async function clearAppSettings(executor: SqliteExecutor): Promise<void> {
  await executor.execute('DELETE FROM app_settings');
}

export function createSqliteAppSettingsRepository(
  driver: SqliteDriver
): AppSettingsRepository {
  return {
    get: () => driver.transaction(getAppSettings),
    save: settings => saveAppSettings(driver, settings),
    count: () => countTable(driver, 'app_settings'),
    clear: () => clearAppSettings(driver),
  };
}
