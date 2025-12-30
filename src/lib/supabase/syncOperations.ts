/**
 * Supabase 同步操作模块
 *
 * 设计原则（参考 CouchDB 复制模型 + RxDB 离线优先架构）:
 * 1. 软删除（Tombstone）：删除操作通过设置 deleted_at 实现，而不是物理删除
 * 2. 幂等性：相同操作多次执行结果一致
 * 3. 原子性：每个操作要么完全成功，要么完全失败
 *
 * 参考文档:
 * - CouchDB Replication: https://docs.couchdb.org/en/stable/replication/conflicts.html
 * - RxDB Offline-First: https://rxdb.info/offline-first.html
 * - Supabase Soft Delete: https://supabase.com/docs/guides/database/tables
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { db, AppSettings } from '@/lib/core/db';

// ============================================
// 类型定义
// ============================================

export interface SyncOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  affectedCount: number;
}

// ============================================
// 常量
// ============================================

export const DEFAULT_USER_ID = 'default_user';

export const SYNC_TABLES = {
  COFFEE_BEANS: 'coffee_beans',
  BREWING_NOTES: 'brewing_notes',
  CUSTOM_EQUIPMENTS: 'custom_equipments',
  CUSTOM_METHODS: 'custom_methods',
  USER_SETTINGS: 'user_settings',
} as const;

export type SyncTableName = (typeof SYNC_TABLES)[keyof typeof SYNC_TABLES];

// 自定义预设键（存储在 localStorage）
export const PRESETS_PREFIX = 'brew-guide:custom-presets:';
export const PRESETS_KEYS = [
  'origins',
  'estates',
  'processes',
  'varieties',
] as const;

// ============================================
// 核心同步操作
// ============================================

/**
 * 获取云端表的最新更新时间戳
 */
