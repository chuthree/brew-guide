/**
 * Supabase 同步相关的类型定义
 * 支持实时同步和自动冲突解决
 */

import type { CoffeeBean, BrewingNoteData } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';

/**
 * Supabase 配置
 */
export interface SupabaseConfig {
  /** Supabase 项目 URL */
  url: string;
  /** Supabase anon key（公开密钥） */
  anonKey: string;
  /** 用户 ID（用于数据隔离） */
  userId?: string;
}

/**
 * Supabase 同步设置（存储在本地设置中）
 */
export interface SupabaseSyncSettings {
  /** 是否启用 */
  enabled: boolean;
  /** Supabase 项目 URL */
  url: string;
  /** Supabase anon key */
  anonKey: string;
  /** 是否启用实时同步 */
  realtimeEnabled: boolean;
  /** 同步模式 */
  syncMode: 'realtime' | 'manual';
  /** 是否启用下拉同步 */
  enablePullToSync?: boolean;
  /** 上次连接是否成功 */
  lastConnectionSuccess?: boolean;
  /** 上次同步时间 */
  lastSyncTime?: number;
  /** 设备 ID */
  deviceId?: string;
}

/**
 * Supabase 数据库表名
 */
export type SupabaseTableName =
  | 'coffee_beans'
  | 'brewing_notes'
  | 'custom_equipments'
  | 'custom_methods';

/**
 * 同步记录 - 用于追踪数据同步状态
 */
export interface SyncRecord {
  /** 本地记录 ID */
  localId: string;
  /** 远程记录 ID */
  remoteId?: string;
  /** 表名 */
  tableName: SupabaseTableName;
  /** 本地更新时间 */
  localUpdatedAt: number;
  /** 远程更新时间 */
  remoteUpdatedAt?: number;
  /** 同步状态 */
  syncStatus: 'pending' | 'synced' | 'conflict' | 'error';
  /** 上次同步时间 */
  lastSyncedAt?: number;
}

/**
 * Supabase 表数据类型 - 咖啡豆
 */
export interface SupabaseCoffeeBean {
  id: string;
  user_id: string;
  data: CoffeeBean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  version: number;
}

/**
 * Supabase 表数据类型 - 冲煮笔记
 */
export interface SupabaseBrewingNote {
  id: string;
  user_id: string;
  data: BrewingNote | BrewingNoteData;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  version: number;
}

/**
 * Supabase 表数据类型 - 自定义器具
 */
export interface SupabaseCustomEquipment {
  id: string;
  user_id: string;
  data: CustomEquipment;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  version: number;
}

/**
 * Supabase 表数据类型 - 自定义方案
 */
export interface SupabaseCustomMethod {
  id: string;
  user_id: string;
  equipment_id: string;
  data: { equipmentId: string; methods: Method[] };
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  version: number;
}

/**
 * 通用的 Supabase 数据行类型
 */
export type SupabaseRow =
  | SupabaseCoffeeBean
  | SupabaseBrewingNote
  | SupabaseCustomEquipment
  | SupabaseCustomMethod;

/**
 * 实时同步事件类型
 */
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * 实时同步回调
 */
export interface RealtimePayload<T = unknown> {
  eventType: RealtimeEventType;
  table: SupabaseTableName;
  new: T | null;
  old: T | null;
  commit_timestamp: string;
}

/**
 * 同步进度信息
 */
export interface SupabaseSyncProgress {
  /** 当前阶段 */
  phase: 'connecting' | 'downloading' | 'uploading' | 'resolving' | 'completed';
  /** 当前表名 */
  currentTable?: SupabaseTableName;
  /** 已完成数量 */
  completed: number;
  /** 总数量 */
  total: number;
  /** 进度百分比 (0-100) */
  percentage: number;
  /** 阶段描述 */
  message: string;
}

/**
 * 同步结果
 */
export interface SupabaseSyncResult {
  /** 是否成功 */
  success: boolean;
  /** 结果消息 */
  message: string;
  /** 上传的记录数 */
  uploaded: number;
  /** 下载的记录数 */
  downloaded: number;
  /** 删除的记录数 */
  deleted: number;
  /** 冲突解决数 */
  conflictsResolved: number;
  /** 错误列表 */
  errors: string[];
  /** 同步耗时（毫秒） */
  duration?: number;
}

/**
 * 冲突解决策略
 */
export enum SupabaseConflictStrategy {
  /** 使用远程版本（服务器优先） */
  REMOTE_WINS = 'remote_wins',
  /** 使用本地版本（本地优先） */
  LOCAL_WINS = 'local_wins',
  /** 使用最新版本（基于 updated_at） */
  LATEST_WINS = 'latest_wins',
  /** 手动解决 */
  MANUAL = 'manual',
}

/**
 * 同步选项
 */
export interface SupabaseSyncOptions {
  /** 冲突解决策略，默认 LATEST_WINS */
  conflictStrategy?: SupabaseConflictStrategy;
  /** 是否只同步增量数据 */
  incrementalOnly?: boolean;
  /** 进度回调 */
  onProgress?: (progress: SupabaseSyncProgress) => void;
  /** 表过滤（只同步指定表） */
  tables?: SupabaseTableName[];
}

/**
 * 数据库变更类型
 */
export interface DatabaseChange {
  /** 变更类型 */
  type: 'create' | 'update' | 'delete';
  /** 表名 */
  table: SupabaseTableName;
  /** 记录 ID */
  id: string;
  /** 数据 */
  data?: unknown;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 待同步队列项
 */
export interface PendingSyncItem {
  /** 唯一标识 */
  id: string;
  /** 变更信息 */
  change: DatabaseChange;
  /** 重试次数 */
  retryCount: number;
  /** 创建时间 */
  createdAt: number;
  /** 最后尝试时间 */
  lastAttemptAt?: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 实时连接状态
 */
export type RealtimeConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Supabase 同步管理器接口
 */
export interface ISupabaseSyncManager {
  /** 初始化 */
  initialize(config: SupabaseConfig): Promise<boolean>;
  /** 测试连接 */
  testConnection(): Promise<boolean>;
  /** 执行完整同步 */
  fullSync(options?: SupabaseSyncOptions): Promise<SupabaseSyncResult>;
  /** 推送本地变更到远程 */
  pushChanges(changes: DatabaseChange[]): Promise<SupabaseSyncResult>;
  /** 拉取远程变更到本地 */
  pullChanges(since?: number): Promise<SupabaseSyncResult>;
  /** 启动实时同步 */
  startRealtime(): Promise<void>;
  /** 停止实时同步 */
  stopRealtime(): void;
  /** 获取实时连接状态 */
  getRealtimeStatus(): RealtimeConnectionStatus;
  /** 断开连接 */
  disconnect(): void;
}
