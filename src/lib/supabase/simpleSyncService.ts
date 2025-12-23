/**
 * 简化版 Supabase 同步服务
 *
 * ⚠️ 2025-12-22 重大修复 - 基于业界标准重构
 *
 * 设计参考：
 * - CouchDB 复制冲突模型: https://docs.couchdb.org/en/stable/replication/conflicts.html
 * - RxDB 离线优先架构: https://rxdb.info/offline-first.html
 * - 软删除墓碑模式 (Tombstone Pattern)
 *
 * 核心原则：
 * 1. 只支持手动触发的上传和下载（无自动同步）
 * 2. 上传：全量上传本地数据 + 同步删除操作（软删除）
 * 3. 下载：拉取云端未删除数据替换本地
 * 4. 所有删除使用软删除（设置 deleted_at），保留历史记录
 *
 * 同步删除策略（关键）：
 * - 上传时：本地不存在但云端存在 → 云端标记为 deleted_at
 * - 下载时：只获取 deleted_at IS NULL 的记录
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '@/lib/core/db';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';
import { getSyncStatusStore } from '@/lib/stores/syncStatusStore';
import {
  syncTableUpload,
  fetchRemoteActiveRecords,
  uploadSettingsData,
  downloadSettingsData,
  SYNC_TABLES,
  DEFAULT_USER_ID,
} from './syncOperations';

// ============================================
// 类型定义
// ============================================

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncResult {
  success: boolean;
  message: string;
  uploaded: number;
  downloaded: number;
  errors: string[];
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

// ============================================
// 全局状态
// ============================================

let supabaseClient: SupabaseClient | null = null;
let isInitialized = false;
let currentConfig: SupabaseConfig | null = null;

// ============================================
// 初始化
// ============================================

/**
 * 初始化 Supabase 客户端
 */
export function initializeSupabase(config: SupabaseConfig): boolean {
  try {
    if (!config.url || !config.anonKey) {
      console.error('[Supabase] 配置不完整');
      return false;
    }

    // 已经用相同配置初始化过
    if (
      isInitialized &&
      currentConfig?.url === config.url &&
      currentConfig?.anonKey === config.anonKey
    ) {
      return true;
    }

    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    currentConfig = config;
    isInitialized = true;
    console.log('[Supabase] 客户端初始化成功');
    return true;
  } catch (error) {
    console.error('[Supabase] 初始化失败:', error);
    return false;
  }
}

export function isSupabaseInitialized(): boolean {
  return isInitialized && supabaseClient !== null;
}

export function disconnectSupabase(): void {
  supabaseClient = null;
  currentConfig = null;
  isInitialized = false;
  console.log('[Supabase] 已断开连接');
}

// ============================================
// 连接测试
// ============================================

/**
 * 测试连接
 */
export async function testConnection(): Promise<boolean> {
  if (!supabaseClient) {
    console.error('[Supabase] 客户端未初始化');
    return false;
  }

  try {
    const { error } = await supabaseClient
      .from('coffee_beans')
      .select('id')
      .limit(1);

    if (error) {
      // 表不存在也算连接成功（可能是首次使用）
      if (error.code === '42P01') {
        console.warn('[Supabase] 连接成功，但数据表尚未创建');
        return true;
      }
      console.error('[Supabase] 连接测试失败:', error.message);
      return false;
    }

    console.log('[Supabase] 连接测试成功');
    return true;
  } catch (error) {
    console.error('[Supabase] 连接测试异常:', error);
    return false;
  }
}

// ============================================
// 上传数据（手动触发）
// ============================================

/**
 * 上传所有本地数据到云端
 *
 * 使用基于 CouchDB 墓碑模式的同步策略：
 * 1. Upsert 所有本地数据（设置 deleted_at = null）
 * 2. 软删除云端存在但本地不存在的数据（设置 deleted_at = now）
 *
 * @returns 同步结果
 */
