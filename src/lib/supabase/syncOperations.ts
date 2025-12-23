/**
 * Supabase 同步操作模块
 *
 * 设计原则（参考 CouchDB 复制模型 + RxDB 离线优先架构）:
 * 1. 软删除（Tombstone）：删除操作通过设置 deleted_at 实现，而不是物理删除
 * 2. 全量比对：上传时比对本地和云端数据，确保删除操作被正确同步
 * 3. 幂等性：相同操作多次执行结果一致
 * 4. 原子性：每个操作要么完全成功，要么完全失败
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

export interface TableSyncState {
  localIds: Set<string>;
  remoteIds: string[];
  toUpsert: string[];
  toDelete: string[];
}

// ============================================
// 常量（集中管理，避免重复定义）
// ============================================

export const DEFAULT_USER_ID = 'default_user';

// 支持同步的表名
export const SYNC_TABLES = {
  COFFEE_BEANS: 'coffee_beans',
  BREWING_NOTES: 'brewing_notes',
  CUSTOM_EQUIPMENTS: 'custom_equipments',
  CUSTOM_METHODS: 'custom_methods',
  USER_SETTINGS: 'user_settings',
} as const;

export type SyncTableName = (typeof SYNC_TABLES)[keyof typeof SYNC_TABLES];

// 自定义预设（仍存储在 localStorage 中）
export const PRESETS_PREFIX = 'brew-guide:custom-presets:';
export const PRESETS_KEYS = [
  'origins',
  'estates',
  'processes',
  'varieties',
] as const;

// ============================================
// 核心同步操作（原子化、可测试）
// ============================================

/**
 * 获取云端表中所有未删除记录的 ID 列表
 *
 * @description 这是同步删除检测的基础操作
 * @param client - Supabase 客户端
 * @param table - 表名
 * @returns 未删除记录的 ID 数组
 */
