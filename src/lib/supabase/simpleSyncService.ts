/**
 * 简化版 Supabase 同步服务
 * 
 * ⚠️ 2025-12-21 紧急简化
 * 移除了所有自动同步、实时同步功能
 * 只保留最基本的手动上传/下载功能
 * 
 * 核心原则：
 * 1. 只支持手动触发的上传和下载
 * 2. 上传：全量上传本地数据到云端
 * 3. 下载：全量拉取云端数据替换本地（需用户确认）
 * 4. 绝不自动同步，绝不自动覆盖本地数据
 */

import {
  createClient,
  SupabaseClient,
} from '@supabase/supabase-js';
import { db } from '@/lib/core/db';
import { Storage } from '@/lib/core/storage';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';
import { getSyncStatusStore } from '@/lib/stores/syncStatusStore';

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
// 常量
// ============================================

// 固定的 user_id，用于数据隔离
const DEFAULT_USER_ID = 'default_user';

// 需要同步的设置键
const SETTINGS_KEYS_TO_SYNC = [
  'brewGuideSettings',
  'brewingNotesVersion',
  'equipmentOrder',
  'onboardingCompleted',
  'customFlavorDimensions',
  'flavorDimensionHistoricalLabels',
  'backupReminderSettings',
  'yearlyReports',
  'yearlyReviewReminderSettings',
];

// 自定义预设键名
const CUSTOM_PRESETS_PREFIX = 'brew-guide:custom-presets:';
const CUSTOM_PRESETS_KEYS = ['origins', 'estates', 'processes', 'varieties'];

