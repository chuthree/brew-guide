import type { Table } from 'dexie';
import { db } from '@/lib/core/db';
import type {
  CustomMethodRecord,
  CustomMethodRepository,
} from '@/lib/data/contracts';

export function createDexieCustomMethodRepository(
  table: Table<CustomMethodRecord, string> = db.customMethods
): CustomMethodRepository {
  return {
    list() {
      return table.toArray();
    },

    get(equipmentId) {
      return table.get(equipmentId);
    },

    count() {
      return table.count();
    },

    async save(record) {
      await table.put(record);
    },

    async upsertMany(records) {
      if (records.length > 0) {
        await table.bulkPut(records);
      }
    },

    async delete(equipmentId) {
      await table.delete(equipmentId);
    },

    async deleteMany(equipmentIds) {
      if (equipmentIds.length > 0) {
        await table.bulkDelete(equipmentIds);
      }
    },

    async clear() {
      await table.clear();
    },
  };
}

export const customMethodRepository = createDexieCustomMethodRepository();