export async function uploadAllData(): Promise<SyncResult> {
  const syncStatusStore = getSyncStatusStore();

  if (!supabaseClient) {
    return {
      success: false,
      message: '未连接到 Supabase',
      uploaded: 0,
      downloaded: 0,
      errors: ['客户端未初始化'],
    };
  }

  const errors: string[] = [];
  let uploaded = 0;

  syncStatusStore.setProvider('supabase');
  syncStatusStore.setSyncing();
  const startTime = Date.now();
  console.log('[Supabase] 开始上传数据（含删除同步）...');

  try {
    // 1. 读取本地数据
    const [beans, notes, equipments, methods] = await Promise.all([
      db.coffeeBeans.toArray(),
      db.brewingNotes.toArray(),
      db.customEquipments.toArray(),
      db.customMethods.toArray(),
    ]);

    console.log(
      `[Supabase] 本地数据: 咖啡豆 ${beans.length}, 笔记 ${notes.length}, 器具 ${equipments.length}, 方案 ${methods.length}`
    );

    // 2. 同步咖啡豆（使用模块化同步操作）
    const beansResult = await syncTableUpload(
      supabaseClient,
      SYNC_TABLES.COFFEE_BEANS,
      beans,
      bean => ({
        id: bean.id,
        data: bean,
        updated_at: new Date(bean.timestamp || Date.now()).toISOString(),
      })
    );
    if (!beansResult.success) {
      errors.push(`咖啡豆: ${beansResult.error}`);
    } else {
      uploaded += beansResult.data?.upserted || 0;
    }

    // 3. 同步冲煮笔记
    const notesResult = await syncTableUpload(
      supabaseClient,
      SYNC_TABLES.BREWING_NOTES,
      notes,
      note => ({
        id: note.id,
        data: note,
        updated_at: new Date(note.timestamp || Date.now()).toISOString(),
      })
    );
    if (!notesResult.success) {
      errors.push(`冲煮笔记: ${notesResult.error}`);
    } else {
      uploaded += notesResult.data?.upserted || 0;
    }

    // 4. 同步自定义器具
    const equipmentsResult = await syncTableUpload(
      supabaseClient,
      SYNC_TABLES.CUSTOM_EQUIPMENTS,
      equipments,
      eq => ({
        id: eq.id,
        data: eq,
        updated_at: new Date().toISOString(),
      })
    );
    if (!equipmentsResult.success) {
      errors.push(`自定义器具: ${equipmentsResult.error}`);
    } else {
      uploaded += equipmentsResult.data?.upserted || 0;
    }

    // 5. 同步自定义方案（注意：使用 equipmentId 作为 id）
    const methodsWithId = methods.map(m => ({ ...m, id: m.equipmentId }));
    const methodsResult = await syncTableUpload(
      supabaseClient,
      SYNC_TABLES.CUSTOM_METHODS,
      methodsWithId,
      m => ({
        id: m.equipmentId,
        equipment_id: m.equipmentId,
        data: m,
        updated_at: new Date().toISOString(),
      })
    );
    if (!methodsResult.success) {
      errors.push(`自定义方案: ${methodsResult.error}`);
    } else {
      uploaded += methodsResult.data?.upserted || 0;
    }

    // 6. 上传设置数据（使用共享函数）
    const settingsResult = await uploadSettingsData(supabaseClient);
    if (!settingsResult.success) {
      errors.push(`设置: ${settingsResult.error}`);
    } else {
      uploaded += settingsResult.affectedCount;
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Supabase] 上传完成，共 ${uploaded} 条，耗时: ${totalTime}ms`);

    const success = errors.length === 0;
    const message = success
      ? `上传成功: ${uploaded} 条记录`
      : `上传完成，但有 ${errors.length} 个错误`;

    if (success) {
      syncStatusStore.setSyncSuccess();
    } else {
      syncStatusStore.setSyncError(message);
    }

    return { success, message, uploaded, downloaded: 0, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '上传失败';
    console.error('[Supabase] 上传失败:', error);
    syncStatusStore.setSyncError(errorMessage);
    return {
      success: false,
      message: errorMessage,
      uploaded,
      downloaded: 0,
      errors: [...errors, errorMessage],
    };
  }
}

// ============================================
// 下载数据（手动触发，需确认）
// ============================================

/**
 * 从云端下载所有数据并替换本地
 *
 * @description 只获取 deleted_at IS NULL 的记录
 * ⚠️ 此操作会覆盖本地数据，必须由用户明确确认后才能调用
 */
export async function downloadAllData(): Promise<SyncResult> {
  const syncStatusStore = getSyncStatusStore();

  if (!supabaseClient) {
    return {
      success: false,
      message: '未连接到 Supabase',
      uploaded: 0,
      downloaded: 0,
      errors: ['客户端未初始化'],
    };
  }

  const errors: string[] = [];
  let downloaded = 0;

  syncStatusStore.setProvider('supabase');
  syncStatusStore.setSyncing();
  const startTime = Date.now();
  console.log('[Supabase] 开始下载数据（仅活跃记录）...');

  try {
    // 使用模块化操作获取数据
    const [beansResult, notesResult, equipmentsResult, methodsResult] =
      await Promise.all([
        fetchRemoteActiveRecords<CoffeeBean>(
          supabaseClient,
          SYNC_TABLES.COFFEE_BEANS
        ),
        fetchRemoteActiveRecords<BrewingNote>(
          supabaseClient,
          SYNC_TABLES.BREWING_NOTES
        ),
        fetchRemoteActiveRecords<CustomEquipment>(
          supabaseClient,
          SYNC_TABLES.CUSTOM_EQUIPMENTS
        ),
        fetchRemoteActiveRecords<{ equipmentId: string; methods: Method[] }>(
          supabaseClient,
          SYNC_TABLES.CUSTOM_METHODS
        ),
      ]);

    // 处理咖啡豆
    if (!beansResult.success) {
      errors.push(`咖啡豆下载失败: ${beansResult.error}`);
    } else if (beansResult.data && beansResult.data.length > 0) {
      const beans = beansResult.data;
      console.log(`[Supabase] 下载到 ${beans.length} 条咖啡豆`);
      await db.coffeeBeans.clear();
      await db.coffeeBeans.bulkPut(beans);
      const { getCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
      getCoffeeBeanStore().setBeans(beans);
      downloaded += beans.length;
    }
    // 云端没有数据时保持本地不变

    // 处理冲煮笔记
    if (!notesResult.success) {
      errors.push(`冲煮笔记下载失败: ${notesResult.error}`);
    } else if (notesResult.data && notesResult.data.length > 0) {
      const notes = notesResult.data;
      console.log(`[Supabase] 下载到 ${notes.length} 条笔记`);
      await db.brewingNotes.clear();
      await db.brewingNotes.bulkPut(notes);
      const { getBrewingNoteStore } = await import(
        '@/lib/stores/brewingNoteStore'
      );
      getBrewingNoteStore().setNotes(notes);
      downloaded += notes.length;
    }
    // 云端没有数据时保持本地不变

    // 处理自定义器具
    if (!equipmentsResult.success) {
      errors.push(`自定义器具下载失败: ${equipmentsResult.error}`);
    } else if (equipmentsResult.data && equipmentsResult.data.length > 0) {
      const equipments = equipmentsResult.data;
      console.log(`[Supabase] 下载到 ${equipments.length} 个自定义器具`);
      await db.customEquipments.clear();
      await db.customEquipments.bulkPut(equipments);
      downloaded += equipments.length;
    }
    // 云端没有数据时保持本地不变

    // 处理自定义方案
    if (!methodsResult.success) {
      errors.push(`自定义方案下载失败: ${methodsResult.error}`);
    } else if (methodsResult.data && methodsResult.data.length > 0) {
      const methods = methodsResult.data;
      console.log(`[Supabase] 下载到 ${methods.length} 个自定义方案`);
      await db.customMethods.clear();
      await db.customMethods.bulkPut(methods);
      downloaded += methods.length;
    }
    // 云端没有数据时保持本地不变

    // 处理设置（使用共享函数）
    const settingsResult = await downloadSettingsData(supabaseClient);
    if (!settingsResult.success) {
      errors.push(`设置下载失败: ${settingsResult.error}`);
    } else {
      downloaded += settingsResult.affectedCount;
    }

    const totalTime = Date.now() - startTime;
    const hasCriticalError = errors.some(
      e => e.includes('咖啡豆') || e.includes('笔记')
    );
    const success = !hasCriticalError;
    const message = success
      ? `下载成功: ${downloaded} 条记录`
      : `下载失败: ${errors[0]}`;

    if (success) {
      syncStatusStore.setSyncSuccess();
    } else {
      syncStatusStore.setSyncError(message);
    }

    console.log(`[Supabase] 下载完成，总耗时: ${totalTime}ms`);
    return { success, message, uploaded: 0, downloaded, errors };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '下载失败';
    console.error('[Supabase] 下载失败:', error);
    syncStatusStore.setSyncError(errorMessage);
    return {
      success: false,
      message: errorMessage,
      uploaded: 0,
      downloaded,
      errors: [...errors, errorMessage],
    };
  }
}

// ============================================
// 导出
// ============================================

export const simpleSyncService = {
  initialize: initializeSupabase,
  disconnect: disconnectSupabase,
  isInitialized: isSupabaseInitialized,
  testConnection,
  uploadAllData,
  downloadAllData,
};

export default simpleSyncService;
