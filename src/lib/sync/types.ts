/**
 * 云同步统一类型定义
 *
 * 所有云同步提供商（S3、WebDAV、Supabase）共用的类型
 */

/** 连接状态 */
export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/** 同步状态 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

/** 同步方向 */
export type SyncDirection = 'upload' | 'download';

/** 同步进度 */
export interface SyncProgress {
  phase: string;
  message: string;
  percentage: number;
}

/** 同步结果（统一格式） */
export interface UnifiedSyncResult {
  success: boolean;
  message: string;
  uploadedFiles: number;
  downloadedFiles: number;
  debugLogs?: string[];
  conflict?: boolean;
}

/** 云同步提供商类型 */
export type CloudProvider = 'none' | 's3' | 'webdav' | 'supabase';
