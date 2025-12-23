/**
 * 实时同步相关类型定义
 */

import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';

/**
 * 同步表名
 */
export type RealtimeSyncTable =
  | 'coffee_beans'
  | 'brewing_notes'
  | 'custom_equipments'
  | 'custom_methods';

/**
 * 实时同步连接状态
 */
export type RealtimeConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * 数据库变更类型
 */
export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Supabase Realtime payload 类型
 */
export interface RealtimePayload<T = unknown> {
  eventType: ChangeType;
  new: T | null;
  old: { id: string } | null;
  table: RealtimeSyncTable;
  schema: string;
  commit_timestamp: string;
}

/**
 * 离线操作队列项
 */
export interface PendingOperation {
  id: string;
  table: RealtimeSyncTable;
  type: 'upsert' | 'delete';
  recordId: string;
  data?: unknown;
  timestamp: number;
  retryCount: number;
}

/**
 * 实时同步服务状态
 */
export interface RealtimeSyncState {
  /** 连接状态 */
  connectionStatus: RealtimeConnectionStatus;
  /** 上次同步时间 */
  lastSyncTime: number | null;
  /** 待同步的本地变更数量 */
  pendingChangesCount: number;
  /** 是否正在进行初始同步 */
  isInitialSyncing: boolean;
  /** 错误信息 */
  error: string | null;
}

/**
 * 同步记录的基础接口（包含时间戳用于冲突解决）
 */
export interface SyncableRecord {
  id: string;
  timestamp?: number;
  updated_at?: string;
}

/**
 * 云端记录格式
 */
export interface CloudRecord<T = unknown> {
  id: string;
  user_id: string;
  data: T;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * 冲突解决结果
 */
export interface ConflictResolution {
  winner: 'local' | 'remote';
  record: SyncableRecord;
}

/**
 * 表数据类型映射
 */
export interface TableDataMap {
  coffee_beans: CoffeeBean;
  brewing_notes: BrewingNote;
  custom_equipments: CustomEquipment;
  custom_methods: { equipmentId: string; methods: Method[] };
}

/**
 * 实时同步服务配置
 */
export interface RealtimeSyncConfig {
  /** Supabase URL */
  url: string;
  /** Supabase anon key */
  anonKey: string;
  /** 是否启用离线队列 */
  enableOfflineQueue?: boolean;
  /** 重试间隔（毫秒） */
  retryInterval?: number;
  /** 最大重试次数 */
  maxRetries?: number;
}
