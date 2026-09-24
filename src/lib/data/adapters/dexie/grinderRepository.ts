import type { Table } from 'dexie';
import { db } from '@/lib/core/db';
import type { Grinder } from '@/lib/data/models';
import type { GrinderRepository } from '@/lib/data/contracts';

export function createDexieGrinderRepository(
  table: Table<Grinder, string> = db.grinders
): GrinderRepository {
  return {
    list() {
      return table.toArray();
    },

    count() {
      return table.count();
    },

    async save(grinder) {
      await table.put(grinder);
    },

    async upsertMany(grinders) {
      if (grinders.length > 0) {
        await table.bulkPut(grinders);
      }
    },

    async delete(id) {
      await table.delete(id);
    },

    async replaceAll(grinders) {
      await table.clear();
      if (grinders.length > 0) {
        await table.bulkPut(grinders);
      }
    },

    async clear() {
      await table.clear();
    },
  };
}

export const grinderRepository = createDexieGrinderRepository();
