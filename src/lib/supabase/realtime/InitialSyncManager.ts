/**
 * 初始同步管理器
 *
 * 职责：执行连接后的初始双向同步
 *
 * 同步策略（基于 CouchDB 复制模型）：
 * 1. 拉取云端所有数据
 * 2. 与本地数据对比（使用 batchResolveConflicts）
 * 3. 决定哪些记录需要上传、下载或删除
 * 4. 执行操作
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { db } from '@/lib/core/db';
import { copyToClipboard } from '@/lib/utils/exportUtils';
import {
  SYNC_TABLES,
  DEFAULT_USER_ID,
  upsertRecords,
  fetchRemoteAllRecords,
  fetchRemoteRecordsByIds,
  fetchRemoteLatestTimestamp,
  uploadSettingsData,
  downloadSettingsData,
  formatSyncOperationDiagnostic,
  type SyncOperationResult,
} from '../syncOperations';
import {
  batchResolveConflicts,
  hydrateLastSyncTime,
  setLastSyncTime,
  extractTimestamp,
} from './conflictResolver';
import { getDbTable } from './dbUtils';
import {
  refreshAllStores,
  refreshSettingsStores,
} from './handlers/StoreNotifier';
import type { RealtimeSyncTable } from './types';
import type { BrewingNote, Method } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  mergeBeansWithStoredImages,
  persistCoffeeBeanImagesFromBean,
} from '@/lib/coffee-beans/imageRepository';
import {
  mergeNotesWithStoredImages,
  persistBrewingNoteImagesFromNote,
} from '@/lib/notes/imageRepository';
import {
  getSyncStatusStore,
  type SupabaseSyncTask,
  type SupabaseSyncTaskStatus,
} from '@/lib/stores/syncStatusStore';

// 网络请求超时时间 (ms)
const SYNC_TIMEOUT = 60000; // 增加到 60s 以适应移动端大文件传输
const DETAIL_DOWNLOAD_IDLE_TIMEOUT = SYNC_TIMEOUT * 2;
const BACKGROUND_SETTINGS_DOWNLOAD_TIMEOUT = 12000;
const SYNC_DIAGNOSTIC_TOAST_DURATION = 8000;
const MAX_DIAGNOSTIC_ERROR_LENGTH = 500;

/**
 * 带超时的 Promise 包装器
 */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMsg: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    ),
  ]);
}

/**
 * 带空闲超时的 Promise 包装器：有进度时刷新计时，只在长时间无进展时失败。
 */
function withIdleTimeout<T>(
  start: (refreshTimeout: () => void) => Promise<T>,
  ms: number,
  errorMsg: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const clearTimer = () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const refreshTimeout = () => {
      if (settled) return;
      clearTimer();
      timeoutId = setTimeout(() => {
        timeoutId = null;
        if (settled) return;
        settled = true;
        reject(new Error(errorMsg));
      }, ms);
    };

    refreshTimeout();

    Promise.resolve()
      .then(() => start(refreshTimeout))
      .then(
        value => {
          if (settled) return;
          settled = true;
          clearTimer();
          resolve(value);
        },
        error => {
          if (settled) return;
          settled = true;
          clearTimer();
          reject(error);
        }
      );
  });
}

/**
 * 同步结果统计
 */
interface SyncStats {
  uploaded: number;
  downloaded: number;
  deleted: number;
}

interface ProgressPatch {
  status?: SupabaseSyncTaskStatus;
  detail?: string;
  completed?: number;
  total?: number;
  uploaded?: number;
  downloaded?: number;
  deleted?: number;
  failed?: number;
  error?: string;
}

type SettingsSyncMode = 'bidirectional' | 'pull-only';

interface InitialSyncOptions {
  settingsMode?: SettingsSyncMode;
  settingsDirty?: boolean;
}

interface SettingsSyncOutcome {
  deferred: boolean;
}

const TABLE_LABELS: Record<string, string> = {
  [SYNC_TABLES.COFFEE_BEANS]: '咖啡豆',
  [SYNC_TABLES.BREWING_NOTES]: '笔记',
  [SYNC_TABLES.CUSTOM_EQUIPMENTS]: '自定义器具',
  [SYNC_TABLES.CUSTOM_METHODS]: '自定义方案',
  [SYNC_TABLES.USER_SETTINGS]: '设置',
};

const INITIAL_SYNC_TASKS = [
  {
    id: SYNC_TABLES.COFFEE_BEANS,
    label: TABLE_LABELS[SYNC_TABLES.COFFEE_BEANS],
  },
  {
    id: SYNC_TABLES.BREWING_NOTES,
    label: TABLE_LABELS[SYNC_TABLES.BREWING_NOTES],
  },
  {
    id: SYNC_TABLES.CUSTOM_EQUIPMENTS,
    label: TABLE_LABELS[SYNC_TABLES.CUSTOM_EQUIPMENTS],
  },
  {
    id: SYNC_TABLES.CUSTOM_METHODS,
    label: TABLE_LABELS[SYNC_TABLES.CUSTOM_METHODS],
  },
  {
    id: SYNC_TABLES.USER_SETTINGS,
    label: TABLE_LABELS[SYNC_TABLES.USER_SETTINGS],
  },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRetryableSyncInterruption(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes('超时') ||
    message.includes('网络') ||
    message.includes('下载设置超时') ||
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('abort') ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('load failed')
  );
}

function hasSyncedData(stats: SyncStats): boolean {
  return stats.uploaded > 0 || stats.downloaded > 0 || stats.deleted > 0;
}

