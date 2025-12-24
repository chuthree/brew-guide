/**
 * Supabase 模块导出
 *
 * 模块职责：
 * - realtime/: 实时同步模块（自动双向同步）
 * - syncOperations: 原子同步操作（upsert、软删除等）
 * - schema: 数据库初始化 SQL
 * - types: 类型定义
 */

// 数据库 Schema
export { SUPABASE_SETUP_SQL } from './schema';

// 类型导出
export * from './types';

// 实时同步模块
export {
  RealtimeSyncService,
  getRealtimeSyncService,
  useRealtimeSync,
  useRealtimeSyncStatus,
  offlineQueue,
} from './realtime';

export type {
  RealtimeSyncConfig,
  RealtimeSyncState,
  RealtimeConnectionStatus,
} from './realtime';
