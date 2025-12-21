import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export type SyncProvider = 'supabase' | 'webdav' | 's3' | 'none';

interface SyncStatusState {
  status: SyncStatus;
  provider: SyncProvider;
  lastSyncTime: number | null;
  errorMessage: string | null;

  setStatus: (status: SyncStatus) => void;
  setProvider: (provider: SyncProvider) => void;
  setSyncSuccess: () => void;
  setSyncError: (message: string) => void;
  setSyncing: () => void;
  reset: () => void;
}

export const useSyncStatusStore = create<SyncStatusState>()(
  subscribeWithSelector(set => ({
    status: 'idle',
    provider: 'none',
    lastSyncTime: null,
    errorMessage: null,

    setStatus: status => set({ status }),

    setProvider: provider => set({ provider }),

    setSyncSuccess: () =>
      set({
        status: 'success',
        lastSyncTime: Date.now(),
        errorMessage: null,
      }),

    setSyncError: message =>
      set({
        status: 'error',
        errorMessage: message,
      }),

    setSyncing: () => set({ status: 'syncing' }),

    reset: () =>
      set({
        status: 'idle',
        provider: 'none',
        lastSyncTime: null,
        errorMessage: null,
      }),
  }))
);

// 获取状态的非 hook 方式
export const getSyncStatusStore = () => useSyncStatusStore.getState();