export async function fetchRemoteLatestTimestamp(
  client: SupabaseClient,
  table: SyncTableName
): Promise<SyncOperationResult<number>> {
  try {
    const { data, error } = await client
      .from(table)
      .select('updated_at')
      .eq('user_id', DEFAULT_USER_ID)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error(
        `[SyncOps] 获取 ${table} 云端最新时间戳失败:`,
        error.message
      );
      return { success: false, error: error.message, affectedCount: 0 };
    }

    if (!data || data.length === 0) {
      return { success: true, data: 0, affectedCount: 0 };
    }

    const timestamp = new Date(data[0].updated_at).getTime();
    return { success: true, data: timestamp, affectedCount: 1 };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

/**
 * 获取云端所有记录（包括已删除的，用于冲突解决）
 * 支持指定列以优化性能
 */
export async function fetchRemoteAllRecords<T>(
  client: SupabaseClient,
  table: SyncTableName,
  columns: string = 'id, data, updated_at, deleted_at'
): Promise<
  SyncOperationResult<
    Array<{
      id: string;
      data: T;
      updated_at: string;
      deleted_at: string | null;
    }>
  >
> {
  try {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .eq('user_id', DEFAULT_USER_ID);

    if (error) {
      console.error(`[SyncOps] 获取 ${table} 全部数据失败:`, error.message);
      return { success: false, error: error.message, affectedCount: 0 };
    }

    const records = (data || []).map((row: any) => ({
      id: row.id,
      data: row.data, // 如果 columns 不包含 data，这里可能是 undefined
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
    }));

    return { success: true, data: records, affectedCount: records.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

/**
 * 根据 ID 列表批量获取云端记录
 */
export async function fetchRemoteRecordsByIds<T>(
  client: SupabaseClient,
  table: SyncTableName,
  ids: string[]
): Promise<SyncOperationResult<Array<{ id: string; data: T }>>> {
  if (ids.length === 0) {
    return { success: true, data: [], affectedCount: 0 };
  }

  try {
    // Supabase URL 长度有限制，如果 ID 太多需要分批
    // 优化：增大批次大小并使用并发请求，大幅提升下载速度
    // 修复：添加并发限制和重试机制，防止移动端网络拥塞导致超时
    const BATCH_SIZE = 25;
    const CONCURRENCY_LIMIT = 4;
    const allRecords: Array<{ id: string; data: T }> = [];

    // 1. 将 ID 分批
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      batches.push(ids.slice(i, i + BATCH_SIZE));
    }

    // 2. 定义带重试的获取函数
    const fetchBatchWithRetry = async (batchIds: string[], retries = 2) => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const { data, error } = await client
            .from(table)
            .select('id, data')
            .eq('user_id', DEFAULT_USER_ID)
            .in('id', batchIds);

          if (error) throw error;
          return data as Array<{ id: string; data: T }>;
        } catch (err) {
          if (attempt === retries) throw err;
          // 指数退避重试
          await new Promise(resolve =>
            setTimeout(resolve, 1000 * Math.pow(2, attempt))
          );
        }
      }
      return [];
    };

    // 3. 分组并发执行
    for (let i = 0; i < batches.length; i += CONCURRENCY_LIMIT) {
      const currentBatches = batches.slice(i, i + CONCURRENCY_LIMIT);
      const batchPromises = currentBatches.map(batchIds =>
        fetchBatchWithRetry(batchIds)
      );

      // 等待当前组完成
      const batchResults = await Promise.all(batchPromises);

      // 收集结果
      batchResults.forEach(batchData => {
        if (batchData) {
          allRecords.push(...batchData);
        }
      });
    }

    return {
      success: true,
      data: allRecords,
      affectedCount: allRecords.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

/**
 * 批量更新/插入记录到云端
 *
 * @description 使用 upsert 确保幂等性，同时重置 deleted_at 为 null
 */
export async function upsertRecords<T extends { id: string }>(
  client: SupabaseClient,
  table: SyncTableName,
  records: T[],
  mapFn: (record: T) => Record<string, unknown>
): Promise<SyncOperationResult> {
  if (records.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  try {
    const mappedRecords = records.map(record => ({
      ...mapFn(record),
      user_id: DEFAULT_USER_ID,
      deleted_at: null,
    }));

    const { error } = await client
      .from(table)
      .upsert(mappedRecords, { onConflict: 'id,user_id' });

    if (error) {
      console.error(`[SyncOps] ${table} upsert 失败:`, error.message);
      return { success: false, error: error.message, affectedCount: 0 };
    }

    return { success: true, affectedCount: records.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

/**
 * 软删除：标记云端记录为已删除（Tombstone 模式）
 */
export async function markRecordsAsDeleted(
  client: SupabaseClient,
  table: SyncTableName,
  ids: string[]
): Promise<SyncOperationResult> {
  if (ids.length === 0) {
    return { success: true, affectedCount: 0 };
  }

  try {
    const now = new Date().toISOString();

    const { error } = await client
      .from(table)
      .update({ deleted_at: now, updated_at: now })
      .eq('user_id', DEFAULT_USER_ID)
      .in('id', ids);

    if (error) {
      console.error(`[SyncOps] ${table} 软删除失败:`, error.message);
      return { success: false, error: error.message, affectedCount: 0 };
    }

    return { success: true, affectedCount: ids.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

// ============================================
// 设置同步操作
// ============================================

/**
 * 判断本地设置是否只有"同步配置"，没有其他用户数据
 * 用于决定是否应该上传（避免用默认值覆盖云端有效数据）
 *
 * 场景：新设备首次配置 Supabase 同步时，本地只有 supabaseSync 配置，
 * 其他都是默认值。此时不应该上传，否则会覆盖云端的用户数据。
 */
function shouldSkipUpload(settings: Partial<AppSettings>): boolean {
  // 检查是否有实际的用户数据（不只是同步配置）
  const hasUsername = !!settings.username;
  const hasS3Data =
    settings.s3Sync?.enabled === true && !!settings.s3Sync?.accessKeyId;
  const hasWebDAVData =
    settings.webdavSync?.enabled === true && !!settings.webdavSync?.url;

  // 如果没有 username 且没有 S3/WebDAV 配置，说明这是一个"空"设备
  // 只有 Supabase 配置（用于连接同步）不算有效数据
  return !hasUsername && !hasS3Data && !hasWebDAVData;
}

/**
 * 上传设置数据到云端
 */
export async function uploadSettingsData(
  client: SupabaseClient
): Promise<SyncOperationResult<number>> {
  try {
    const data: Record<string, unknown> = {};

    // 从 IndexedDB appSettings 表收集设置
    const appSettingsRecord = await db.appSettings.get('main');
    if (appSettingsRecord?.data) {
      const settings = appSettingsRecord.data as AppSettings;

      // 关键检查：如果本地只有同步配置，没有其他用户数据，跳过上传
      // 这可以防止新设备首次配置时用默认值覆盖云端数据
      if (shouldSkipUpload(settings)) {
        return {
          success: true,
          data: 0,
          affectedCount: 0,
        };
      }

      data.appSettings = settings;
    } else {
      return { success: true, data: 0, affectedCount: 0 };
    }

    // 收集磨豆机数据
    const grinders = await db.grinders.toArray();
    if (grinders.length > 0) {
      data.grinders = grinders;
    }

    // 收集自定义预设（localStorage）
    if (typeof window !== 'undefined') {
      const presets: Record<string, unknown> = {};
      for (const k of PRESETS_KEYS) {
        const v = localStorage.getItem(`${PRESETS_PREFIX}${k}`);
        if (v) {
          try {
            presets[k] = JSON.parse(v);
          } catch {
            /* 忽略解析错误 */
          }
        }
      }
      if (Object.keys(presets).length) data.customPresets = presets;
    }

    const { error } = await client.from(SYNC_TABLES.USER_SETTINGS).upsert(
      {
        id: 'app_settings',
        user_id: DEFAULT_USER_ID,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id,user_id' }
    );

    if (error) {
      return { success: false, error: error.message, affectedCount: 0 };
    }

    const count = Object.keys(data).length;
    return { success: true, data: count, affectedCount: count };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

/**
 * 判断本地设置是否为"空"或"默认"状态
 * 用于决定是否应该完全使用云端数据
 */
function isLocalSettingsEmpty(localSettings: Partial<AppSettings>): boolean {
  // 检查关键字段是否有用户数据
  const hasUsername = !!localSettings.username;
  const hasS3Config =
    localSettings.s3Sync?.enabled === true ||
    !!localSettings.s3Sync?.accessKeyId;
  const hasWebDAVConfig = !!localSettings.webdavSync?.url;
  const hasSupabaseConfig = localSettings.supabaseSync?.enabled === true;

  return !hasUsername && !hasS3Config && !hasWebDAVConfig && !hasSupabaseConfig;
}

/**
 * 下载设置数据并应用到本地
 */
export async function downloadSettingsData(
  client: SupabaseClient
): Promise<SyncOperationResult<number>> {
  try {
    const { data: row, error } = await client
      .from(SYNC_TABLES.USER_SETTINGS)
      .select('data')
      .eq('user_id', DEFAULT_USER_ID)
      .eq('id', 'app_settings')
      .single();

    // PGRST116 = 记录不存在，不算错误
    if (error && error.code !== 'PGRST116') {
      return { success: false, error: error.message, affectedCount: 0 };
    }

    if (!row?.data) {
      return { success: true, data: 0, affectedCount: 0 };
    }

    const settingsData = row.data as Record<string, unknown>;
    let count = 0;

    // 恢复 IndexedDB appSettings
    if (settingsData.appSettings) {
      const cloudAppSettings = settingsData.appSettings as AppSettings;
      const localRecord = await db.appSettings.get('main');
      const localSettings = (localRecord?.data || {}) as Partial<AppSettings>;

      // 如果本地是空/默认状态，完全使用云端数据
      // 而不是合并（合并会保留本地的默认值）
      let mergedSettings: AppSettings;
      const localIsEmpty = isLocalSettingsEmpty(localSettings);

      if (localIsEmpty) {
        // 本地无用户数据，直接使用云端设置
        mergedSettings = cloudAppSettings;
      } else {
        // 本地有用户数据，进行合并（云端优先）
        mergedSettings = {
          ...localSettings,
          ...cloudAppSettings,
        } as AppSettings;
      }

      await db.appSettings.put({ id: 'main', data: mergedSettings });
      count++;
    }

    // 恢复磨豆机数据
    if (settingsData.grinders && Array.isArray(settingsData.grinders)) {
      const cloudGrinders = settingsData.grinders as Array<{
        id: string;
        name: string;
        currentGrindSize?: string;
      }>;
      await db.grinders.clear();
      if (cloudGrinders.length > 0) {
        await db.grinders.bulkPut(cloudGrinders);
      }
      count++;
    }

    // 恢复自定义预设（localStorage）
    if (typeof window !== 'undefined') {
      if (settingsData.customPresets) {
        const presets = settingsData.customPresets as Record<string, unknown>;
        for (const k of PRESETS_KEYS) {
          if (presets[k]) {
            localStorage.setItem(
              `${PRESETS_PREFIX}${k}`,
              JSON.stringify(presets[k])
            );
            count++;
          }
        }
      }

      // 触发 UI 刷新
      window.dispatchEvent(
        new CustomEvent('settingsChanged', { detail: { source: 'remote' } })
      );
    }

    return { success: true, data: count, affectedCount: count };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}
