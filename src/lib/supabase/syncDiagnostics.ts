import { BUILD_INFO } from '@/lib/core/buildInfo';
import type {
  SupabaseSyncProgress,
  SupabaseSyncTask,
} from '@/lib/stores/syncStatusStore';

const MAX_DIAGNOSTIC_TEXT_LENGTH = 4000;
const MAX_EVENTS = 80;
const events: string[] = [];
const importantEvents: string[] = [];

/** Keep only structural context; PostgreSQL details can contain an entire private row. */
export function sanitizeDiagnosticText(text: string): string {
  return text
    .replace(
      /Failing row contains[^\r\n]*/gi,
      'Failing row contains [已隐藏记录内容]'
    )
    .replace(/(Key \([^)]+\)\s*=\s*)\([^\r\n]*\)/gi, '$1([已隐藏字段值])')
    .replace(
      /(invalid input syntax for [^\r\n:]+:\s*)[^\r\n]*/gi,
      '$1"[已隐藏字段值]"'
    )
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [已隐藏]')
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[已隐藏 JWT]'
    )
    .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '[已隐藏 Key]')
    .replace(/https?:\/\/[^\s<>"']+/gi, '[已隐藏 URL]');
}

export function recordSupabaseDiagnosticEvent(
  event: string,
  important = false
): void {
  const entry = `${new Date().toISOString()} ${sanitizeDiagnosticText(event).slice(0, MAX_DIAGNOSTIC_TEXT_LENGTH)}`;
  events.push(entry);
  if (important) {
    importantEvents.push(entry);
    if (importantEvents.length > 10) importantEvents.shift();
  }
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

function getSupabaseDiagnosticEvents(): string[] {
  const recent = events.filter(event => !importantEvents.includes(event));
  return recent.length ? recent : ['无其他操作记录'];
}

export function clearSupabaseDiagnosticEvents(): void {
  events.length = 0;
  importantEvents.length = 0;
}

/** Describe field types and array lengths without logging values or traversing records. */
export function describeSyncPayload(payload: Record<string, unknown>): string {
  const shape = (value: unknown): string => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return `array(length=${value.length})`;
    return typeof value;
  };
  const fields = Object.entries(payload)
    .slice(0, 24)
    .map(([key, value]) => {
      if (
        key === 'data' &&
        value &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        return `data:{${Object.entries(value)
          .slice(0, 24)
          .map(([field, entry]) => `${field}:${shape(entry)}`)
          .join(', ')}}`;
      }
      return `${key}:${shape(value)}`;
    });
  return fields.join(', ');
}

/** Observe HTTP outcomes without reading bodies, auth headers, URLs or query values. */
export const diagnosticSupabaseFetch: typeof fetch = async (input, init) => {
  const startedAt = Date.now();
  const rawUrl =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  let table = 'unknown';
  try {
    const match = new URL(rawUrl).pathname.match(
      /\/rest\/v1\/(coffee_beans|brewing_notes|custom_equipments|custom_methods|user_settings)$/
    );
    table = match?.[1] || 'other';
  } catch {
    /* URL validation remains the client's responsibility. */
  }
  const method =
    init?.method ||
    (typeof Request !== 'undefined' && input instanceof Request
      ? input.method
      : 'GET');
  try {
    const response = await fetch(input, init);
    recordSupabaseDiagnosticEvent(
      `HTTP ${method} ${table} status=${response.status} duration=${Date.now() - startedAt}ms`
    );
    return response;
  } catch (error) {
    recordSupabaseDiagnosticEvent(
      `HTTP ${method} ${table} 无响应 duration=${Date.now() - startedAt}ms cause=${error instanceof Error ? error.name : 'unknown'}`
    );
    throw error;
  }
};

function truncateDiagnosticValue(value: string): string {
  value = sanitizeDiagnosticText(value);
  if (value.length <= MAX_DIAGNOSTIC_TEXT_LENGTH) return value;
  return `${value.slice(0, MAX_DIAGNOSTIC_TEXT_LENGTH)}... [已截断]`;
}

function formatDiagnosticTime(timestamp?: number): string {
  if (!timestamp) return '无';
  return `${new Date(timestamp).toISOString()} (${timestamp})`;
}

function getBrowserDiagnosticLines(): string[] {
  if (typeof navigator === 'undefined') return [];

  return [
    `在线状态: ${navigator.onLine ? 'online' : 'offline'}`,
    `页面可见性: ${typeof document === 'undefined' ? 'unknown' : document.visibilityState}`,
    `User-Agent: ${navigator.userAgent}`,
  ];
}

function inferSyncFailureHint(tasks: SupabaseSyncTask[]): string {
  const errorText = tasks
    .map(task => task.error || task.detail || '')
    .join('\n')
    .toLowerCase();

  if (!errorText) {
    return '暂无错误明细，请结合控制台日志查看。';
  }

  // Prefer the final server code over record IDs or an earlier compatibility attempt.
  const serverCodes = Array.from(
    errorText.matchAll(/supabase\/postgrest code:\s*([a-z0-9]+)/g),
    match => match[1]
  );
  const hasCode = (code: string) =>
    serverCodes.length
      ? serverCodes.includes(code)
      : new RegExp(`\\b${code}\\b`).test(errorText);

  if (hasCode('23502') || errorText.includes('not-null constraint')) {
    return '数据库已响应，但上传被非空约束拒绝。检查云端要求的列与实际上传字段是否一致；不代表连接失败或本地记录损坏。';
  }

  if (hasCode('23503')) {
    return '数据库拒绝写入：外键引用不存在，检查关联记录及上传顺序。';
  }

  if (hasCode('23505')) {
    return '数据库拒绝写入：唯一键冲突，检查云端唯一约束与 upsert 冲突键。';
  }

  if (
    hasCode('401') ||
    errorText.includes('invalid api key') ||
    errorText.includes('jwt')
  ) {
    return '请求认证失败，检查 Supabase Key 及其有效性。';
  }

  if (
    errorText.includes('permission denied') ||
    errorText.includes('row-level security') ||
    errorText.includes('rls') ||
    hasCode('42501')
  ) {
    return '可能是 Supabase 表权限或 RLS 策略未按最新初始化 SQL 配置。';
  }

  if (
    errorText.includes('does not exist') ||
    errorText.includes('schema cache') ||
    errorText.includes('could not find') ||
    hasCode('pgrst204') ||
    hasCode('pgrst205')
  ) {
    return '可能是 Supabase 表结构、字段或 Data API 暴露配置不是最新版。';
  }

  if (
    errorText.includes('timeout') ||
    errorText.includes('timed out') ||
    errorText.includes('network') ||
    errorText.includes('failed to fetch')
  ) {
    return '可能是网络波动或 Supabase 请求超时。';
  }

  if (
    errorText.includes('in-progress transaction') ||
    errorText.includes('indexeddb') ||
    errorText.includes('unknownerror')
  ) {
    return '可能是浏览器本地 IndexedDB 事务在后台恢复时失效，可优先检查本地读写事务。';
  }

  if (
    errorText.includes('数据格式无效') ||
    errorText.includes('写入本地') ||
    errorText.includes('invalid time value') ||
    errorText.includes('datacloneerror') ||
    errorText.includes('dexie')
  ) {
    return '可能是某条本地或云端历史数据结构不规范，优先看诊断里的表名和记录ID。';
  }

  if (
    errorText.includes('payload') ||
    errorText.includes('too large') ||
    hasCode('413') ||
    errorText.includes('request entity')
  ) {
    return '可能是单条记录内容过大，例如图片或备注字段进入了同步 data。';
  }

  return '请根据失败任务的原始错误定位。';
}

function formatDiagnosticTask(task: SupabaseSyncTask): string {
  return [
    `${task.label} (${task.id})`,
    `  状态: ${task.status}`,
    task.error ? `  判断方向: ${inferSyncFailureHint([task])}` : null,
    task.detail ? `  阶段: ${task.detail}` : null,
    typeof task.completed === 'number' || typeof task.total === 'number'
      ? `  进度: ${task.completed ?? '-'} / ${task.total ?? '-'}`
      : null,
    task.uploaded || task.downloaded || task.deleted || task.failed
      ? `  统计: ↑${task.uploaded ?? 0} ↓${task.downloaded ?? 0} ×${task.deleted ?? 0} 失败${task.failed ?? 0}`
      : null,
    task.error ? `  错误: ${truncateDiagnosticValue(task.error)}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function createSupabaseSyncDiagnostic(params: {
  progress: SupabaseSyncProgress;
  connectionStatus: string;
  pendingChangesCount: number;
  errorCount: number;
  totalTaskCount: number;
  lastSyncTime: number;
  startedAt: number;
  stats: { uploaded: number; downloaded: number; deleted: number };
}): string {
  const { progress } = params;
  const failedTasks = progress.tasks.filter(
    task => task.status === 'error' || Boolean(task.error)
  );
  const taskSummary =
    progress.tasks.length > 0
      ? progress.tasks
          .map(
            task =>
              `${task.label}:${task.status}${task.detail ? `(${task.detail})` : ''}`
          )
          .join(' | ')
      : '无任务记录';

  const failedTaskText =
    failedTasks.length > 0
      ? failedTasks.map(formatDiagnosticTask).join('\n\n')
      : '无失败任务明细';

  return [
    'Brew Guide Supabase 同步诊断 v2',
    `应用版本: ${BUILD_INFO.appVersion}`,
    `构建提交: ${BUILD_INFO.gitSha}`,
    `构建时间: ${BUILD_INFO.buildTime}`,
    `实时连接: ${params.connectionStatus}（仅表示订阅状态，写入结果见下方）`,
    `离线待同步: ${params.pendingChangesCount}`,
    '日志范围: 当前应用会话最近 80 项操作及 10 项重要事件；仅记录字段结构，数据库行详情和凭据已脱敏。',
    `生成时间: ${new Date().toISOString()}`,
    `同步阶段: ${progress.phase}`,
    `进度消息: ${progress.message || '无'}`,
    `失败项目: ${params.errorCount}/${params.totalTaskCount}`,
    `同步统计: ↑${params.stats.uploaded} ↓${params.stats.downloaded} ×${params.stats.deleted}`,
    `本轮耗时: ${Date.now() - params.startedAt}ms`,
    `上次成功同步: ${formatDiagnosticTime(params.lastSyncTime)}`,
    ...getBrowserDiagnosticLines(),
    '',
    '失败任务:',
    failedTaskText,
    '',
    '全部任务:',
    taskSummary,
    '',
    '最近错误与兼容处理（独立保留最近 10 项）:',
    ...(importantEvents.length ? importantEvents : ['无']),
    '',
    '最近操作（按完成时间排序，可能包含此前同步）:',
    ...getSupabaseDiagnosticEvents(),
  ]
    .map(line => sanitizeDiagnosticText(line))
    .join('\n');
}
