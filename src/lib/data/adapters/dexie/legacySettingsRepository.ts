import type { Table } from 'dexie';
import { db } from '@/lib/core/db';
import type {
  LegacySettingEntry,
  LegacySettingsRepository,
} from '@/lib/data/contracts';

export function createDexieLegacySettingsRepository(
  table: Table<LegacySettingEntry, string> = db.settings
): LegacySettingsRepository {
  return {
    async get(key) {
      const record = await table.get(key);
      return record?.value;
    },

    async set(key, value) {
      await table.put({ key, value });
    },

    async delete(key) {
      await table.delete(key);
    },

    count() {
      return table.count();
    },

    async clear() {
      await table.clear();
    },
  };
}

export const legacySettingsRepository = createDexieLegacySettingsRepository();