function shouldSilenceBackgroundNoopFailure(params: {
  lastSyncTime: number;
  stats: SyncStats;
}): boolean {
  const progress = getSyncStatusStore().supabaseSyncProgress;
  const failedTasks = progress.tasks.filter(
    task => task.status === 'error' || Boolean(task.error)
  );

  return (
    progress.phase === 'background-sync' &&
    params.lastSyncTime > 0 &&
    !hasSyncedData(params.stats) &&
    failedTasks.length > 0 &&
    failedTasks.every(task =>
      isRetryableSyncInterruption(task.error || task.detail || '')
    )
  );
}

function createAbortableTimeout(ms: number): {
  signal?: AbortSignal;
  cancel: () => void;
  didTimeout: () => boolean;
} {
  if (typeof AbortController === 'undefined') {
    return {
      cancel: () => {},
      didTimeout: () => false,
    };
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, ms);

  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timeoutId),
    didTimeout: () => didTimeout,
  };
}

function getSyncOperationErrorMessage<T>(
  result: SyncOperationResult<T>,
  fallbackMessage: string
): string {
  if (result.diagnostic) {
    return `${fallbackMessage}\n${formatSyncOperationDiagnostic(result.diagnostic)}`;
  }

  return result.error || fallbackMessage;
}

function createSyncOperationError<T>(
  result: SyncOperationResult<T>,
  fallbackMessage: string
): Error {
  return new Error(getSyncOperationErrorMessage(result, fallbackMessage));
}

function getRecordIdForDiagnostic(
  table: RealtimeSyncTable,
  record: unknown
): string {
  if (!record || typeof record !== 'object') return 'unknown';
  const objectRecord = record as Record<string, unknown>;
  const id =
    table === SYNC_TABLES.CUSTOM_METHODS
      ? objectRecord.equipmentId || objectRecord.id
      : objectRecord.id;

  return typeof id === 'string' && id ? id : 'unknown';
}

function describeValueShape(value: unknown): string {
  if (Array.isArray(value)) return `array(length=${value.length})`;
  if (value === null) return 'null';
  if (typeof value !== 'object') return typeof value;

  return `object(keys=${Object.keys(value as Record<string, unknown>)
    .slice(0, 12)
    .join(',')})`;
}

function createLocalDataError(params: {
  table: RealtimeSyncTable;
  operation: string;
  record: unknown;
  index?: number;
  total?: number;
  reason: string;
  cause?: unknown;
}): Error {
  return new Error(
    [
      params.reason,
      `操作: ${params.operation}`,
      `表: ${params.table}`,
      `记录ID: ${getRecordIdForDiagnostic(params.table, params.record)}`,
      typeof params.index === 'number' || typeof params.total === 'number'
        ? `位置: ${params.index ?? '-'} / ${params.total ?? '-'}`
        : null,
      `数据形状: ${describeValueShape(params.record)}`,
      params.cause ? `原始错误: ${getErrorMessage(params.cause)}` : null,
      '判断方向: 云端 data 字段或本地历史数据可能存在结构不兼容、缺少主键、图片字段异常或时间字段异常。',
    ]
      .filter(Boolean)
      .join('\n')
  );
}

function assertValidDownloadedRecords(
  table: RealtimeSyncTable,
  records: unknown[]
): void {
  const invalid = records
    .map((record, index) => ({ record, index }))
    .filter(
      ({ record }) => getRecordIdForDiagnostic(table, record) === 'unknown'
    );

  if (invalid.length === 0) return;

  const first = invalid[0];
  throw createLocalDataError({
    table,
    operation: 'validate-downloaded-record',
    record: first.record,
    index: first.index + 1,
    total: records.length,
    reason: `云端 ${table} 数据格式无效，发现 ${invalid.length} 条缺少有效主键的记录`,
  });
}

async function writeLocalRecordWithDiagnostics<T>(
  table: RealtimeSyncTable,
  record: unknown,
  index: number,
  total: number,
  write: () => Promise<T>
): Promise<T> {
  try {
    return await write();
  } catch (error) {
    throw createLocalDataError({
      table,
      operation: 'write-local-record',
      record,
      index,
      total,
      reason: `写入本地 ${table} 记录失败`,
      cause: error,
    });
  }
}

function truncateDiagnosticValue(value: string): string {
  if (value.length <= MAX_DIAGNOSTIC_ERROR_LENGTH) return value;
  return `${value.slice(0, MAX_DIAGNOSTIC_ERROR_LENGTH)}...`;
}

function formatDiagnosticTime(timestamp?: number): string {
  if (!timestamp) return '无';
  return `${new Date(timestamp).toISOString()} (${timestamp})`;
}

