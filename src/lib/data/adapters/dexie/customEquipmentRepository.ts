import type { Table } from 'dexie';
import { db } from '@/lib/core/db';
import type { CustomEquipment } from '@/lib/core/config';
import type { CustomEquipmentRepository } from '@/lib/data/contracts';

export function createDexieCustomEquipmentRepository(
  table: Table<CustomEquipment, string> = db.customEquipments
): CustomEquipmentRepository {
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

    async save(equipment) {
      await table.put(equipment);
    },

    async upsertMany(equipments) {
      if (equipments.length > 0) {
        await table.bulkPut(equipments);
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

    async replaceAll(equipments) {
      await table.clear();
      if (equipments.length > 0) {
        await table.bulkPut(equipments);
      }
    },

    async clear() {
      await table.clear();
    },
  };
}

export const customEquipmentRepository = createDexieCustomEquipmentRepository();
