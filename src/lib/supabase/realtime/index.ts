/**
 * Supabase 实时同步模块
 *
 * 导出实时同步相关的所有功能
 */

// 核心服务
export {
  RealtimeSyncService,
  getRealtimeSyncService,
} from './RealtimeSyncService';

// React Hooks
export { useRealtimeSync, useRealtimeSyncStatus } from './useRealtimeSync';

// 冲突解决
export {
  resolveConflictLWW,
  batchResolveConflicts,
  shouldAcceptRemoteChange,
  extractTimestamp,
} from './conflictResolver';

// 离线队列
export { OfflineQueueManager, offlineQueue } from './offlineQueue';

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
