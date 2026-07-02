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

/** 最近一次底层请求的诊断信息 */
export interface SyncDiagnostic {
  provider: string;
  operation: string;
  target?: string;
  method?: string;
  url?: string;
  status?: number;
  statusText?: string;
  ok?: boolean;
  error?: string;
  responseSnippet?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
}

// ============================================
// 工具函数
// ============================================

/**
 * 去除同步诊断 URL 中的认证信息。保留 host/path，方便定位 Bucket/目录。
 */
export function redactSyncDiagnosticUrl(url?: string): string | undefined {
  if (!url) return undefined;

  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';

    const entries = Array.from(parsed.searchParams.entries());
    parsed.search = '';

    entries.forEach(([key, value]) => {
      parsed.searchParams.set(
        key,
        isSensitiveQueryParam(key) ? '[redacted]' : value.slice(0, 120)
      );
    });

    return parsed.toString();
  } catch {
    return url.slice(0, 300);
  }
}

/**
 * 将底层请求诊断格式化到用户可复制的同步日志里。
 */
export function formatSyncDiagnostic(
  diagnostic: SyncDiagnostic | null | undefined
): string[] {
  if (!diagnostic) return [];

  const lines = ['--- 最近一次请求诊断 ---'];
  pushDiagnosticLine(lines, '服务', diagnostic.provider);
  pushDiagnosticLine(lines, '操作', diagnostic.operation);
  pushDiagnosticLine(lines, '对象', diagnostic.target);
  pushDiagnosticLine(lines, '方法', diagnostic.method);
  pushDiagnosticLine(lines, 'URL', redactSyncDiagnosticUrl(diagnostic.url));

  if (typeof diagnostic.status === 'number') {
    lines.push(
      `HTTP: ${diagnostic.status}${diagnostic.statusText ? ` ${diagnostic.statusText}` : ''}`
    );
  }

  if (typeof diagnostic.ok === 'boolean') {
    lines.push(`请求成功: ${diagnostic.ok ? '是' : '否'}`);
  }

  pushDiagnosticLine(lines, '错误', diagnostic.error);
  pushDiagnosticLine(
    lines,
    '响应片段',
    normalizeDiagnosticText(diagnostic.responseSnippet, 300)
  );

  const detailText = Object.entries(diagnostic.details ?? {})
    .filter(
      ([, value]) => value !== undefined && value !== null && value !== ''
    )
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

  pushDiagnosticLine(lines, '附加信息', detailText);
  lines.push('注: URL 中的签名、Token、Credential 已脱敏');
  return lines;
}

function pushDiagnosticLine(
  lines: string[],
  label: string,
  value: string | number | boolean | undefined
): void {
  if (value === undefined || value === '') return;
  lines.push(`${label}: ${value}`);
}

function normalizeDiagnosticText(
  value: string | undefined,
  limit: number
): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > limit
    ? `${normalized.slice(0, limit)}...`
    : normalized;
}

function isSensitiveQueryParam(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('signature') ||
    normalized.includes('credential') ||
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized === 'accesskeyid' ||
    normalized === 'access_key' ||
    normalized === 'url'
  );
}

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