function getBrowserDiagnosticLines(): string[] {
  if (typeof navigator === 'undefined') return [];

  return [
    `在线状态: ${navigator.onLine ? 'online' : 'offline'}`,
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

  if (
    errorText.includes('permission denied') ||
    errorText.includes('row-level security') ||
    errorText.includes('rls') ||
    errorText.includes('42501')
  ) {
    return '可能是 Supabase 表权限或 RLS 策略未按最新初始化 SQL 配置。';
  }

  if (
    errorText.includes('does not exist') ||
    errorText.includes('schema cache') ||
    errorText.includes('could not find') ||
    errorText.includes('pgrst')
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
    errorText.includes('constraint') ||
    errorText.includes('dexie')
  ) {
    return '可能是某条本地或云端历史数据结构不规范，优先看诊断里的表名和记录ID。';
  }

  if (
    errorText.includes('payload') ||
    errorText.includes('too large') ||
    errorText.includes('413') ||
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

function createSyncDiagnostic(params: {
  errorCount: number;
  totalTaskCount: number;
  lastSyncTime: number;
  startedAt: number;
  stats: SyncStats;
}): string {
  const progress = getSyncStatusStore().supabaseSyncProgress;
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
    'Brew Guide Supabase 同步诊断',
    `生成时间: ${new Date().toISOString()}`,
    `同步阶段: ${progress.phase}`,
    `进度消息: ${progress.message || '无'}`,
    `失败项目: ${params.errorCount}/${params.totalTaskCount}`,
    `同步统计: ↑${params.stats.uploaded} ↓${params.stats.downloaded} ×${params.stats.deleted}`,
    `本轮耗时: ${Date.now() - params.startedAt}ms`,
    `上次成功同步: ${formatDiagnosticTime(params.lastSyncTime)}`,
    ...getBrowserDiagnosticLines(),
    `判断方向: ${inferSyncFailureHint(failedTasks)}`,
    '',
    '失败任务:',
    failedTaskText,
    '',
    '全部任务:',
    taskSummary,
  ].join('\n');
}

function createCopyDiagnosticAction(diagnostic: string) {
  return {
    label: '复制诊断',
    onClick: async () => {
      const result = await copyToClipboard(diagnostic);

      if (result.success) {
        showToast({
          type: 'success',
          title: '诊断已复制',
          duration: 2000,
        });
      } else {
        showToast({
          type: 'error',
          title: '复制诊断失败',
          duration: 3000,
        });
      }
    },
  };
}

function assertSyncSuccess<T>(
  result: SyncOperationResult<T>,
  fallbackMessage: string
): asserts result is SyncOperationResult<T> & { success: true } {
  if (!result.success) {
    throw createSyncOperationError(result, fallbackMessage);
  }
}

async function runSyncTasksSequentially<T>(
  tasks: Array<() => Promise<T>>
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];

  for (const task of tasks) {
    try {
      results.push({ status: 'fulfilled', value: await task() });
    } catch (reason) {
      results.push({ status: 'rejected', reason });
    }
  }

  return results;
}

/**
 * 初始同步管理器类
 *
 * 注意：此类设计为每次同步创建新实例，由调用方（RealtimeSyncService）保证不会并发调用
 */
export class InitialSyncManager {
  private client: SupabaseClient;
  private aborted = false;
  private settingsMode: SettingsSyncMode;
  private settingsDirty: boolean;

  constructor(client: SupabaseClient, options: InitialSyncOptions = {}) {
    this.client = client;
    this.settingsMode = options.settingsMode ?? 'bidirectional';
    this.settingsDirty = options.settingsDirty ?? false;
  }

  private updateProgressTask(taskId: string, patch: ProgressPatch): void {
    getSyncStatusStore().updateSupabaseSyncTask(taskId, {
      label: TABLE_LABELS[taskId] || taskId,
      ...patch,
    });
  }

  private async downloadSettingsWithTimeout(
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<SyncOperationResult<number>> {
    const timeout = createAbortableTimeout(timeoutMs);

    try {
      const result = await withTimeout(
        downloadSettingsData(this.client, { signal: timeout.signal }),
        timeoutMs + 1000,
        timeoutMessage
      );

      if (!result.success && timeout.didTimeout()) {
        throw new Error(timeoutMessage);
      }

      return result;
    } catch (error) {
      if (timeout.didTimeout()) {
        throw new Error(timeoutMessage);
      }

      throw error;
    } finally {
      timeout.cancel();
    }
  }

  /**
   * 中止同步（用于断开连接时）
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * 执行完整的初始同步
   */
  async performSync(): Promise<SyncStats> {
    const emptyStats: SyncStats = { uploaded: 0, downloaded: 0, deleted: 0 };
    if (this.aborted) return emptyStats;

    const startTime = Date.now();
    const lastSyncTime = await hydrateLastSyncTime();

    console.log(
      `[InitialSync] 开始同步, lastSync=${lastSyncTime ? new Date(lastSyncTime).toLocaleString() : '首次'}`
    );

    const syncStatusStore = getSyncStatusStore();
    if (!syncStatusStore.supabaseSyncProgress.active) {
      syncStatusStore.startSupabaseSyncProgress(
        lastSyncTime === 0 ? 'initial-sync' : 'background-sync',
        lastSyncTime === 0
          ? '正在初始化 Supabase 数据'
          : '正在同步 Supabase 数据',
        INITIAL_SYNC_TASKS
      );
    }

    // 仅在首次同步时显示提示，避免后台静默同步打扰用户
    // lastSyncTime 为 0 表示首次同步（或数据被重置）
    if (typeof window !== 'undefined' && lastSyncTime === 0) {
      showToast({ type: 'info', title: '正在同步云端数据...', duration: 3000 });
    }

    // iOS Safari 在应用从后台恢复时容易让重叠的 IndexedDB 事务提前失效。
    // 顺序同步表，保留单表失败后继续后续表的容错行为。
    const results = await runSyncTasksSequentially([
      () => this.syncTable(SYNC_TABLES.COFFEE_BEANS, lastSyncTime),
      () => this.syncTable(SYNC_TABLES.BREWING_NOTES, lastSyncTime),
      () => this.syncTable(SYNC_TABLES.CUSTOM_EQUIPMENTS, lastSyncTime),
      () => this.syncTableMethods(lastSyncTime),
    ]);

    // 统计结果
    const stats: SyncStats = { uploaded: 0, downloaded: 0, deleted: 0 };
    let errorCount = 0;
    let settingsDeferred = false;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        stats.uploaded += result.value.uploaded;
        stats.downloaded += result.value.downloaded;
        stats.deleted += result.value.deleted;
      } else {
        errorCount++;
        console.error('[InitialSync] 表同步失败:', result.reason);
      }
    }

    // 同步设置
    try {
      const settingsOutcome = await this.syncSettings();
      settingsDeferred = settingsOutcome.deferred;
    } catch (e) {
      console.error('[InitialSync] 设置同步失败:', e);
      errorCount++;
    }

    const totalTaskCount = results.length + 1;

    // 刷新所有 Store
    console.log('[InitialSync] 刷新所有 Store...');
    await refreshAllStores();

    // 执行烘焙商字段迁移（按需迁移同步下载的数据）
    try {
      const { migrateRoasterField } =
        await import('@/lib/utils/roasterMigration');
      await migrateRoasterField();
    } catch (e) {
      console.error('[InitialSync] 烘焙商字段迁移失败:', e);
    }

    // 强制触发一次全局 UI 更新事件，确保组件重绘
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syncCompleted'));
    }

    // 同步完成提示
    const silenceBackgroundFailure =
      errorCount > 0 &&
      shouldSilenceBackgroundNoopFailure({ lastSyncTime, stats });

    if (typeof window !== 'undefined') {
      if (errorCount > 0 && !silenceBackgroundFailure) {
        // 如果有错误发生
        const diagnostic = createSyncDiagnostic({
          errorCount,
          totalTaskCount,
          lastSyncTime,
          startedAt: startTime,
          stats,
        });
        const action = createCopyDiagnosticAction(diagnostic);

        if (errorCount === totalTaskCount) {
          showToast({
            type: 'error',
            title: '同步失败，请检查网络',
            duration: SYNC_DIAGNOSTIC_TOAST_DURATION,
            action,
          });
        } else {
          showToast({
            type: 'warning',
            title: '部分数据同步失败',
            duration: SYNC_DIAGNOSTIC_TOAST_DURATION,
            action,
          });
        }
      } else if (
        stats.downloaded > 0 ||
        stats.uploaded > 0 ||
        stats.deleted > 0
      ) {
        const parts = [];
        if (stats.downloaded > 0) parts.push(`↓${stats.downloaded}`);
        if (stats.uploaded > 0) parts.push(`↑${stats.uploaded}`);
        if (stats.deleted > 0) parts.push(`×${stats.deleted}`);

        showToast({
          type: 'success',
          title: `同步完成 ${parts.join(' ')}`,
        });

        // 首次实时同步如果下载了云端数据，立即刷新应用，确保所有页面与缓存状态一致
        if (lastSyncTime === 0 && stats.downloaded > 0) {
          window.location.reload();
        }
      } else {
        // 仅在首次同步时显示“数据已是最新”，避免日常使用中频繁打扰
        if (lastSyncTime === 0) {
          showToast({ type: 'success', title: '数据已是最新' });
        }
      }
    }

    if (silenceBackgroundFailure) {
      console.warn('[InitialSync] 后台无变更同步遇到可重试错误，已静默跳过');
      syncStatusStore.resetSupabaseSyncProgress();
      return stats;
    }

    // 只有整轮同步全部成功才更新时间戳，避免失败表在下次同步中被跳过
    if (errorCount === 0 && !settingsDeferred) {
      const now = Date.now();
      setLastSyncTime(now);
    }

    console.log(
      `[InitialSync] 完成 (${Date.now() - startTime}ms): ↑${stats.uploaded} ↓${stats.downloaded} ×${stats.deleted}, Errors: ${errorCount}`
    );

    if (errorCount > 0) {
      throw new Error(`Supabase 同步未完全完成，失败项目 ${errorCount} 个`);
    }

    return stats;
  }

  /**
   * 同步单个表
   */
  private async syncTable(
    table: RealtimeSyncTable,
    lastSyncTime: number
  ): Promise<SyncStats> {
    try {
      this.updateProgressTask(table, {
        status: 'preparing',
        detail: '读取本地数据',
      });

      const dbTable = getDbTable(table);

      // 获取本地和云端数据
      const localRecords = await dbTable.toArray();

      this.updateProgressTask(table, {
        status: 'fetching',
        detail: '拉取云端索引',
        total: localRecords.length,
      });

      // 增加超时控制
      // 优化：只拉取元数据 (id, updated_at, deleted_at)，不拉取 data
      // 这样可以极大减少初始请求的大小，避免超时
      const remoteMetaResult = await withTimeout(
        fetchRemoteAllRecords(this.client, table, 'id, updated_at, deleted_at'),
        SYNC_TIMEOUT,
        `拉取 ${table} 元数据超时`
      );

      if (!remoteMetaResult.success) {
        console.error(
          `[InitialSync] ${table} 拉取失败:`,
          remoteMetaResult.error
        );
        throw createSyncOperationError(remoteMetaResult, `拉取 ${table} 失败`);
      }

      const remoteMetaRecords = (remoteMetaResult.data || []).map(r => ({
        id: r.id,
        user_id: DEFAULT_USER_ID,
        data: null as any, // 暂时没有 data
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
      }));

      this.updateProgressTask(table, {
        status: 'fetching',
        detail: `已读取 ${remoteMetaRecords.length} 条云端索引`,
        total: Math.max(localRecords.length, remoteMetaRecords.length),
        completed: 0,
      });

      // 调试日志：检查拉取到的数据量
      if (remoteMetaRecords.length > 0) {
        console.log(
          `[InitialSync] ${table} 拉取到 ${remoteMetaRecords.length} 条元数据`
        );
      } else if (localRecords.length > 0) {
        console.warn(
          `[InitialSync] ${table} 本地有 ${localRecords.length} 条记录，但云端索引为 0。若不是首次同步或空云端，可能是 Supabase SELECT/RLS/Data API 配置导致客户端读不到已上传数据。`
        );
      }

      // 预处理：找出需要下载完整数据的记录 ID
      // 逻辑：如果远程记录比本地新（或本地不存在），且未删除，则需要下载 data
      const idsToDownload: string[] = [];
      const localMap = new Map(
        localRecords.map(r => {
          // 处理 customMethods 表的特殊情况：它使用 equipmentId 作为唯一标识
          const id =
            table === SYNC_TABLES.CUSTOM_METHODS
              ? (r as { equipmentId: string }).equipmentId
              : (r as { id: string }).id;
          return [id, r];
        })
      );

      for (const remote of remoteMetaRecords) {
        if (remote.deleted_at) continue; // 已删除的不需要下载 data

        const local = localMap.get(remote.id);
        const remoteTime = extractTimestamp(remote);

        if (!local) {
          // 本地不存在 -> 需要下载（云端新增）
          idsToDownload.push(remote.id);
        } else {
          const localTime = extractTimestamp(
            local as { id: string; timestamp?: number; updatedAt?: number }
          );
          // 远程比本地新 -> 需要下载
          if (remoteTime > localTime) {
            idsToDownload.push(remote.id);
          }
        }
      }

      // 调试日志：汇总需要下载的记录数量
      if (idsToDownload.length > 0) {
        console.log(
          `[InitialSync] ${table} 需要下载 ${idsToDownload.length} 条记录`
        );
      }

      // 批量下载需要的数据
      const downloadedDataMap = new Map<string, any>();
      if (idsToDownload.length > 0) {
        this.updateProgressTask(table, {
          status: 'downloading',
          detail: `下载 ${idsToDownload.length} 条云端记录`,
          total: idsToDownload.length,
          completed: 0,
        });

        console.log(
          `[InitialSync] ${table} 需要下载 ${idsToDownload.length} 条完整记录`
        );
        const fetchResult = await withIdleTimeout(
          refreshDownloadTimeout =>
            fetchRemoteRecordsByIds(this.client, table, idsToDownload, {
              onProgress: (downloadedCount, totalCount) => {
                refreshDownloadTimeout();
                this.updateProgressTask(table, {
                  status: 'downloading',
                  detail: `已下载 ${downloadedCount}/${totalCount} 条云端记录`,
                  total: totalCount,
                  completed: downloadedCount,
                  downloaded: downloadedCount,
                });
              },
            }),
          DETAIL_DOWNLOAD_IDLE_TIMEOUT,
          `下载 ${table} 详情超时（${DETAIL_DOWNLOAD_IDLE_TIMEOUT / 1000} 秒内无进度）`
        );

        if (fetchResult.success && fetchResult.data) {
          fetchResult.data.forEach(item => {
            downloadedDataMap.set(item.id, item.data);
          });
          this.updateProgressTask(table, {
            status: 'downloading',
            detail: `已下载 ${downloadedDataMap.size} 条云端记录`,
            total: idsToDownload.length,
            completed: downloadedDataMap.size,
            downloaded: downloadedDataMap.size,
          });
        } else {
          console.error(
            `[InitialSync] ${table} 下载详情失败:`,
            fetchResult.error
          );
          // 下载失败时中止本表同步，避免后续误将本地旧数据上传覆盖云端
          throw createSyncOperationError(fetchResult, `下载 ${table} 详情失败`);
        }

        const missingIds = idsToDownload.filter(
          id => !downloadedDataMap.has(id)
        );
        if (missingIds.length > 0) {
          console.error(
            `[InitialSync] ${table} 详情下载不完整，缺失 ${missingIds.length} 条记录`
          );
          // 关键保护：详情缺失时不继续冲突解决，防止把旧本地数据误判为“云端不存在”
          throw new Error(
            [
              `下载 ${table} 详情不完整`,
              `操作: verify-downloaded-records`,
              `表: ${table}`,
              `缺失数量: ${missingIds.length}`,
              `缺失ID样本: ${missingIds.slice(0, 10).join(', ')}`,
              `应下载数量: ${idsToDownload.length}`,
              `实际下载数量: ${downloadedDataMap.size}`,
            ].join('\n')
          );
        }
      }

      // 组装完整的 remoteRecords
      const remoteRecords = remoteMetaRecords.map(r => {
        if (downloadedDataMap.has(r.id)) {
          const data = downloadedDataMap.get(r.id);
          // PATCH: 确保数据的修改时间不小于 updated_at
          // 这防止了因数据时间戳滞后于 updated_at 导致无限循环下载
          // 注意：对于 BrewingNote，应该更新 updatedAt 而不是 timestamp（创建时间）
          if (data) {
            const updatedAtTime = new Date(r.updated_at).getTime();
            if ('updatedAt' in data || table === SYNC_TABLES.BREWING_NOTES) {
              // BrewingNote: 更新 updatedAt，保留 timestamp（创建时间）
              data.updatedAt = Math.max(data.updatedAt || 0, updatedAtTime);
            } else {
              // CoffeeBean 等其他类型: 更新 timestamp
              data.timestamp = Math.max(data.timestamp || 0, updatedAtTime);
            }
          }
          return { ...r, data };
        }
        return r;
      });

      // 冲突解决
      const { toUpload, toDownload, toDeleteLocal } = batchResolveConflicts(
        localRecords as { id: string; timestamp?: number }[],
        remoteRecords,
        lastSyncTime
      );

      // 执行上传
      if (toUpload.length > 0) {
        this.updateProgressTask(table, {
          status: 'uploading',
          detail: `上传 ${toUpload.length} 条本地记录`,
          total: toUpload.length,
          completed: 0,
        });

        const recordsForUpload =
          table === SYNC_TABLES.COFFEE_BEANS
            ? await mergeBeansWithStoredImages(toUpload as CoffeeBean[])
            : table === SYNC_TABLES.BREWING_NOTES
              ? await mergeNotesWithStoredImages(toUpload as BrewingNote[])
              : toUpload;

        const uploadResult = await upsertRecords(
          this.client,
          table,
          recordsForUpload,
          record => ({
            id: record.id,
            data: record,
            updated_at: new Date(
              (record as { updatedAt?: number; timestamp?: number })
                .updatedAt ||
                (record as { timestamp?: number }).timestamp ||
                Date.now()
            ).toISOString(),
          }),
          {
            onProgress: (uploadedCount, totalCount) => {
              this.updateProgressTask(table, {
                status: 'uploading',
                detail: `已上传 ${uploadedCount}/${totalCount} 条本地记录`,
                total: totalCount,
                completed: uploadedCount,
                uploaded: uploadedCount,
              });
            },
          }
        );
        assertSyncSuccess(uploadResult, `上传 ${table} 失败`);

        this.updateProgressTask(table, {
          status: 'uploading',
          detail: `已上传 ${uploadResult.affectedCount} 条本地记录`,
          total: toUpload.length,
          completed: uploadResult.affectedCount,
          uploaded: uploadResult.affectedCount,
        });
      }

      // 执行下载
      if (toDownload.length > 0) {
        this.updateProgressTask(table, {
          status: 'writing',
          detail: `写入 ${toDownload.length} 条云端记录`,
          total: toDownload.length,
          completed: 0,
        });

        assertValidDownloadedRecords(table, toDownload);
        const validRecords = toDownload;

        if (validRecords.length > 0) {
          console.warn(
            `[InitialSync] ${table} 写入 ${validRecords.length} 条记录到本地 DB`
          );
          if (table === SYNC_TABLES.COFFEE_BEANS) {
            const recordsForStore: CoffeeBean[] = [];

            for (let index = 0; index < validRecords.length; index++) {
              const record = validRecords[index] as CoffeeBean;
              const beanForStore = await writeLocalRecordWithDiagnostics(
                table,
                record,
                index + 1,
                validRecords.length,
                () =>
                  persistCoffeeBeanImagesFromBean(record, {
                    generateThumbnails: false,
                  })
              );
              recordsForStore.push(beanForStore);
            }

            await db.coffeeBeans.bulkPut(recordsForStore);
          } else if (table === SYNC_TABLES.BREWING_NOTES) {
            const recordsForStore: BrewingNote[] = [];

            for (let index = 0; index < validRecords.length; index++) {
              const record = validRecords[index] as BrewingNote;
              const noteForStore = await writeLocalRecordWithDiagnostics(
                table,
                record,
                index + 1,
                validRecords.length,
                () =>
                  persistBrewingNoteImagesFromNote(record, {
                    generateThumbnails: false,
                  })
              );
              recordsForStore.push(noteForStore);
            }

            await db.brewingNotes.bulkPut(recordsForStore);
          } else {
            const bulkPut = dbTable.bulkPut.bind(dbTable) as (
              items: unknown[]
            ) => Promise<unknown>;
            await bulkPut(validRecords);
          }
        }

        this.updateProgressTask(table, {
          status: 'writing',
          detail: `已写入 ${validRecords.length} 条云端记录`,
          total: toDownload.length,
          completed: validRecords.length,
          downloaded: validRecords.length,
        });
      }

      // 执行本地删除
      if (toDeleteLocal.length > 0) {
        console.log(
          `[InitialSync] ${table} 删除 ${toDeleteLocal.length} 条本地记录`
        );
        await dbTable.bulkDelete(toDeleteLocal);
        if (table === SYNC_TABLES.COFFEE_BEANS) {
          await db.coffeeBeanImages.bulkDelete(toDeleteLocal);
          await db.coffeeBeanImageThumbnails.bulkDelete(toDeleteLocal);
        } else if (table === SYNC_TABLES.BREWING_NOTES) {
          await db.brewingNoteImages.bulkDelete(toDeleteLocal);
          await db.brewingNoteImageThumbnails.bulkDelete(toDeleteLocal);
        }
      }

      this.updateProgressTask(table, {
        status: 'success',
        detail: `完成 ↑${toUpload.length} ↓${toDownload.length} ×${toDeleteLocal.length}`,
        uploaded: toUpload.length,
        downloaded: toDownload.length,
        deleted: toDeleteLocal.length,
      });

      return {
        uploaded: toUpload.length,
        downloaded: toDownload.length,
        deleted: toDeleteLocal.length,
      };
    } catch (error) {
      console.error(`[InitialSync] ${table} 同步失败:`, error);
      this.updateProgressTask(table, {
        status: 'error',
        detail: '同步失败',
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * 同步方案表（特殊处理）
   */
  private async syncTableMethods(lastSyncTime: number): Promise<SyncStats> {
    try {
      this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
        status: 'preparing',
        detail: '读取本地方案',
      });

      // 获取本地方案
      const localRecords = await db.customMethods.toArray();
      const localWithId = localRecords.map(r => {
        const maxTimestamp = Math.max(
          0,
          ...r.methods.map(m => m.timestamp || 0)
        );
        // DEBUG: 打印本地记录的时间戳详情
        // console.log(`[Debug] Local Method ${r.equipmentId}: maxTimestamp=${maxTimestamp}`);
        return {
          id: r.equipmentId,
          equipmentId: r.equipmentId,
          methods: r.methods,
          timestamp: maxTimestamp,
        };
      });

      // 获取云端方案
      // 增加超时控制
      this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
        status: 'fetching',
        detail: '拉取云端方案',
        total: localRecords.length,
      });

      const remoteResult = await withTimeout(
        fetchRemoteAllRecords<{
          equipmentId: string;
          methods: Method[];
        }>(this.client, SYNC_TABLES.CUSTOM_METHODS),
        SYNC_TIMEOUT,
        `拉取 custom_methods 超时`
      );

      if (!remoteResult.success) {
        console.error(
          `[InitialSync] custom_methods 拉取失败:`,
          remoteResult.error
        );
        throw createSyncOperationError(
          remoteResult,
          '拉取 custom_methods 失败'
        );
      }

      const remoteRecords = (remoteResult.data || []).map(r => {
        const methodsValue = (r.data as { methods?: unknown })?.methods;
        if (methodsValue !== undefined && !Array.isArray(methodsValue)) {
          throw createLocalDataError({
            table: SYNC_TABLES.CUSTOM_METHODS,
            operation: 'validate-remote-custom-methods',
            record: {
              id: r.id,
              equipmentId: r.id,
              methods: methodsValue,
            },
            reason: `云端 custom_methods 数据格式无效，data.methods 应为数组，实际为 ${describeValueShape(methodsValue)}`,
          });
        }

        const methods = methodsValue || [];
        const updatedAtTime = new Date(r.updated_at).getTime();

        // PATCH: 确保 methods 中的每个 method 都有 timestamp，且不小于 updated_at
        // 这防止了因 methods 时间戳滞后于 updated_at 导致计算出的 localTime 偏小，从而无限循环下载
        const patchedMethods = methods.map(m => ({
          ...m,
          timestamp: Math.max(m.timestamp || 0, updatedAtTime),
        }));

        // DEBUG: 检查远程记录的时间戳差异
        // const maxMethodTime = Math.max(0, ...patchedMethods.map(m => m.timestamp || 0));
        // if (updatedAtTime > maxMethodTime) {
        //   console.log(`[Debug] Remote Method ${r.id}: updatedAt(${updatedAtTime}) > maxMethodTime(${maxMethodTime})`);
        // }

        return {
          id: r.id,
          user_id: DEFAULT_USER_ID,
          data: {
            id: r.id,
            equipmentId: r.id,
            methods: patchedMethods,
            timestamp: 0,
          },
          updated_at: r.updated_at,
          deleted_at: r.deleted_at,
        };
      });

      this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
        status: 'fetching',
        detail: `已读取 ${(remoteResult.data || []).length} 条云端方案`,
        total: Math.max(localRecords.length, (remoteResult.data || []).length),
        completed: 0,
      });

      // 冲突解决
      const { toUpload, toDownload, toDeleteLocal } = batchResolveConflicts(
        localWithId,
        remoteRecords,
        lastSyncTime
      );

      if (toDownload.length > 0) {
        console.log(
          `[InitialSync] custom_methods 需下载 ${toDownload.length} 条记录`
        );
        toDownload.forEach(item => {
          // 查找对应的远程记录以获取更多调试信息
          const remote = remoteRecords.find(r => r.id === item.equipmentId);
          const local = localWithId.find(l => l.id === item.equipmentId);

          const remoteUpdatedAt = remote
            ? new Date(remote.updated_at).getTime()
            : 'N/A';
          const localTimestamp = local ? local.timestamp : 'N/A';

          console.log(
            `[InitialSync] custom_methods 下载详情: ${item.equipmentId} | Remote UpdatedAt: ${remoteUpdatedAt} | Local MaxTimestamp: ${localTimestamp}`
          );
        });
      }

      // 执行上传
      if (toUpload.length > 0) {
        this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
          status: 'uploading',
          detail: `上传 ${toUpload.length} 条本地方案`,
          total: toUpload.length,
          completed: 0,
        });

        const uploadResult = await upsertRecords(
          this.client,
          SYNC_TABLES.CUSTOM_METHODS,
          toUpload,
          r => ({
            id: r.id,
            data: { equipmentId: r.equipmentId, methods: r.methods },
            updated_at: new Date().toISOString(),
          }),
          {
            onProgress: (uploadedCount, totalCount) => {
              this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
                status: 'uploading',
                detail: `已上传 ${uploadedCount}/${totalCount} 条本地方案`,
                total: totalCount,
                completed: uploadedCount,
                uploaded: uploadedCount,
              });
            },
          }
        );
        assertSyncSuccess(uploadResult, '上传 custom_methods 失败');

        this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
          status: 'uploading',
          detail: `已上传 ${uploadResult.affectedCount} 条本地方案`,
          total: toUpload.length,
          completed: uploadResult.affectedCount,
          uploaded: uploadResult.affectedCount,
        });
      }

      // 执行下载
      if (toDownload.length > 0) {
        this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
          status: 'writing',
          detail: `写入 ${toDownload.length} 条云端方案`,
          total: toDownload.length,
          completed: 0,
        });

        assertValidDownloadedRecords(SYNC_TABLES.CUSTOM_METHODS, toDownload);

        const recordsForStore = toDownload.map(item => ({
          equipmentId: item.equipmentId,
          methods: item.methods,
        }));
        await db.customMethods.bulkPut(recordsForStore);

        this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
          status: 'writing',
          detail: `已写入 ${toDownload.length} 条云端方案`,
          total: toDownload.length,
          completed: toDownload.length,
          downloaded: toDownload.length,
        });
      }

      // 执行本地删除
      if (toDeleteLocal.length > 0) {
        await db.customMethods.bulkDelete(toDeleteLocal);
      }

      this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
        status: 'success',
        detail: `完成 ↑${toUpload.length} ↓${toDownload.length} ×${toDeleteLocal.length}`,
        uploaded: toUpload.length,
        downloaded: toDownload.length,
        deleted: toDeleteLocal.length,
      });

      return {
        uploaded: toUpload.length,
        downloaded: toDownload.length,
        deleted: toDeleteLocal.length,
      };
    } catch (error) {
      console.error(`[InitialSync] custom_methods 同步失败:`, error);
      this.updateProgressTask(SYNC_TABLES.CUSTOM_METHODS, {
        status: 'error',
        detail: '同步失败',
        error: getErrorMessage(error),
      });
      throw error;
    }
  }

  /**
   * 同步设置（双向）
   */
  private async syncSettings(): Promise<SettingsSyncOutcome> {
    try {
      this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
        status: 'fetching',
        detail: '检查云端设置',
      });

      const lastSyncTime = await hydrateLastSyncTime();

      const remoteResult = await withTimeout(
        fetchRemoteLatestTimestamp(this.client, SYNC_TABLES.USER_SETTINGS),
        SYNC_TIMEOUT,
        '获取设置时间戳超时'
      );

      assertSyncSuccess(remoteResult, '获取设置时间戳失败');

      const remoteTimestamp = remoteResult.data || 0;
      const settingsMode =
        lastSyncTime === 0 ? 'bidirectional' : this.settingsMode;

      // 首次同步特殊处理：
      // - 云端有设置：下载
      // - 云端无设置：上传本地设置（uploadSettingsData 内部有空数据保护）
      if (lastSyncTime === 0) {
        if (remoteTimestamp > 0) {
          this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
            status: 'downloading',
            detail: '下载云端设置',
          });

          const result = await this.downloadSettingsWithTimeout(
            SYNC_TIMEOUT,
            '下载设置超时'
          );
          assertSyncSuccess(result, '下载设置失败');
          await refreshSettingsStores();
          this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
            status: 'success',
            detail: `已下载 ${result.affectedCount} 项设置`,
            downloaded: result.affectedCount,
          });
        } else {
          this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
            status: 'uploading',
            detail: '上传本地设置',
          });

          const result = await withTimeout(
            uploadSettingsData(this.client, { skipIfUnchanged: true }),
            SYNC_TIMEOUT,
            '上传设置超时'
          );
          assertSyncSuccess(result, '上传设置失败');
          this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
            status: 'success',
            detail:
              result.affectedCount > 0
                ? `已上传 ${result.affectedCount} 项设置`
                : '没有需要上传的设置',
            uploaded: result.affectedCount,
          });
        }
        return { deferred: false };
      }

      if (remoteTimestamp > lastSyncTime) {
        if (settingsMode === 'bidirectional' && this.settingsDirty) {
          this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
            status: 'uploading',
            detail: '上传本地设置',
          });

          const result = await withTimeout(
            uploadSettingsData(this.client, { skipIfUnchanged: true }),
            SYNC_TIMEOUT,
            '上传设置超时'
          );
          assertSyncSuccess(result, '上传设置失败');
          this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
            status: 'success',
            detail:
              result.affectedCount > 0
                ? `已上传 ${result.affectedCount} 项设置`
                : '没有需要上传的设置',
            uploaded: result.affectedCount,
          });
          return { deferred: false };
        }

        // 云端更新，下载
        this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
          status: 'downloading',
          detail: '下载云端设置',
        });

        const timeoutMs =
          settingsMode === 'pull-only'
            ? BACKGROUND_SETTINGS_DOWNLOAD_TIMEOUT
            : SYNC_TIMEOUT;

        try {
          const result = await this.downloadSettingsWithTimeout(
            timeoutMs,
            '下载设置超时'
          );
          assertSyncSuccess(result, '下载设置失败');
          await refreshSettingsStores();
          this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
            status: 'success',
            detail: `已下载 ${result.affectedCount} 项设置`,
            downloaded: result.affectedCount,
          });
          return { deferred: false };
        } catch (error) {
          if (
            settingsMode === 'pull-only' &&
            isRetryableSyncInterruption(error)
          ) {
            console.warn('[InitialSync] 后台设置下载已延后:', error);
            this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
              status: 'warning',
              detail: '远端设置下载超时，已延后',
              failed: 1,
            });
            return { deferred: true };
          }

          throw error;
        }
      } else if (settingsMode === 'pull-only') {
        this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
          status: 'success',
          detail: '设置无远端更新',
        });
        return { deferred: false };
      } else {
        // 本地更新，上传
        this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
          status: 'uploading',
          detail: '上传本地设置',
        });

        const result = await withTimeout(
          uploadSettingsData(this.client, { skipIfUnchanged: true }),
          SYNC_TIMEOUT,
          '上传设置超时'
        );
        assertSyncSuccess(result, '上传设置失败');
        this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
          status: 'success',
          detail:
            result.affectedCount > 0
              ? `已上传 ${result.affectedCount} 项设置`
              : '没有需要上传的设置',
          uploaded: result.affectedCount,
        });
      }

      return { deferred: false };
    } catch (error) {
      console.error('[InitialSync] 设置同步失败:', error);
      this.updateProgressTask(SYNC_TABLES.USER_SETTINGS, {
        status: 'error',
        detail: '同步失败',
        error: getErrorMessage(error),
      });
      throw error;
    }
  }
}