export async function fetchRemoteActiveIds(
  client: SupabaseClient,
  table: SyncTableName
): Promise<SyncOperationResult<string[]>> {
  try {
    const { data, error } = await client
      .from(table)
      .select('id')
      .eq('user_id', DEFAULT_USER_ID)
      .is('deleted_at', null);

    if (error) {
      console.error(`[SyncOps] 获取 ${table} 远程ID失败:`, error.message);
      return { success: false, error: error.message, affectedCount: 0 };
    }

    const ids = (data || []).map((row: { id: string }) => row.id);
    console.log(`[SyncOps] ${table} 云端活跃记录: ${ids.length} 条`);
    return { success: true, data: ids, affectedCount: ids.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

/**
 * 批量更新/插入记录到云端
 *
 * @description 使用 upsert 确保幂等性，同时重置 deleted_at 为 null
 * @param client - Supabase 客户端
 * @param table - 表名
 * @param records - 要上传的记录数组（必须包含 id 字段）
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
      deleted_at: null, // 重要：明确设置为未删除状态
    }));

    const { error } = await client
      .from(table)
      .upsert(mappedRecords, { onConflict: 'id,user_id' });

    if (error) {
      console.error(`[SyncOps] ${table} upsert 失败:`, error.message);
      return { success: false, error: error.message, affectedCount: 0 };
    }

    console.log(`[SyncOps] ${table} upsert 成功: ${records.length} 条`);
    return { success: true, affectedCount: records.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

/**
 * 软删除：标记云端记录为已删除
 *
 * @description 根据 CouchDB 的墓碑（Tombstone）模式，不物理删除数据
 * @param client - Supabase 客户端
 * @param table - 表名
 * @param ids - 要标记删除的 ID 数组
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

    console.log(`[SyncOps] ${table} 软删除成功: ${ids.length} 条`);
    return { success: true, affectedCount: ids.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

/**
 * 获取云端所有未删除的记录数据
 *
 * @param client - Supabase 客户端
 * @param table - 表名
 */
export async function fetchRemoteActiveRecords<T>(
  client: SupabaseClient,
  table: SyncTableName
): Promise<SyncOperationResult<T[]>> {
  try {
    const { data, error } = await client
      .from(table)
      .select('data')
      .eq('user_id', DEFAULT_USER_ID)
      .is('deleted_at', null);

    if (error) {
      console.error(`[SyncOps] 获取 ${table} 数据失败:`, error.message);
      return { success: false, error: error.message, affectedCount: 0 };
    }

    const records = (data || []).map((row: { data: T }) => row.data);
    console.log(`[SyncOps] ${table} 下载成功: ${records.length} 条`);
    return { success: true, data: records, affectedCount: records.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

// ============================================
// 同步差异计算（纯函数，可测试）
// ============================================

/**
 * 计算需要删除的 ID（云端存在但本地不存在）
 *
 * @description 这是同步删除逻辑的核心
 * 当用户在本地删除数据后，该数据的 ID 不再存在于本地
 * 但云端仍然存在该 ID，此时需要将云端的该记录标记为已删除
 *
 * @param localIds - 本地当前存在的 ID 集合
 * @param remoteIds - 云端当前活跃的 ID 数组
 * @returns 需要在云端标记删除的 ID 数组
 */
export function calculateIdsToDelete(
  localIds: Set<string>,
  remoteIds: string[]
): string[] {
  return remoteIds.filter(id => !localIds.has(id));
}

/**
 * 生成同步状态报告
 */
export function createSyncStateReport(
  tableName: string,
  localCount: number,
  remoteCount: number,
  toDeleteCount: number
): string {
  return `[${tableName}] 本地: ${localCount}, 云端: ${remoteCount}, 待删除: ${toDeleteCount}`;
}

// ============================================
// 高阶同步操作
// ============================================

/**
 * 执行完整的表同步上传操作
 *
 * @description 包含三个步骤：
 * 1. 获取云端活跃 ID
 * 2. Upsert 本地数据
 * 3. 软删除本地已删除的数据
 */
export async function syncTableUpload<T extends { id: string }>(
  client: SupabaseClient,
  table: SyncTableName,
  localRecords: T[],
  mapFn: (record: T) => Record<string, unknown>
): Promise<SyncOperationResult<{ upserted: number; deleted: number }>> {
  const errors: string[] = [];
  let upsertedCount = 0;
  let deletedCount = 0;

  // Step 1: 获取云端活跃 ID
  const remoteIdsResult = await fetchRemoteActiveIds(client, table);
  if (!remoteIdsResult.success) {
    errors.push(`获取远程ID失败: ${remoteIdsResult.error}`);
  }
  const remoteIds = remoteIdsResult.data || [];

  // Step 2: Upsert 本地数据
  if (localRecords.length > 0) {
    const upsertResult = await upsertRecords(
      client,
      table,
      localRecords,
      mapFn
    );
    if (!upsertResult.success) {
      errors.push(`Upsert失败: ${upsertResult.error}`);
    } else {
      upsertedCount = upsertResult.affectedCount;
    }
  }

  // Step 3: 计算并执行软删除
  const localIds = new Set(localRecords.map(r => r.id));
  const idsToDelete = calculateIdsToDelete(localIds, remoteIds);

  console.log(
    createSyncStateReport(
      table,
      localRecords.length,
      remoteIds.length,
      idsToDelete.length
    )
  );

  if (idsToDelete.length > 0) {
    const deleteResult = await markRecordsAsDeleted(client, table, idsToDelete);
    if (!deleteResult.success) {
      errors.push(`软删除失败: ${deleteResult.error}`);
    } else {
      deletedCount = deleteResult.affectedCount;
    }
  }

  const success = errors.length === 0;
  return {
    success,
    error: errors.join('; '),
    data: { upserted: upsertedCount, deleted: deletedCount },
    affectedCount: upsertedCount + deletedCount,
  };
}

// ============================================
// 设置同步操作（集中管理，避免重复代码）
// ============================================

/**
 * 上传设置数据到云端
 * 注意：设置数据现在完全存储在 IndexedDB appSettings 表中
 */
export async function uploadSettingsData(
  client: SupabaseClient
): Promise<SyncOperationResult<number>> {
  try {
    const data: Record<string, unknown> = {};

    // 从 IndexedDB appSettings 表收集设置（唯一数据来源）
    const appSettingsRecord = await db.appSettings.get('main');
    if (appSettingsRecord?.data) {
      data.appSettings = appSettingsRecord.data;
    }

    // 收集自定义预设（仍存储在 localStorage 中）
    if (typeof window !== 'undefined') {
      const presets: Record<string, unknown> = {};
      for (const k of PRESETS_KEYS) {
        const v = localStorage.getItem(`${PRESETS_PREFIX}${k}`);
        if (v)
          try {
            presets[k] = JSON.parse(v);
          } catch {
            /* 忽略解析错误 */
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
    console.log(`[SyncOps] 设置上传成功: ${count} 项`);
    return { success: true, data: count, affectedCount: count };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}

/**
 * 下载设置数据并应用到本地
 * 注意：设置数据现在完全存储在 IndexedDB appSettings 表中
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

    // 恢复 IndexedDB appSettings（唯一数据存储）
    if (settingsData.appSettings) {
      const cloudAppSettings = settingsData.appSettings as AppSettings;
      // 获取本地设置用于合并
      const localRecord = await db.appSettings.get('main');
      const localSettings = localRecord?.data || {};

      // 合并设置：云端设置优先，但保留本地独有的字段
      const mergedSettings = { ...localSettings, ...cloudAppSettings };
      await db.appSettings.put({ id: 'main', data: mergedSettings });
      console.log('[SyncOps] IndexedDB appSettings 已更新');
      count++;
    }

    // 恢复自定义预设（仍存储在 localStorage 中）
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
      window.dispatchEvent(new CustomEvent('settingsChanged'));
    }

    console.log(`[SyncOps] 设置下载成功: ${count} 项`);
    return { success: true, data: count, affectedCount: count };
  } catch (err) {
    const message = err instanceof Error ? err.message : '未知错误';
    return { success: false, error: message, affectedCount: 0 };
  }
}
