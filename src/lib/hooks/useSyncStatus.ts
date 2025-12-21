/**
 * 同步状态 Hook
 *
 * 提供统一的同步状态访问接口，简化组件使用
 * Apple 风格：只在同步时显示，其他时候无感
 */

import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import { SyncManager } from '@/lib/sync/SyncManager';
import { useCallback, useMemo } from 'react';

export interface UseSyncStatusReturn {
  /** 是否正在同步中（用于显示转圈图标） */
  isSyncing: boolean;
  /** 是否已启用云同步 */
  isCloudSyncEnabled: boolean;
  /** 上次同步时间 */
  lastSyncTime: number | null;
  /** 手动触发同步 */
  requestSync: (type?: 'upload' | 'download' | 'full') => Promise<boolean>;
  /** 检查是否在线 */
  isOnline: boolean;
}

/**
 * 使用同步状态
 *
 * @example
 * ```tsx
 * const { isSyncing, isCloudSyncEnabled, requestSync } = useSyncStatus();
 *
 * // 在 UI 中显示同步状态
 * {isSyncing && <Spinner />}
 *
 * // 手动触发同步
 * await requestSync('full');
 * ```
 */
export function useSyncStatus(): UseSyncStatusReturn {
  const status = useSyncStatusStore(state => state.status);
  const provider = useSyncStatusStore(state => state.provider);
  const isReconnecting = useSyncStatusStore(state => state.isReconnecting);
  const lastSyncTime = useSyncStatusStore(state => state.lastSyncTime);

  // 是否正在同步（包括重连中）
  const isSyncing = useMemo(
    () => status === 'syncing' || isReconnecting,
    [status, isReconnecting]
  );

  // 是否启用了云同步
  const isCloudSyncEnabled = useMemo(() => provider !== 'none', [provider]);

  // 检查网络状态
  const isOnline = useMemo(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
    []
  );

  // 手动触发同步
  const requestSync = useCallback(
    async (type: 'upload' | 'download' | 'full' = 'download') => {
      if (!SyncManager.isReady()) {
        console.warn('[useSyncStatus] SyncManager 未初始化');
        return false;
      }
      return SyncManager.requestSync(type);
    },
    []
  );

  return {
    isSyncing,
    isCloudSyncEnabled,
    lastSyncTime,
    requestSync,
    isOnline,
  };
}

export default useSyncStatus;
