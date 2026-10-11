import type { Table } from 'dexie';
import { db } from '@/lib/core/db';
import type { AppSettings } from '@/lib/data/models';
import type { AppSettingsRepository } from '@/lib/data/contracts';

interface AppSettingsRow {
  id: string;
  data: AppSettings;
}

const MAIN_SETTINGS_ID = 'main';

export function createDexieAppSettingsRepository(
  table: Table<AppSettingsRow, string> = db.appSettings
): AppSettingsRepository {
  return {
    async get() {
      const row = await table.get(MAIN_SETTINGS_ID);
      return row?.data;
    },

    async save(settings) {
      await table.put({ id: MAIN_SETTINGS_ID, data: settings });
    },

    count() {
      return table.count();
    },

    async clear() {
      await table.clear();
    },
  };
}

export const appSettingsRepository = createDexieAppSettingsRepository();
