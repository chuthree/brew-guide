import { db, dbUtils } from '@/lib/core/db';
import type { BackendDataMaintenance } from '@/lib/data/contracts';

/** Preserve the existing Dexie clear order, error handling, and side effects. */
export const dexieBackendDataMaintenance: BackendDataMaintenance = {
  clearAllData() {
    return dbUtils.clearAllData();
  },
};

/** Installed by the Dexie runtime, never imported by generic maintenance callers. */
export async function invalidateDexieBusinessHistory(): Promise<void> {
  try {
    await db.transaction(
      'rw',
      [db.businessOperations, db.businessPublications],
      async () => {
        await db.businessOperations.clear();
        await db.businessPublications.clear();
      }
    );
  } catch (error) {
    console.error(
      '[BusinessHistory] 无法清除业务操作历史，已停止数据替换',
      error
    );
    throw error;
  }
}
