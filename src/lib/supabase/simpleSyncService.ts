/**
 * 简化版 Supabase 同步服务
 * 参考可用项目的实现，采用简单可靠的同步策略
 *
 * 核心原则：
 * 1. 使用固定的 user_id（default_user），确保多设备数据共享
 * 2. 上传：全量上传本地数据，服务端基于 updated_at 决定是否接受
 * 3. 下载：全量拉取云端数据，直接替换本地
 * 4. 实时同步：监听 Postgres Changes，自动更新本地
 */

import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from '@supabase/supabase-js';
import { db } from '@/lib/core/db';
import { Storage } from '@/lib/core/storage';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';
import { getSyncStatusStore } from '@/lib/stores/syncStatusStore';

// ============================================
// 类型定义
// ============================================

export type SyncStatus =
  | 'idle'
  | 'syncing'
  | 'success'
  | 'error'
  | 'connected'
  | 'disconnected';

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

// 数据库记录类型
interface DbRecord<T> {
  id: string;
  user_id: string;
  data: T;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  version: number;
}

// ============================================
// 常量
// ============================================

// 使用固定的 user_id，确保多设备数据共享
// 用户可以通过自己的 Supabase 项目来隔离数据
const DEFAULT_USER_ID = 'default_user';
const SYNC_SETTINGS_KEY = 'supabase_sync_settings';

// 需要同步的设置键（与 dataManager.ts 的 APP_DATA_KEYS 保持一致）
const SETTINGS_KEYS_TO_SYNC = [
  'brewGuideSettings', // 应用设置
  'brewingNotesVersion', // 数据版本
  'equipmentOrder', // 器具排序信息
  'onboardingCompleted', // 引导完成标记
  'customFlavorDimensions', // 自定义评分维度
  'flavorDimensionHistoricalLabels', // 评分维度历史标签
  'backupReminderSettings', // 备份提醒设置
  'yearlyReports', // 年度报告
  'yearlyReviewReminderSettings', // 年度回顾提醒设置
];

// 自定义预设键名（存储在 localStorage）
const CUSTOM_PRESETS_PREFIX = 'brew-guide:custom-presets:';
const CUSTOM_PRESETS_KEYS = ['origins', 'estates', 'processes', 'varieties'];

// 烘焙商图标存储键
const ROASTER_LOGOS_KEY = 'roaster-logos';

// ============================================
// 全局状态
// ============================================

let supabaseClient: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let isInitialized = false;
let currentConfig: SupabaseConfig | null = null;

// 数据变更回调
type DataChangeCallback = (table: string) => void;
let dataChangeCallback: DataChangeCallback | null = null;

// 防止循环同步的标志（当收到远程更新时设置，防止触发本地上传）
let isProcessingRemoteUpdate = false;

// ============================================
// 初始化
// ============================================

/**
 * 初始化 Supabase 客户端
 */
export function initializeSupabase(config: SupabaseConfig): boolean {
  try {
    if (!config.url || !config.anonKey) {
      console.error('[Supabase] Config incomplete');
      return false;
    }

    if (
      isInitialized &&
      currentConfig?.url === config.url &&
      currentConfig?.anonKey === config.anonKey
    ) {
      return true;
    }

    if (supabaseClient) {
      stopRealtimeSync();
    }

    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    currentConfig = config;
    isInitialized = true;
    return true;
  } catch (error) {
    console.error('[Supabase] initialize failed:', error);
    return false;
  }
}

export function getClient(): SupabaseClient | null {
  return supabaseClient;
}

export function isSupabaseInitialized(): boolean {
  return isInitialized && supabaseClient !== null;
}

export function disconnectSupabase(): void {
  stopRealtimeSync();
  supabaseClient = null;
  currentConfig = null;
  isInitialized = false;
}

// ============================================
// 连接测试
// ============================================

/**
 * 测试连接
 */