// 烘焙商图标存储键
const ROASTER_LOGOS_KEY = 'roaster-logos';

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
 * 用户点击"上传"按钮时调用
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

  syncStatusStore.setSyncing();
  const startTime = Date.now();
  console.log('[Supabase] 开始上传数据...');

  try {
    // 读取本地数据
    const [beans, notes, equipments, methods] = await Promise.all([
      db.coffeeBeans.toArray(),
      db.brewingNotes.toArray(),
      db.customEquipments.toArray(),
      db.customMethods.toArray(),
    ]);

    console.log(`[Supabase] 本地数据: 咖啡豆 ${beans.length}, 笔记 ${notes.length}, 器具 ${equipments.length}, 方案 ${methods.length}`);

    // 上传咖啡豆
    if (beans.length > 0) {
      const records = beans.map(bean => ({
        id: bean.id,
        user_id: DEFAULT_USER_ID,
        data: bean,
        updated_at: new Date(bean.timestamp || Date.now()).toISOString(),
      }));
      const { error } = await supabaseClient
        .from('coffee_beans')
        .upsert(records, { onConflict: 'id,user_id' });
      if (error) {
        errors.push(`咖啡豆上传失败: ${error.message}`);
      } else {
        uploaded += beans.length;
      }
    }

    // 上传冲煮笔记
    if (notes.length > 0) {
      const records = notes.map(note => ({
        id: note.id,
        user_id: DEFAULT_USER_ID,
        data: note,
        updated_at: new Date(note.timestamp || Date.now()).toISOString(),
      }));
      const { error } = await supabaseClient
        .from('brewing_notes')
        .upsert(records, { onConflict: 'id,user_id' });
      if (error) {
        errors.push(`冲煮笔记上传失败: ${error.message}`);
      } else {
        uploaded += notes.length;
      }
    }

    // 上传自定义器具
    if (equipments.length > 0) {
      const records = equipments.map(eq => ({
        id: eq.id,
        user_id: DEFAULT_USER_ID,
        data: eq,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabaseClient
        .from('custom_equipments')
        .upsert(records, { onConflict: 'id,user_id' });
      if (error) {
        errors.push(`自定义器具上传失败: ${error.message}`);
      } else {
        uploaded += equipments.length;
      }
    }

    // 上传自定义方案
    if (methods.length > 0) {
      const records = methods.map(m => ({
        id: m.equipmentId,
        user_id: DEFAULT_USER_ID,
        equipment_id: m.equipmentId,
        data: m,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabaseClient
        .from('custom_methods')
        .upsert(records, { onConflict: 'id,user_id' });
      if (error) {
        errors.push(`自定义方案上传失败: ${error.message}`);
      } else {
        uploaded += methods.length;
      }
    }

    // 上传设置数据
    try {
      const settingsData: Record<string, unknown> = {};

      for (const key of SETTINGS_KEYS_TO_SYNC) {
        const value = await Storage.get(key);
        if (value) {
          try {
            let parsedValue = JSON.parse(value);
            if (key === 'brewGuideSettings' && parsedValue?.state?.settings) {
              parsedValue = parsedValue.state.settings;
            }
            settingsData[key] = parsedValue;
          } catch {
            settingsData[key] = value;
          }
        }
      }

      // 收集自定义预设
      if (typeof window !== 'undefined') {
        const customPresets: Record<string, unknown> = {};
        for (const presetKey of CUSTOM_PRESETS_KEYS) {
          const storageKey = `${CUSTOM_PRESETS_PREFIX}${presetKey}`;
          const presetJson = localStorage.getItem(storageKey);
          if (presetJson) {
            try {
              customPresets[presetKey] = JSON.parse(presetJson);
            } catch { /* 忽略 */ }
          }
        }
        if (Object.keys(customPresets).length > 0) {
          settingsData.customPresets = customPresets;
        }

        // 烘焙商图标
        const roasterLogosJson = localStorage.getItem(ROASTER_LOGOS_KEY);
        if (roasterLogosJson) {
          try {
            settingsData[ROASTER_LOGOS_KEY] = JSON.parse(roasterLogosJson);
          } catch { /* 忽略 */ }
        }
      }

      const { error } = await supabaseClient.from('user_settings').upsert(
        {
          id: 'app_settings',
          user_id: DEFAULT_USER_ID,
          data: settingsData,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id,user_id' }
      );

      if (error) {
        errors.push(`设置上传失败: ${error.message}`);
      } else {
        uploaded += Object.keys(settingsData).length;
      }
    } catch (err) {
      errors.push(`设置上传异常: ${err instanceof Error ? err.message : '未知错误'}`);
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

  syncStatusStore.setSyncing();
  const startTime = Date.now();
  console.log('[Supabase] 开始下载数据...');

  try {
    // 并行下载所有表
    const [
      beansResult,
      notesResult,
      equipmentsResult,
      methodsResult,
      settingsResult,
    ] = await Promise.all([
      supabaseClient
        .from('coffee_beans')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .is('deleted_at', null),
      supabaseClient
        .from('brewing_notes')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .is('deleted_at', null),
      supabaseClient
        .from('custom_equipments')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .is('deleted_at', null),
      supabaseClient
        .from('custom_methods')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .is('deleted_at', null),
      supabaseClient
        .from('user_settings')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .eq('id', 'app_settings')
        .single(),
    ]);

    console.log(`[Supabase] 下载完成，耗时: ${Date.now() - startTime}ms`);

    // 处理咖啡豆
    if (beansResult.error) {
      errors.push(`咖啡豆下载失败: ${beansResult.error.message}`);
    } else if (beansResult.data && beansResult.data.length > 0) {
      const beans = beansResult.data.map((row: { data: CoffeeBean }) => row.data);
      console.log(`[Supabase] 下载到 ${beans.length} 条咖啡豆`);
      await db.coffeeBeans.clear();
      await db.coffeeBeans.bulkPut(beans);
      const { getCoffeeBeanStore } = await import('@/lib/stores/coffeeBeanStore');
      getCoffeeBeanStore().setBeans(beans);
      downloaded += beans.length;
    }

    // 处理冲煮笔记
    if (notesResult.error) {
      errors.push(`冲煮笔记下载失败: ${notesResult.error.message}`);
    } else if (notesResult.data && notesResult.data.length > 0) {
      const notes = notesResult.data.map((row: { data: BrewingNote }) => row.data);
      console.log(`[Supabase] 下载到 ${notes.length} 条笔记`);
      await db.brewingNotes.clear();
      await db.brewingNotes.bulkPut(notes);
      const { getBrewingNoteStore } = await import('@/lib/stores/brewingNoteStore');
      getBrewingNoteStore().setNotes(notes);
      downloaded += notes.length;
    }

    // 处理自定义器具
    if (equipmentsResult.error) {
      errors.push(`自定义器具下载失败: ${equipmentsResult.error.message}`);
    } else if (equipmentsResult.data && equipmentsResult.data.length > 0) {
      const equipments = equipmentsResult.data.map((row: { data: CustomEquipment }) => row.data);
      console.log(`[Supabase] 下载到 ${equipments.length} 个自定义器具`);
      await db.customEquipments.clear();
      await db.customEquipments.bulkPut(equipments);
      downloaded += equipments.length;
    }

    // 处理自定义方案
    if (methodsResult.error) {
      errors.push(`自定义方案下载失败: ${methodsResult.error.message}`);
    } else if (methodsResult.data && methodsResult.data.length > 0) {
      const methods = methodsResult.data.map(
        (row: { data: { equipmentId: string; methods: Method[] } }) => row.data
      );
      console.log(`[Supabase] 下载到 ${methods.length} 个自定义方案`);
      await db.customMethods.clear();
      await db.customMethods.bulkPut(methods);
      downloaded += methods.length;
    }

    // 处理设置
    if (settingsResult.error && settingsResult.error.code !== 'PGRST116') {
      errors.push(`设置下载失败: ${settingsResult.error.message}`);
    } else if (settingsResult.data?.data) {
      const settingsData = settingsResult.data.data as Record<string, unknown>;
      console.log(`[Supabase] 下载到 ${Object.keys(settingsData).length} 项设置`);

      for (const key of SETTINGS_KEYS_TO_SYNC) {
        if (settingsData[key] !== undefined) {
          const value = typeof settingsData[key] === 'object'
            ? JSON.stringify(settingsData[key])
            : String(settingsData[key]);
          await Storage.set(key, value);
        }
      }

      // 恢复自定义预设
      if (typeof window !== 'undefined' && settingsData.customPresets) {
        const customPresets = settingsData.customPresets as Record<string, unknown>;
        for (const presetKey of CUSTOM_PRESETS_KEYS) {
          if (customPresets[presetKey]) {
            const storageKey = `${CUSTOM_PRESETS_PREFIX}${presetKey}`;
            localStorage.setItem(storageKey, JSON.stringify(customPresets[presetKey]));
          }
        }
      }

      // 恢复烘焙商图标
      if (typeof window !== 'undefined' && settingsData[ROASTER_LOGOS_KEY]) {
        localStorage.setItem(ROASTER_LOGOS_KEY, JSON.stringify(settingsData[ROASTER_LOGOS_KEY]));
      }

      downloaded += Object.keys(settingsData).length;

      // 触发 UI 刷新
      window.dispatchEvent(new CustomEvent('settingsChanged'));
    }

    const totalTime = Date.now() - startTime;
    const hasCriticalError = errors.some(e => e.includes('咖啡豆') || e.includes('笔记'));
    const success = !hasCriticalError;
    const message = success
      ? `下载成功: ${downloaded} 条记录`
      : `下载失败: ${errors[0]}`;

    if (success) {
      syncStatusStore.setSyncSuccess();
    } else {
      syncStatusStore.setSyncError(message);
    }

    console.log(`[Supabase] 下载处理完成，总耗时: ${totalTime}ms`);
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
