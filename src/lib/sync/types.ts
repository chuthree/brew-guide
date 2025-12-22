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

// ============================================
// 工具函数
// ============================================

/**
 * 构建同步错误日志
 *
 * @param serviceName 服务名称 (e.g., 'Supabase', 'WebDAV', 'S3')
 * @param direction 操作方向
 * @param message 主要错误信息
 * @param errors 详细错误列表
 * @returns 格式化的日志行数组
 */
export function buildSyncErrorLogs(
  serviceName: string,
  direction: SyncDirection,
  message: string,
  errors: string[]
): string[] {
  const directionText = direction === 'upload' ? '上传' : '下载';
  const logs: string[] = [
    `=== ${serviceName} ${directionText}错误日志 ===`,
    '',
    `时间: ${new Date().toLocaleString('zh-CN')}`,
    `操作: ${directionText}`,
    '',
    `--- 错误信息 ---`,
    message,
  ];

  if (errors.length > 0) {
    logs.push('', `--- 详细错误 (${errors.length} 项) ---`);
    errors.forEach((err, index) => {
      logs.push(`${index + 1}. ${err}`);
    });
  }

  // 仅在浏览器环境添加环境信息
  if (typeof window !== 'undefined') {
    logs.push(
      '',
      '--- 环境信息 ---',
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`
    );
  }

  return logs;
}