export async function testConnection(): Promise<boolean> {
  if (!supabaseClient) {
    console.error('❌ [Supabase] 客户端未初始化');
    return false;
  }

  try {
    const { error } = await supabaseClient
      .from('coffee_beans')
      .select('id')
      .limit(1);

    if (error) {
      // 表不存在也算连接成功
      if (error.code === '42P01') {
        console.warn('⚠️ [Supabase] 连接成功，但数据表尚未创建');
        return true;
      }
      console.error('❌ [Supabase] 连接测试失败:', error.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ [Supabase] 连接测试异常:', error);
    return false;
  }
}

// ============================================
// 上传数据
// ============================================

/**
 * 上传所有本地数据到云端
 * 策略：全量上传，并行处理提升速度
 */
export async function uploadAllData(): Promise<SyncResult> {
  const syncStatusStore = getSyncStatusStore();

  if (!supabaseClient) {
    return {
      success: false,
      message: '未连接',
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
    // 并行读取本地数据
    const [beans, notes, equipments, methods] = await Promise.all([
      db.coffeeBeans.toArray(),
      db.brewingNotes.toArray(),
      db.customEquipments.toArray(),
      db.customMethods.toArray(),
    ]);

    console.log(
      `[Supabase] 本地数据: 咖啡豆 ${beans.length}, 笔记 ${notes.length}, 器具 ${equipments.length}, 方案 ${methods.length}`
    );

    // 准备上传任务（使用异步函数数组）
    type UploadResult = { type: string; count: number; error?: string };
    const uploadTasks: (() => Promise<UploadResult>)[] = [];
    const client = supabaseClient; // 在闭包中捕获

    if (beans.length > 0) {
      uploadTasks.push(async () => {
        const records = beans.map(bean => ({
          id: bean.id,
          user_id: DEFAULT_USER_ID,
          data: bean,
          updated_at: new Date(bean.timestamp || Date.now()).toISOString(),
        }));
        const { error } = await client
          .from('coffee_beans')
          .upsert(records, { onConflict: 'id,user_id' });
        return {
          type: '咖啡豆',
          count: error ? 0 : beans.length,
          error: error?.message,
        };
      });
    }

    if (notes.length > 0) {
      uploadTasks.push(async () => {
        const records = notes.map(note => ({
          id: note.id,
          user_id: DEFAULT_USER_ID,
          data: note,
          updated_at: new Date(note.timestamp || Date.now()).toISOString(),
        }));
        const { error } = await client
          .from('brewing_notes')
          .upsert(records, { onConflict: 'id,user_id' });
        return {
          type: '冲煮笔记',
          count: error ? 0 : notes.length,
          error: error?.message,
        };
      });
    }

    if (equipments.length > 0) {
      uploadTasks.push(async () => {
        const records = equipments.map(eq => ({
          id: eq.id,
          user_id: DEFAULT_USER_ID,
          data: eq,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await client
          .from('custom_equipments')
          .upsert(records, { onConflict: 'id,user_id' });
        return {
          type: '自定义器具',
          count: error ? 0 : equipments.length,
          error: error?.message,
        };
      });
    }

    if (methods.length > 0) {
      uploadTasks.push(async () => {
        const records = methods.map(m => ({
          id: m.equipmentId,
          user_id: DEFAULT_USER_ID,
          equipment_id: m.equipmentId,
          data: m,
          updated_at: new Date().toISOString(),
        }));
        const { error } = await client
          .from('custom_methods')
          .upsert(records, { onConflict: 'id,user_id' });
        return {
          type: '自定义方案',
          count: error ? 0 : methods.length,
          error: error?.message,
        };
      });
    }

    // 上传设置数据
    uploadTasks.push(async () => {
      try {
        const settingsData: Record<string, unknown> = {};

        // 收集所有设置数据
        for (const key of SETTINGS_KEYS_TO_SYNC) {
          const value = await Storage.get(key);
          if (value) {
            try {
              let parsedValue = JSON.parse(value);
              // 处理 Zustand persist 格式
              if (key === 'brewGuideSettings' && parsedValue?.state?.settings) {
                parsedValue = parsedValue.state.settings;
              }
              settingsData[key] = parsedValue;
            } catch {
              settingsData[key] = value;
            }
          }
        }

        // 收集自定义预设数据
        if (typeof window !== 'undefined') {
          const customPresets: Record<string, unknown> = {};
          for (const presetKey of CUSTOM_PRESETS_KEYS) {
            const storageKey = `${CUSTOM_PRESETS_PREFIX}${presetKey}`;
            const presetJson = localStorage.getItem(storageKey);
            if (presetJson) {
              try {
                customPresets[presetKey] = JSON.parse(presetJson);
              } catch {
                // 忽略解析错误
              }
            }
          }
          if (Object.keys(customPresets).length > 0) {
            settingsData.customPresets = customPresets;
          }

          // 收集烘焙商图标数据
          const roasterLogosJson = localStorage.getItem(ROASTER_LOGOS_KEY);
          if (roasterLogosJson) {
            try {
              settingsData[ROASTER_LOGOS_KEY] = JSON.parse(roasterLogosJson);
            } catch {
              // 忽略解析错误
            }
          }
        }

        // 上传设置数据
        const { error } = await client.from('user_settings').upsert(
          {
            id: 'app_settings',
            user_id: DEFAULT_USER_ID,
            data: settingsData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id,user_id' }
        );

        return {
          type: '用户设置',
          count: error ? 0 : Object.keys(settingsData).length,
          error: error?.message,
        };
      } catch (err) {
        return {
          type: '用户设置',
          count: 0,
          error: err instanceof Error ? err.message : '设置上传失败',
        };
      }
    });

    // 并行执行所有上传任务
    const results = await Promise.all(uploadTasks.map(task => task()));

    // 统计结果
    for (const result of results) {
      if (result.error) {
        console.error(`[Supabase] ${result.type}上传失败:`, result.error);
        errors.push(`${result.type}上传失败: ${result.error}`);
      } else {
        uploaded += result.count;
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Supabase] 上传完成，共 ${uploaded} 条，耗时: ${totalTime}ms`);

    const message =
      errors.length === 0
        ? `上传成功: ${uploaded} 条记录 (${totalTime}ms)`
        : `上传完成，但有 ${errors.length} 个错误`;

    const success = errors.length === 0;
    if (success) {
      syncStatusStore.setSyncSuccess();
    } else {
      syncStatusStore.setSyncError(message);
    }

    return {
      success,
      message,
      uploaded,
      downloaded: 0,
      errors,
    };
  } catch (error) {
    console.error('❌ [Supabase] 上传失败:', error);
    const errorMessage = error instanceof Error ? error.message : '上传失败';
    syncStatusStore.setSyncError(errorMessage);
    return {
      success: false,
      message: errorMessage,
      uploaded,
      downloaded: 0,
      errors: [...errors, error instanceof Error ? error.message : '未知错误'],
    };
  }
}

// ============================================
// 下载数据
// ============================================

/**
 * 从云端下载所有数据并替换本地
 * 策略：云端是权威数据源，全量下载保证数据一致性
 * 优化：并行下载所有表，大幅提升速度
 */
export async function downloadAllData(): Promise<SyncResult> {
  const syncStatusStore = getSyncStatusStore();

  if (!supabaseClient) {
    return {
      success: false,
      message: '未连接',
      uploaded: 0,
      downloaded: 0,
      errors: ['客户端未初始化'],
    };
  }

  const errors: string[] = [];
  let downloaded = 0;

  syncStatusStore.setSyncing();

  const startTime = Date.now();
  console.log('[Supabase] 开始并行下载所有数据...');

  try {
    // 并行下载所有表数据
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

    const downloadTime = Date.now() - startTime;
    console.log(`[Supabase] 并行下载完成，耗时: ${downloadTime}ms`);

    // 辅助函数：安全获取错误消息
    const getErrorMessage = (error: unknown): string => {
      if (!error) return '未知错误';
      if (typeof error === 'string') return error;
      if (error instanceof Error) return error.message;
      if (typeof error === 'object' && error !== null) {
        const e = error as Record<string, unknown>;
        if (typeof e.message === 'string') return e.message;
        if (typeof e.error === 'string') return e.error;
        // 尝试序列化对象
        try {
          return JSON.stringify(error);
        } catch {
          return '错误对象无法解析';
        }
      }
      return String(error);
    };

    // 处理咖啡豆数据
    if (beansResult.error) {
      const errorMsg = getErrorMessage(beansResult.error);
      console.error('[Supabase] 下载咖啡豆失败:', beansResult.error);
      errors.push(`咖啡豆下载失败: ${errorMsg}`);
    } else if (beansResult.data) {
      const beans = beansResult.data.map(
        (row: { data: CoffeeBean }) => row.data
      );
      console.log(`[Supabase] 下载到 ${beans.length} 条咖啡豆`);
      // 清空并重新写入 IndexedDB
      await db.coffeeBeans.clear();
      if (beans.length > 0) {
        await db.coffeeBeans.bulkPut(beans);
      }
      // 直接更新 Store
      const { getCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
      getCoffeeBeanStore().setBeans(beans);
      downloaded += beans.length;
    }

    // 处理冲煮笔记数据
    if (notesResult.error) {
      const errorMsg = getErrorMessage(notesResult.error);
      console.error('[Supabase] 下载冲煮笔记失败:', notesResult.error);
      errors.push(`冲煮笔记下载失败: ${errorMsg}`);
    } else if (notesResult.data) {
      const notes = notesResult.data.map(
        (row: { data: BrewingNote }) => row.data
      );
      console.log(`[Supabase] 下载到 ${notes.length} 条笔记`);
      // 清空并重新写入 IndexedDB
      await db.brewingNotes.clear();
      if (notes.length > 0) {
        await db.brewingNotes.bulkPut(notes);
      }
      // 直接更新 Store
      const { getBrewingNoteStore } = await import(
        '@/lib/stores/brewingNoteStore'
      );
      getBrewingNoteStore().setNotes(notes);
      downloaded += notes.length;
    }

    // 处理自定义器具数据
    if (equipmentsResult.error) {
      const errorMsg = getErrorMessage(equipmentsResult.error);
      console.error(
        '❌ [Supabase] 下载自定义器具失败:',
        equipmentsResult.error
      );
      errors.push(`自定义器具下载失败: ${errorMsg}`);
    } else if (equipmentsResult.data && equipmentsResult.data.length > 0) {
      const equipments = equipmentsResult.data.map(
        (row: { data: CustomEquipment }) => row.data
      );
      await db.customEquipments.clear();
      await db.customEquipments.bulkPut(equipments);
      downloaded += equipments.length;
    }

    // 处理自定义方案数据
    if (methodsResult.error) {
      const errorMsg = getErrorMessage(methodsResult.error);
      console.error('❌ [Supabase] 下载自定义方案失败:', methodsResult.error);
      errors.push(`自定义方案下载失败: ${errorMsg}`);
    } else if (methodsResult.data && methodsResult.data.length > 0) {
      const methods = methodsResult.data.map(
        (row: { data: { equipmentId: string; methods: Method[] } }) => row.data
      );
      await db.customMethods.clear();
      await db.customMethods.bulkPut(methods);
      downloaded += methods.length;
    }

    // 处理设置数据
    if (settingsResult.error && settingsResult.error.code !== 'PGRST116') {
      // PGRST116 = no rows found，这是正常情况
      const errorMsg = getErrorMessage(settingsResult.error);
      console.error('❌ [Supabase] 下载设置失败:', settingsResult.error);
      errors.push(`设置下载失败: ${errorMsg}`);
    } else if (settingsResult.data?.data) {
      const settingsData = settingsResult.data.data as Record<string, unknown>;
      console.log(
        `[Supabase] 下载到设置数据，共 ${Object.keys(settingsData).length} 项`
      );

      // 设置标志，防止触发本地上传形成循环
      isProcessingRemoteUpdate = true;

      try {
        // 恢复设置数据
        for (const key of SETTINGS_KEYS_TO_SYNC) {
          if (settingsData[key] !== undefined) {
            const value =
              typeof settingsData[key] === 'object'
                ? JSON.stringify(settingsData[key])
                : String(settingsData[key]);
            await Storage.set(key, value);
          }
        }

        // 恢复自定义预设数据
        if (typeof window !== 'undefined' && settingsData.customPresets) {
          const customPresets = settingsData.customPresets as Record<
            string,
            unknown
          >;
          for (const presetKey of CUSTOM_PRESETS_KEYS) {
            if (customPresets[presetKey]) {
              const storageKey = `${CUSTOM_PRESETS_PREFIX}${presetKey}`;
              localStorage.setItem(
                storageKey,
                JSON.stringify(customPresets[presetKey])
              );
            }
          }
        }

        // 恢复烘焙商图标数据
        if (typeof window !== 'undefined' && settingsData[ROASTER_LOGOS_KEY]) {
          localStorage.setItem(
            ROASTER_LOGOS_KEY,
            JSON.stringify(settingsData[ROASTER_LOGOS_KEY])
          );
        }
      } finally {
        // 延迟重置标志，确保所有事件都被忽略
        setTimeout(() => {
          isProcessingRemoteUpdate = false;
        }, 100);
      }

      downloaded += Object.keys(settingsData).length;

      // 触发设置变更事件
      window.dispatchEvent(
        new CustomEvent('storageChange', {
          detail: { key: 'brewGuideSettings', source: 'supabase' },
        })
      );

      // 派发 settingsChanged 事件，通知 UI 组件刷新
      window.dispatchEvent(new CustomEvent('settingsChanged'));

      // 如果器具排序有变化，触发器具排序事件
      if (settingsData['equipmentOrder']) {
        try {
          const { equipmentEventBus } = await import(
            '@/lib/equipment/equipmentEventBus'
          );
          equipmentEventBus.notify();
        } catch (e) {
          console.error('[Supabase] 触发器具排序事件失败:', e);
        }
      }

      // 通知 grinderStore 重新加载（磨豆机数据在 brewGuideSettings 内）
      try {
        const { useGrinderStore } = await import('@/lib/stores/grinderStore');
        const store = useGrinderStore.getState();
        // 强制重新初始化以加载新数据
        (store as unknown as { initialized: boolean }).initialized = false;
        await store.initialize();
      } catch (e) {
        console.error('[Supabase] 刷新磨豆机数据失败:', e);
      }
    }

    // 通知数据变更回调
    if (dataChangeCallback) {
      dataChangeCallback('all');
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Supabase] 下载处理完成，总耗时: ${totalTime}ms`);

    // 判断同步状态：只要主要数据（咖啡豆、笔记）下载成功就算成功
    // 注意：如果没有数据，但请求成功（没有 error），也算成功
    const hasCriticalError = errors.some(
      e => e.includes('咖啡豆') || e.includes('笔记')
    );
    const isSuccess = !hasCriticalError;

    const message =
      errors.length === 0
        ? `下载成功: ${downloaded} 条记录 (${totalTime}ms)`
        : hasCriticalError
          ? `下载失败: ${errors[0]}`
          : `下载成功: ${downloaded} 条记录`;

    // 确保最终状态一定被设置（不能停留在 syncing）
    if (isSuccess) {
      syncStatusStore.setSyncSuccess();
    } else {
      syncStatusStore.setSyncError(message);
    }

    console.log(`[Supabase] 下载状态更新: ${isSuccess ? 'success' : 'error'}`);

    return {
      success: isSuccess,
      message,
      uploaded: 0,
      downloaded,
      errors,
    };
  } catch (error) {
    console.error('❌ [Supabase] 下载失败:', error);
    const errorMessage = error instanceof Error ? error.message : '下载失败';
    syncStatusStore.setSyncError(errorMessage);
    return {
      success: false,
      message: errorMessage,
      uploaded: 0,
      downloaded,
      errors: [...errors, error instanceof Error ? error.message : '未知错误'],
    };
  }
}

// ============================================
// 完整同步
// ============================================

/**
 * 完整同步：先下载云端数据，再上传本地数据
 * 策略：云端优先，本地新数据会被上传
 */
export async function fullSync(): Promise<SyncResult> {
  if (!supabaseClient) {
    return {
      success: false,
      message: '未连接',
      uploaded: 0,
      downloaded: 0,
      errors: ['客户端未初始化'],
    };
  }

  // 先上传本地数据
  const uploadResult = await uploadAllData();

  // 再下载云端数据（合并）
  const downloadResult = await downloadAllData();

  const errors = [...uploadResult.errors, ...downloadResult.errors];
  const success = errors.length === 0;

  return {
    success,
    message: success
      ? `同步完成: 上传 ${uploadResult.uploaded}，下载 ${downloadResult.downloaded}`
      : '同步完成，但有错误',
    uploaded: uploadResult.uploaded,
    downloaded: downloadResult.downloaded,
    errors,
  };
}

// ============================================
// 单条数据同步
// ============================================

/**
 * 上传单个咖啡豆
 */
export async function uploadCoffeeBean(bean: CoffeeBean): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient.from('coffee_beans').upsert(
      {
        id: bean.id,
        user_id: DEFAULT_USER_ID,
        data: bean,
        updated_at: new Date(bean.timestamp || Date.now()).toISOString(),
      },
      { onConflict: 'id,user_id' }
    );

    if (error) {
      console.error('❌ [Supabase] 上传咖啡豆失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ [Supabase] 上传咖啡豆异常:', error);
    return false;
  }
}

/**
 * 删除咖啡豆（软删除）
 */
export async function deleteCoffeeBean(beanId: string): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient
      .from('coffee_beans')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', beanId)
      .eq('user_id', DEFAULT_USER_ID);

    if (error) {
      console.error('❌ [Supabase] 删除咖啡豆失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ [Supabase] 删除咖啡豆异常:', error);
    return false;
  }
}

/**
 * 上传单条冲煮笔记
 */
export async function uploadBrewingNote(note: BrewingNote): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient.from('brewing_notes').upsert(
      {
        id: note.id,
        user_id: DEFAULT_USER_ID,
        data: note,
        updated_at: new Date(note.timestamp || Date.now()).toISOString(),
      },
      { onConflict: 'id,user_id' }
    );

    if (error) {
      console.error('❌ [Supabase] 上传冲煮笔记失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ [Supabase] 上传冲煮笔记异常:', error);
    return false;
  }
}

/**
 * 删除冲煮笔记（软删除）
 */
export async function deleteBrewingNote(noteId: string): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient
      .from('brewing_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('user_id', DEFAULT_USER_ID);

    if (error) {
      console.error('❌ [Supabase] 删除冲煮笔记失败:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ [Supabase] 删除冲煮笔记异常:', error);
    return false;
  }
}

// ============================================
// 实时同步
// ============================================

/**
 * 设置数据变更回调
 */
export function setDataChangeCallback(
  callback: DataChangeCallback | null
): void {
  dataChangeCallback = callback;
}

export function startRealtimeSync(): boolean {
  if (!supabaseClient) {
    console.error('[Supabase] Client not initialized');
    return false;
  }

  if (realtimeChannel) {
    return true;
  }

  try {
    realtimeChannel = supabaseClient
      .channel('brew-guide-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'coffee_beans',
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload => {
          handleRealtimeChange('coffee_beans', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'brewing_notes',
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload => {
          handleRealtimeChange('brewing_notes', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_equipments',
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload => {
          handleRealtimeChange('custom_equipments', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_methods',
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload => {
          handleRealtimeChange('custom_methods', payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_settings',
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload => {
          handleRealtimeChange('user_settings', payload);
        }
      )
      .subscribe();

    return true;
  } catch (error) {
    console.error('[Supabase] startRealtimeSync failed:', error);
    return false;
  }
}

export function stopRealtimeSync(): void {
  if (realtimeChannel) {
    realtimeChannel.unsubscribe();
    realtimeChannel = null;
  }
}

/**
 * 获取实时连接状态
 */
export function getRealtimeStatus(): 'connected' | 'disconnected' {
  return realtimeChannel ? 'connected' : 'disconnected';
}

/**
 * 处理实时变更 - 直接更新本地数据库
 */
async function handleRealtimeChange(
  table: string,
  payload: { eventType: string; new: unknown; old: unknown }
): Promise<void> {
  try {
    const newRecord = payload.new as DbRecord<unknown> | null;
    const oldRecord = payload.old as DbRecord<unknown> | null;

    if (table === 'coffee_beans') {
      const { getCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
      const store = getCoffeeBeanStore();

      if (
        payload.eventType === 'DELETE' ||
        (newRecord && (newRecord as DbRecord<CoffeeBean>).deleted_at)
      ) {
        const id = oldRecord?.id || (newRecord as DbRecord<CoffeeBean>)?.id;
        if (id) {
          await store.removeBean(id);
        }
      } else if (newRecord) {
        const bean = (newRecord as DbRecord<CoffeeBean>).data;
        await store.upsertBean(bean);
      }
    } else if (table === 'brewing_notes') {
      const { getBrewingNoteStore } = await import(
        '@/lib/stores/brewingNoteStore'
      );
      const store = getBrewingNoteStore();

      if (
        payload.eventType === 'DELETE' ||
        (newRecord && (newRecord as DbRecord<BrewingNote>).deleted_at)
      ) {
        const id = oldRecord?.id || (newRecord as DbRecord<BrewingNote>)?.id;
        if (id) {
          await store.removeNote(id);
        }
      } else if (newRecord) {
        const note = (newRecord as DbRecord<BrewingNote>).data;
        await store.upsertNote(note);
      }
    } else if (table === 'custom_equipments') {
      // 自定义器具实时更新
      const { invalidateEquipmentsCache } = await import(
        '@/lib/managers/customEquipments'
      );

      if (
        payload.eventType === 'DELETE' ||
        (newRecord && (newRecord as DbRecord<CustomEquipment>).deleted_at)
      ) {
        const id =
          oldRecord?.id || (newRecord as DbRecord<CustomEquipment>)?.id;
        if (id) {
          await db.customEquipments.delete(id);
          invalidateEquipmentsCache();
        }
      } else if (newRecord) {
        const equipment = (newRecord as DbRecord<CustomEquipment>).data;
        await db.customEquipments.put(equipment);
        invalidateEquipmentsCache();
      }

      // 触发自定义事件通知 UI 更新（派发多个事件名以确保兼容）
      window.dispatchEvent(
        new CustomEvent('customEquipmentDataChanged', {
          detail: { source: 'supabase' },
        })
      );
      window.dispatchEvent(
        new CustomEvent('customEquipmentUpdate', {
          detail: { source: 'supabase' },
        })
      );
      window.dispatchEvent(
        new CustomEvent('storage:changed', {
          detail: { key: 'customEquipments', source: 'supabase' },
        })
      );
    } else if (table === 'custom_methods') {
      // 自定义方案实时更新
      type MethodsRecord = { equipmentId: string; methods: Method[] };

      if (
        payload.eventType === 'DELETE' ||
        (newRecord && (newRecord as DbRecord<MethodsRecord>).deleted_at)
      ) {
        const equipmentId =
          oldRecord?.id || (newRecord as DbRecord<MethodsRecord>)?.id;
        if (equipmentId) {
          await db.customMethods.delete(equipmentId);
        }
      } else if (newRecord) {
        const methodsData = (newRecord as DbRecord<MethodsRecord>).data;
        if (methodsData && methodsData.equipmentId) {
          await db.customMethods.put(methodsData);
        }
      }

      // 触发自定义事件通知 UI 更新（派发多个事件名以确保兼容）
      window.dispatchEvent(
        new CustomEvent('customMethodDataChanged', {
          detail: { source: 'supabase' },
        })
      );
      window.dispatchEvent(
        new CustomEvent('customMethodUpdate', {
          detail: { source: 'supabase' },
        })
      );
      window.dispatchEvent(
        new CustomEvent('customMethodsChanged', {
          detail: { source: 'supabase' },
        })
      );
      window.dispatchEvent(
        new CustomEvent('storage:changed', {
          detail: { key: 'customMethods', source: 'supabase' },
        })
      );
    } else if (table === 'user_settings') {
      // 设置数据实时更新
      if (newRecord && payload.eventType !== 'DELETE') {
        const settingsData = (newRecord as DbRecord<Record<string, unknown>>)
          .data;

        if (settingsData) {
          console.log('[Supabase] 收到设置数据实时更新');

          // 设置标志，防止触发本地上传形成循环
          isProcessingRemoteUpdate = true;

          try {
            // 恢复设置数据
            for (const key of SETTINGS_KEYS_TO_SYNC) {
              if (settingsData[key] !== undefined) {
                const value =
                  typeof settingsData[key] === 'object'
                    ? JSON.stringify(settingsData[key])
                    : String(settingsData[key]);
                await Storage.set(key, value);
              }
            }

            // 恢复自定义预设数据
            if (typeof window !== 'undefined' && settingsData.customPresets) {
              const customPresets = settingsData.customPresets as Record<
                string,
                unknown
              >;
              for (const presetKey of CUSTOM_PRESETS_KEYS) {
                if (customPresets[presetKey]) {
                  const storageKey = `${CUSTOM_PRESETS_PREFIX}${presetKey}`;
                  localStorage.setItem(
                    storageKey,
                    JSON.stringify(customPresets[presetKey])
                  );
                }
              }
            }

            // 恢复烘焙商图标数据
            if (
              typeof window !== 'undefined' &&
              settingsData[ROASTER_LOGOS_KEY]
            ) {
              localStorage.setItem(
                ROASTER_LOGOS_KEY,
                JSON.stringify(settingsData[ROASTER_LOGOS_KEY])
              );
            }
          } finally {
            // 延迟重置标志，确保所有事件都被忽略
            setTimeout(() => {
              isProcessingRemoteUpdate = false;
            }, 100);
          }

          // 触发设置变更事件（用于 UI 刷新，source 为 supabase）
          window.dispatchEvent(
            new CustomEvent('storageChange', {
              detail: { key: 'brewGuideSettings', source: 'supabase' },
            })
          );

          // 派发 settingsChanged 事件，通知 UI 组件刷新
          window.dispatchEvent(new CustomEvent('settingsChanged'));

          // 如果器具排序有变化，触发器具排序事件
          if (settingsData['equipmentOrder']) {
            try {
              const { equipmentEventBus } = await import(
                '@/lib/equipment/equipmentEventBus'
              );
              equipmentEventBus.notify();
            } catch (e) {
              console.error('[Supabase] 触发器具排序事件失败:', e);
            }
          }

          // 通知 grinderStore 重新加载（磨豆机数据在 brewGuideSettings 内）
          try {
            const { useGrinderStore } = await import(
              '@/lib/stores/grinderStore'
            );
            const store = useGrinderStore.getState();
            // 强制重新初始化以加载新数据
            (store as unknown as { initialized: boolean }).initialized = false;
            await store.initialize();
          } catch (e) {
            console.error('[Supabase] 刷新磨豆机数据失败:', e);
          }
        }
      }
    }

    if (dataChangeCallback) {
      dataChangeCallback(table);
    }
  } catch (error) {
    console.error('[Supabase] handleRealtimeChange failed:', error);
  }
}

// ============================================
// 本地数据变更监听（上传到云端）
// ============================================

let localListenersStarted = false;

/**
 * 开始监听本地数据变更，自动上传到云端
 */
export function startLocalChangeListeners(): void {
  if (localListenersStarted) {
    return;
  }

  // 监听咖啡豆变更
  window.addEventListener(
    'coffeeBeanDataChanged',
    handleCoffeeBeanChange as unknown as EventListener
  );

  // 监听冲煮笔记变更
  window.addEventListener(
    'brewingNoteDataChanged',
    handleBrewingNoteChange as unknown as EventListener
  );

  // 监听自定义器具变更
  window.addEventListener(
    'customEquipmentDataChanged',
    handleCustomEquipmentChange as unknown as EventListener
  );

  // 监听自定义方案变更
  window.addEventListener(
    'customMethodDataChanged',
    handleCustomMethodChange as unknown as EventListener
  );

  // 监听设置变更（监听多个事件名以确保兼容）
  window.addEventListener(
    'storageChange',
    handleSettingsChange as unknown as EventListener
  );
  window.addEventListener(
    'storage:changed',
    handleSettingsChange as unknown as EventListener
  );

  localListenersStarted = true;
}

/**
 * 停止监听本地数据变更
 */
export function stopLocalChangeListeners(): void {
  window.removeEventListener(
    'coffeeBeanDataChanged',
    handleCoffeeBeanChange as unknown as EventListener
  );
  window.removeEventListener(
    'brewingNoteDataChanged',
    handleBrewingNoteChange as unknown as EventListener
  );
  window.removeEventListener(
    'customEquipmentDataChanged',
    handleCustomEquipmentChange as unknown as EventListener
  );
  window.removeEventListener(
    'customMethodDataChanged',
    handleCustomMethodChange as unknown as EventListener
  );
  window.removeEventListener(
    'storageChange',
    handleSettingsChange as unknown as EventListener
  );
  window.removeEventListener(
    'storage:changed',
    handleSettingsChange as unknown as EventListener
  );
  localListenersStarted = false;
}

/**
 * 处理咖啡豆变更
 */
async function handleCoffeeBeanChange(event: CustomEvent): Promise<void> {
  if (!isInitialized) return;

  const { action, beanId, bean } = event.detail || {};

  try {
    if (action === 'delete' && beanId) {
      await deleteCoffeeBean(beanId);
    } else {
      let beanData = bean;
      if (!beanData && beanId) {
        beanData = await db.coffeeBeans.get(beanId);
      }
      if (beanData) {
        await uploadCoffeeBean(beanData);
      }
    }
  } catch (error) {
    console.error('❌ [Supabase] 处理咖啡豆变更失败:', error);
  }
}

/**
 * 处理冲煮笔记变更
 */
async function handleBrewingNoteChange(event: CustomEvent): Promise<void> {
  if (!isInitialized) return;

  const { action, noteId, note } = event.detail || {};

  try {
    if (action === 'delete' && noteId) {
      await deleteBrewingNote(noteId);
    } else {
      let noteData = note;
      if (!noteData && noteId) {
        noteData = await db.brewingNotes.get(noteId);
      }
      if (noteData) {
        await uploadBrewingNote(noteData);
      }
    }
  } catch (error) {
    console.error('❌ [Supabase] 处理冲煮笔记变更失败:', error);
  }
}

/**
 * 处理自定义器具变更
 */
async function handleCustomEquipmentChange(event: CustomEvent): Promise<void> {
  if (!isInitialized) return;

  // 忽略来自 Supabase 的变更（避免循环）
  if (event.detail?.source === 'supabase') return;

  const { action, equipmentId, equipment } = event.detail || {};

  try {
    if (action === 'delete' && equipmentId) {
      await deleteCustomEquipment(equipmentId);
    } else {
      let equipmentData = equipment;
      if (!equipmentData && equipmentId) {
        equipmentData = await db.customEquipments.get(equipmentId);
      }
      if (equipmentData) {
        await uploadCustomEquipment(equipmentData);
      }
    }
  } catch (error) {
    console.error('❌ [Supabase] 处理自定义器具变更失败:', error);
  }
}

/**
 * 处理自定义方案变更
 */
async function handleCustomMethodChange(event: CustomEvent): Promise<void> {
  if (!isInitialized) return;

  // 忽略来自 Supabase 的变更（避免循环）
  if (event.detail?.source === 'supabase') return;

  const { equipmentId, methods } = event.detail || {};

  try {
    if (equipmentId) {
      let methodsData = methods;
      if (!methodsData) {
        const record = await db.customMethods.get(equipmentId);
        methodsData = record?.methods;
      }
      if (methodsData) {
        await uploadCustomMethods(equipmentId, methodsData);
      }
    }
  } catch (error) {
    console.error('❌ [Supabase] 处理自定义方案变更失败:', error);
  }
}

// 防抖定时器，避免设置频繁变更时多次上传
let settingsUploadDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 处理设置变更
 */
async function handleSettingsChange(event: CustomEvent): Promise<void> {
  if (!isInitialized) return;

  // 忽略来自 Supabase 的变更（避免循环）
  if (event.detail?.source === 'supabase') return;

  // 如果正在处理远程更新，忽略（避免循环）
  if (isProcessingRemoteUpdate) return;

  // 只处理相关的设置键
  const key = event.detail?.key;
  if (!key || !SETTINGS_KEYS_TO_SYNC.includes(key)) return;

  // 使用防抖，避免频繁上传
  if (settingsUploadDebounceTimer) {
    clearTimeout(settingsUploadDebounceTimer);
  }

  settingsUploadDebounceTimer = setTimeout(async () => {
    try {
      await uploadUserSettings();
    } catch (error) {
      console.error('❌ [Supabase] 处理设置变更失败:', error);
    }
  }, 2000); // 2秒防抖
}

// ============================================
// 单条数据上传/删除 - 自定义器具
// ============================================

/**
 * 上传单个自定义器具
 */
export async function uploadCustomEquipment(
  equipment: CustomEquipment
): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient.from('custom_equipments').upsert(
      {
        id: equipment.id,
        user_id: DEFAULT_USER_ID,
        data: equipment,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id,user_id' }
    );

    if (error) {
      console.error('❌ [Supabase] 上传自定义器具失败:', error);
      return false;
    }

    console.log('✅ [Supabase] 自定义器具已上传:', equipment.id);
    return true;
  } catch (error) {
    console.error('❌ [Supabase] 上传自定义器具异常:', error);
    return false;
  }
}

/**
 * 删除单个自定义器具（软删除）
 */
export async function deleteCustomEquipment(
  equipmentId: string
): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient
      .from('custom_equipments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', equipmentId)
      .eq('user_id', DEFAULT_USER_ID);

    if (error) {
      console.error('❌ [Supabase] 删除自定义器具失败:', error);
      return false;
    }

    console.log('✅ [Supabase] 自定义器具已删除:', equipmentId);
    return true;
  } catch (error) {
    console.error('❌ [Supabase] 删除自定义器具异常:', error);
    return false;
  }
}

// ============================================
// 单条数据上传/删除 - 自定义方案
// ============================================

/**
 * 上传自定义方案（按器具）
 */
export async function uploadCustomMethods(
  equipmentId: string,
  methods: Method[]
): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient.from('custom_methods').upsert(
      {
        id: equipmentId,
        user_id: DEFAULT_USER_ID,
        equipment_id: equipmentId,
        data: { equipmentId, methods },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id,user_id' }
    );

    if (error) {
      console.error('❌ [Supabase] 上传自定义方案失败:', error);
      return false;
    }

    console.log('✅ [Supabase] 自定义方案已上传:', equipmentId);
    return true;
  } catch (error) {
    console.error('❌ [Supabase] 上传自定义方案异常:', error);
    return false;
  }
}

/**
 * 删除自定义方案（软删除）
 */
export async function deleteCustomMethods(
  equipmentId: string
): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const { error } = await supabaseClient
      .from('custom_methods')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', equipmentId)
      .eq('user_id', DEFAULT_USER_ID);

    if (error) {
      console.error('❌ [Supabase] 删除自定义方案失败:', error);
      return false;
    }

    console.log('✅ [Supabase] 自定义方案已删除:', equipmentId);
    return true;
  } catch (error) {
    console.error('❌ [Supabase] 删除自定义方案异常:', error);
    return false;
  }
}

// ============================================
// 单条数据上传 - 用户设置
// ============================================

/**
 * 上传用户设置数据
 * 收集所有设置并一次性上传到 user_settings 表
 */
export async function uploadUserSettings(): Promise<boolean> {
  if (!supabaseClient) return false;

  try {
    const settingsData: Record<string, unknown> = {};

    // 收集所有设置数据
    for (const key of SETTINGS_KEYS_TO_SYNC) {
      const value = await Storage.get(key);
      if (value) {
        try {
          let parsedValue = JSON.parse(value);
          // 处理 Zustand persist 格式
          if (key === 'brewGuideSettings' && parsedValue?.state?.settings) {
            parsedValue = parsedValue.state.settings;
          }
          settingsData[key] = parsedValue;
        } catch {
          settingsData[key] = value;
        }
      }
    }

    // 收集自定义预设数据
    if (typeof window !== 'undefined') {
      const customPresets: Record<string, unknown> = {};
      for (const presetKey of CUSTOM_PRESETS_KEYS) {
        const storageKey = `${CUSTOM_PRESETS_PREFIX}${presetKey}`;
        const presetJson = localStorage.getItem(storageKey);
        if (presetJson) {
          try {
            customPresets[presetKey] = JSON.parse(presetJson);
          } catch {
            // 忽略解析错误
          }
        }
      }
      if (Object.keys(customPresets).length > 0) {
        settingsData.customPresets = customPresets;
      }

      // 收集烘焙商图标数据
      const roasterLogosJson = localStorage.getItem(ROASTER_LOGOS_KEY);
      if (roasterLogosJson) {
        try {
          settingsData[ROASTER_LOGOS_KEY] = JSON.parse(roasterLogosJson);
        } catch {
          // 忽略解析错误
        }
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
      console.error('❌ [Supabase] 上传用户设置失败:', error);
      return false;
    }

    console.log('✅ [Supabase] 用户设置已上传');
    return true;
  } catch (error) {
    console.error('❌ [Supabase] 上传用户设置异常:', error);
    return false;
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
  fullSync,
  // 咖啡豆
  uploadCoffeeBean,
  deleteCoffeeBean,
  // 冲煮笔记
  uploadBrewingNote,
  deleteBrewingNote,
  // 自定义器具
  uploadCustomEquipment,
  deleteCustomEquipment,
  // 自定义方案
  uploadCustomMethods,
  deleteCustomMethods,
  // 用户设置
  uploadUserSettings,
  // 实时同步
  startRealtimeSync,
  stopRealtimeSync,
  getRealtimeStatus,
  startLocalChangeListeners,
  stopLocalChangeListeners,
  setDataChangeCallback,
};

export default simpleSyncService;
