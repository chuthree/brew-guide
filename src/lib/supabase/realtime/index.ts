/**
 * Supabase 实时同步模块
 *
 * 模块结构：
 * - RealtimeSyncService: 核心服务（连接管理、协调）
 * - InitialSyncManager: 初始同步逻辑
 * - handlers/: 变更处理器
 *   - RemoteChangeHandler: 处理远程变更
 *   - LocalChangeListener: 监听本地事件
 *   - StoreNotifier: 通知 Store 更新
 * - conflictResolver: 冲突解决算法
 * - offlineQueue: 离线队列管理
 */

// 核心服务
export {
  RealtimeSyncService,
  getRealtimeSyncService,
} from './RealtimeSyncService';

// 初始同步
export { InitialSyncManager } from './InitialSyncManager';

// React Hooks
export { useRealtimeSync, useRealtimeSyncStatus } from './useRealtimeSync';

// 冲突解决
export {
  resolveConflictLWW,
  batchResolveConflicts,
  shouldAcceptRemoteChange,
  extractTimestamp,
  getLastSyncTime,
  setLastSyncTime,
  isModifiedAfterSync,
} from './conflictResolver';

// 离线队列
export { OfflineQueueManager, offlineQueue } from './offlineQueue';

// 处理器
export {
  remoteChangeHandler,
  localChangeListener,
  notifyStoreDelete,
  notifyStoreUpsert,
  refreshAllStores,
  refreshSettingsStores,
} from './handlers';

// 类型
export type {
  RealtimeSyncConfig,
  RealtimeSyncState,
  RealtimeConnectionStatus,
  RealtimeSyncTable,
  ChangeType,
  RealtimePayload,
  PendingOperation,
  CloudRecord,
  ConflictResolution,
  SyncableRecord,
  TableDataMap,
} from './types';
