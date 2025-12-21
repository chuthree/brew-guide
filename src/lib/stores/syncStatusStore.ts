import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'offline';

export type SyncProvider = 'supabase' | 'webdav' | 's3' | 'none';

// 状态自动重置配置（Apple 风格：快速消失）
const STATUS_AUTO_RESET_CONFIG = {
  success: 500, // 成功后 0.5 秒快速重置（几乎无感）
  error: 3000, // 错误状态保持 3 秒让用户看到 Toast
  syncing: 30000, // 同步状态 30 秒超时自动重置（防止卡住）
};

interface SyncStatusState {
  status: SyncStatus;
  provider: SyncProvider;
  lastSyncTime: number | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  isReconnecting: boolean;

  // 内部状态
  _resetTimer: ReturnType<typeof setTimeout> | null;
  _syncingTimeout: ReturnType<typeof setTimeout> | null;

  setStatus: (status: SyncStatus) => void;
  setProvider: (provider: SyncProvider) => void;
  setSyncSuccess: () => void;
  setSyncError: (message: string) => void;
  setSyncing: () => void;
  setOffline: () => void;
  setReconnecting: (isReconnecting: boolean) => void;
  incrementRetry: () => number;
  resetRetry: () => void;
  reset: () => void;

  // 清理定时器
  _clearTimers: () => void;
  _scheduleReset: (delay: number) => void;
}

export const useSyncStatusStore = create<SyncStatusState>()(
  subscribeWithSelector((set, get) => ({
    status: 'idle',
    provider: 'none',
    lastSyncTime: null,
    errorMessage: null,
    retryCount: 0,
    maxRetries: 3,
    isReconnecting: false,
    _resetTimer: null,
    _syncingTimeout: null,

    _clearTimers: () => {
      const state = get();
      if (state._resetTimer) {
        clearTimeout(state._resetTimer);
      }
      if (state._syncingTimeout) {
        clearTimeout(state._syncingTimeout);
      }
      set({ _resetTimer: null, _syncingTimeout: null });
    },

    _scheduleReset: (delay: number) => {
      const { _clearTimers } = get();
      _clearTimers();

      const timer = setTimeout(() => {
        const currentState = get();
        // 只有在非 syncing 状态才自动重置
        if (currentState.status !== 'syncing') {
          set({ status: 'idle', _resetTimer: null });
        }
      }, delay);

      set({ _resetTimer: timer });
    },

    setStatus: status => {
      const { _clearTimers } = get();
      _clearTimers();
      set({ status });
    },

    setProvider: provider => set({ provider }),

    setSyncSuccess: () => {
      const { _clearTimers, _scheduleReset } = get();
      _clearTimers();

      set({
        status: 'success',
        lastSyncTime: Date.now(),
        errorMessage: null,
        retryCount: 0,
        isReconnecting: false,
      });

      // 成功后自动重置状态
      _scheduleReset(STATUS_AUTO_RESET_CONFIG.success);
    },

    setSyncError: message => {
      const { _clearTimers, _scheduleReset } = get();
      _clearTimers();

      set({
        status: 'error',
        errorMessage: message,
        isReconnecting: false,
      });

      // 错误后自动重置状态
      _scheduleReset(STATUS_AUTO_RESET_CONFIG.error);
    },

    setSyncing: () => {
      const { _clearTimers } = get();
      _clearTimers();

      // 设置同步超时保护
      const syncingTimeout = setTimeout(() => {
        const currentState = get();
        if (currentState.status === 'syncing') {
          console.warn('[SyncStatus] 同步超时，自动重置状态');
          set({
            status: 'error',
            errorMessage: '同步超时',
            _syncingTimeout: null,
          });
          // 错误后再重置
          currentState._scheduleReset(STATUS_AUTO_RESET_CONFIG.error);
        }
      }, STATUS_AUTO_RESET_CONFIG.syncing);

      set({ status: 'syncing', _syncingTimeout: syncingTimeout });
    },

    setOffline: () => {
      const { _clearTimers } = get();
      _clearTimers();
      set({ status: 'offline' });
    },

    setReconnecting: isReconnecting => set({ isReconnecting }),

    incrementRetry: () => {
      const { retryCount } = get();
      const newCount = retryCount + 1;
      set({ retryCount: newCount });
      return newCount;
    },

    resetRetry: () => set({ retryCount: 0 }),

    reset: () => {
      const { _clearTimers } = get();
      _clearTimers();
      set({
        status: 'idle',
        provider: 'none',
        lastSyncTime: null,
        errorMessage: null,
        retryCount: 0,
        isReconnecting: false,
        _resetTimer: null,
        _syncingTimeout: null,
      });
    },
  }))
);

// 获取状态的非 hook 方式
export const getSyncStatusStore = () => useSyncStatusStore.getState();
