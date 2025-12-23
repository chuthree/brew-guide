/**
 * 实时同步 React Hook
 *
 * 提供组件级别的实时同步状态访问和控制
 */

import { useState, useEffect, useCallback } from 'react';
import {
  RealtimeSyncService,
  getRealtimeSyncService,
} from './RealtimeSyncService';
import type { RealtimeSyncState, RealtimeSyncConfig } from './types';

/**
 * 实时同步 Hook 返回值
 */
interface UseRealtimeSyncReturn {
  /** 当前状态 */
  state: RealtimeSyncState;
  /** 连接到 Supabase */
  connect: (config: RealtimeSyncConfig) => Promise<boolean>;
  /** 断开连接 */
  disconnect: () => Promise<void>;
  /** 手动触发同步 */
  manualSync: () => Promise<void>;
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否正在同步 */
  isSyncing: boolean;
}

/**
 * 实时同步 Hook
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { state, connect, disconnect, isConnected } = useRealtimeSync();
 *
 *   useEffect(() => {
 *     if (supabaseConfig.enabled) {
 *       connect(supabaseConfig);
 *     }
 *     return () => disconnect();
 *   }, []);
 *
 *   return <div>Status: {state.connectionStatus}</div>;
 * }
 * ```
 */
export function useRealtimeSync(): UseRealtimeSyncReturn {
  const [service] = useState<RealtimeSyncService>(() =>
    getRealtimeSyncService()
  );
  const [state, setState] = useState<RealtimeSyncState>(() =>
    service.getState()
  );

  // 订阅状态变更
  useEffect(() => {
    const unsubscribe = service.subscribe(setState);
    return unsubscribe;
  }, [service]);

  // 连接
  const connect = useCallback(
    async (config: RealtimeSyncConfig): Promise<boolean> => {
      return service.connect(config);
    },
    [service]
  );

  // 断开
  const disconnect = useCallback(async (): Promise<void> => {
    return service.disconnect();
  }, [service]);

  // 手动同步
  const manualSync = useCallback(async (): Promise<void> => {
    return service.manualSync();
  }, [service]);

  return {
    state,
    connect,
    disconnect,
    manualSync,
    isConnected: state.connectionStatus === 'connected',
    isSyncing: state.isInitialSyncing,
  };
}

/**
 * 实时同步连接状态 Hook（简化版）
 *
 * 只返回连接状态，适用于只需要显示状态的组件
 */
export function useRealtimeSyncStatus(): {
  status: RealtimeSyncState['connectionStatus'];
  lastSyncTime: number | null;
  pendingChanges: number;
  error: string | null;
} {
  const { state } = useRealtimeSync();

  return {
    status: state.connectionStatus,
    lastSyncTime: state.lastSyncTime,
    pendingChanges: state.pendingChangesCount,
    error: state.error,
  };
}
