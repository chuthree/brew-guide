import type { Table } from 'dexie';
import { db } from '@/lib/core/db';
import type { CoffeeBean } from '@/types/app';
import type { CoffeeBeanRepository } from '@/lib/data/contracts';

export function createDexieCoffeeBeanRepository(
  table: Table<CoffeeBean, string> = db.coffeeBeans
): CoffeeBeanRepository {
  return {
    list() {
      return table.toArray();
    },

    get(id) {
      return table.get(id);
    },

    count() {
      return table.count();
    },

    async save(bean) {
      await table.put(bean);
    },

    async upsertMany(beans) {
      if (beans.length > 0) {
        await table.bulkPut(beans);
      }
    },

    async delete(id) {
      await table.delete(id);
    },

    async deleteMany(ids) {
      if (ids.length > 0) {
        await table.bulkDelete(ids);
      }
    },

    async clear() {
      await table.clear();
    },
  };
}

export const coffeeBeanRepository = createDexieCoffeeBeanRepository();
