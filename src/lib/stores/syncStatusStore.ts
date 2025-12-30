/**
 * 同步状态 Store
 *
 * 2025-12-21 简化：移除自动重连相关逻辑，只保留手动同步所需状态
 * 2025-12-23 扩展：添加实时同步状态支持
 *
 * 职责：
 * - 管理全局同步状态（syncing/success/error/idle）
 * - 管理实时同步连接状态
 * - 提供同步超时保护
 * - 状态自动重置
 *
 * 注意：UI 层的错误日志展示由各组件通过 useSyncSection hook 自行管理
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { SyncStatus, CloudProvider } from '@/lib/sync/types';

// 重导出类型，保持向后兼容
export type { SyncStatus };
export type SyncProvider = CloudProvider;

// 实时同步连接状态
export type RealtimeStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

// 状态自动重置配置
const STATUS_AUTO_RESET_CONFIG = {
  success: 500, // 成功后快速重置
  error: 3000, // 错误状态保持 3 秒
  syncing: 30000, // 同步超时保护
};

interface SyncStatusState {
  status: SyncStatus;
  provider: SyncProvider;
  lastSyncTime: number | null;
  errorMessage: string | null;

  // 实时同步状态
  realtimeStatus: RealtimeStatus;
  realtimeEnabled: boolean;
  pendingChangesCount: number;
  isInitialSyncing: boolean;

  // 内部状态
  _resetTimer: ReturnType<typeof setTimeout> | null;
  _syncingTimeout: ReturnType<typeof setTimeout> | null;

  // 方法
  setStatus: (status: SyncStatus) => void;
  setProvider: (provider: SyncProvider) => void;
  setSyncSuccess: () => void;
  setSyncError: (message: string) => void;
  setSyncing: () => void;
  reset: () => void;

  // 实时同步方法
  setRealtimeStatus: (status: RealtimeStatus) => void;
  setRealtimeEnabled: (enabled: boolean) => void;
  setPendingChangesCount: (count: number) => void;
  setInitialSyncing: (syncing: boolean) => void;

  // 内部方法
  _clearTimers: () => void;
  _scheduleReset: (delay: number) => void;
}

export const useSyncStatusStore = create<SyncStatusState>()(
  subscribeWithSelector((set, get) => ({
    status: 'idle',
    provider: 'none',
    lastSyncTime: null,
    errorMessage: null,

    // 实时同步初始状态
    realtimeStatus: 'disconnected',
    realtimeEnabled: false,
    pendingChangesCount: 0,
    isInitialSyncing: false,

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
      });

      _scheduleReset(STATUS_AUTO_RESET_CONFIG.success);
    },

    setSyncError: message => {
      const { _clearTimers, _scheduleReset } = get();
      _clearTimers();

      set({
        status: 'error',
        errorMessage: message,
      });

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
          currentState._scheduleReset(STATUS_AUTO_RESET_CONFIG.error);
        }
      }, STATUS_AUTO_RESET_CONFIG.syncing);

      set({ status: 'syncing', _syncingTimeout: syncingTimeout });
    },

    reset: () => {
      const { _clearTimers } = get();
      _clearTimers();
      set({
        status: 'idle',
        provider: 'none',
        lastSyncTime: null,
        errorMessage: null,
        _resetTimer: null,
        _syncingTimeout: null,
      });
    },

    // 实时同步方法
    setRealtimeStatus: (status: RealtimeStatus) => {
      set({ realtimeStatus: status });
    },

    setRealtimeEnabled: (enabled: boolean) => {
      set({ realtimeEnabled: enabled });
    },

    setPendingChangesCount: (count: number) => {
      set({ pendingChangesCount: count });
    },

    setInitialSyncing: (syncing: boolean) => {
      set({ isInitialSyncing: syncing });
    },
  }))
);

// 获取状态的非 hook 方式
export const getSyncStatusStore = () => useSyncStatusStore.getState();
