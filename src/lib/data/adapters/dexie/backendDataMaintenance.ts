import { dbUtils } from '@/lib/core/db';
import type { BackendDataMaintenance } from '@/lib/data/contracts';

/** Preserve the existing Dexie clear order, error handling, and side effects. */
export const dexieBackendDataMaintenance: BackendDataMaintenance = {
  clearAllData() {
    return dbUtils.clearAllData();
  },
};
