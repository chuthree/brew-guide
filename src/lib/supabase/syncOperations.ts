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
    const BATCH_SIZE = 25;
    const allRecords: Array<{ id: string; data: T }> = [];
    const promises = [];

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batchIds = ids.slice(i, i + BATCH_SIZE);
      const promise = client
        .from(table)
        .select('id, data')
        .eq('user_id', DEFAULT_USER_ID)
        .in('id', batchIds)
        .then(({ data, error }) => {
          if (error) throw error;
          return data as Array<{ id: string; data: T }>;
        });
      promises.push(promise);
    }

    // 并发执行所有批次请求
    const results = await Promise.all(promises);

    // 合并结果
    results.forEach(batchData => {
      if (batchData) {
        allRecords.push(...batchData);
      }
    });

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
      data.appSettings = appSettingsRecord.data;
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
      const localSettings = localRecord?.data || {};

      // 合并设置：云端优先，保留本地独有字段
      const mergedSettings = { ...localSettings, ...cloudAppSettings };
      await db.appSettings.put({ id: 'main', data: mergedSettings });
      console.log('[SyncOps] IndexedDB appSettings 已更新');
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
      console.log(`[SyncOps] 磨豆机已更新: ${cloudGrinders.length} 个`);
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
