import type { Table } from 'dexie';
import { db } from '@/lib/core/db';
import type { OfflineQueueRepository } from '@/lib/data/contracts';
import type { PendingOperation } from '@/lib/supabase/realtime/types';

export function createDexieOfflineQueueRepository(
  table: Table<PendingOperation, string> = db.pendingOperations
): OfflineQueueRepository {
  return {
    findByTarget(targetTable, recordId) {
      return table.where({ table: targetTable, recordId }).toArray();
    },

    async add(operation) {
      await table.add(operation);
    },

    async update(id, changes) {
      await table.update(id, changes);
    },

    get(id) {
      return table.get(id);
    },

    listOrdered() {
      return table.orderBy('timestamp').toArray();
    },

    count() {
      return table.count();
    },

    async delete(id) {
      await table.delete(id);
    },

    async clear() {
      await table.clear();
    },
  };
}

export const offlineQueueRepository = createDexieOfflineQueueRepository();
