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

// Supabase 同步任务状态，用于同时展示多张表/队列的进度
export type SupabaseSyncTaskStatus =
  | 'pending'
  | 'preparing'
  | 'fetching'
  | 'uploading'
  | 'downloading'
  | 'writing'
  | 'verifying'
  | 'queued'
  | 'success'
  | 'warning'
  | 'error';

export type SupabaseSyncPhase =
  | 'idle'
  | 'connecting'
  | 'initial-sync'
  | 'manual-sync'
  | 'background-sync'
  | 'local-change'
  | 'settings'
  | 'offline-queue';

export interface SupabaseSyncTask {
  id: string;
  label: string;
  status: SupabaseSyncTaskStatus;
  detail?: string;
  completed?: number;
  total?: number;
  uploaded?: number;
  downloaded?: number;
  deleted?: number;
  failed?: number;
  error?: string;
  updatedAt: number;
}

export interface SupabaseSyncProgress {
  active: boolean;
  phase: SupabaseSyncPhase;
  message?: string;
  startedAt?: number;
  updatedAt?: number;
  tasks: SupabaseSyncTask[];
}

type SupabaseSyncTaskInput = Pick<SupabaseSyncTask, 'id' | 'label'> &
  Partial<Omit<SupabaseSyncTask, 'id' | 'label' | 'updatedAt'>>;

type SupabaseSyncTaskPatch = Partial<
  Omit<SupabaseSyncTask, 'id' | 'updatedAt'>
>;

const createIdleSupabaseSyncProgress = (): SupabaseSyncProgress => ({
  active: false,
  phase: 'idle',
  tasks: [],
});

// 状态自动重置配置
const STATUS_AUTO_RESET_CONFIG = {
  success: 500, // 成功后快速重置
  error: 3000, // 错误状态保持 3 秒
  syncing: 300000, // 同步超时保护，需覆盖移动端图片同步
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
  supabaseSyncProgress: SupabaseSyncProgress;

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
  startSupabaseSyncProgress: (
    phase: SupabaseSyncPhase,
    message?: string,
    tasks?: SupabaseSyncTaskInput[]
  ) => void;
  updateSupabaseSyncTask: (
    taskId: string,
    patch: SupabaseSyncTaskPatch
  ) => void;
  finishSupabaseSyncProgress: (message?: string) => void;
  failSupabaseSyncProgress: (message: string) => void;
  resetSupabaseSyncProgress: () => void;

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
    supabaseSyncProgress: createIdleSupabaseSyncProgress(),

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
        supabaseSyncProgress: createIdleSupabaseSyncProgress(),
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

    startSupabaseSyncProgress: (phase, message, tasks = []) => {
      const now = Date.now();
      set({
        supabaseSyncProgress: {
          active: true,
          phase,
          message,
          startedAt: now,
          updatedAt: now,
          tasks: tasks.map(task => ({
            status: 'pending',
            ...task,
            updatedAt: now,
          })),
        },
      });
    },

    updateSupabaseSyncTask: (taskId, patch) => {
      const now = Date.now();
      set(state => {
        const currentTasks = state.supabaseSyncProgress.tasks;
        const existingIndex = currentTasks.findIndex(
          task => task.id === taskId
        );

        const nextTask: SupabaseSyncTask =
          existingIndex >= 0
            ? {
                ...currentTasks[existingIndex],
                ...patch,
                updatedAt: now,
              }
            : {
                id: taskId,
                label: patch.label ?? taskId,
                status: patch.status ?? 'pending',
                detail: patch.detail,
                completed: patch.completed,
                total: patch.total,
                uploaded: patch.uploaded,
                downloaded: patch.downloaded,
                deleted: patch.deleted,
                failed: patch.failed,
                error: patch.error,
                updatedAt: now,
              };

        const tasks =
          existingIndex >= 0
            ? currentTasks.map((task, index) =>
                index === existingIndex ? nextTask : task
              )
            : [...currentTasks, nextTask];

        return {
          supabaseSyncProgress: {
            ...state.supabaseSyncProgress,
            updatedAt: now,
            tasks,
          },
        };
      });
    },

    finishSupabaseSyncProgress: message => {
      const now = Date.now();
      set(state => ({
        supabaseSyncProgress: {
          ...state.supabaseSyncProgress,
          active: false,
          phase: 'idle',
          message,
          updatedAt: now,
        },
      }));
    },

    failSupabaseSyncProgress: message => {
      const now = Date.now();
      set(state => ({
        supabaseSyncProgress: {
          ...state.supabaseSyncProgress,
          active: false,
          phase: 'idle',
          message,
          updatedAt: now,
        },
      }));
    },

    resetSupabaseSyncProgress: () => {
      set({ supabaseSyncProgress: createIdleSupabaseSyncProgress() });
    },
  }))
);

// 获取状态的非 hook 方式
export const getSyncStatusStore = () => useSyncStatusStore.getState();
