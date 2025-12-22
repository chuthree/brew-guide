/**
 * Supabase 同步管理器
 *
 * 基于业界标准的同步实现（CouchDB 墓碑模式 + RxDB 离线优先架构）
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '@/lib/core/db';
import { Storage } from '@/lib/core/storage';
import { getSyncStatusStore } from '@/lib/stores/syncStatusStore';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';
import type {
  ISyncManager,
  ISyncOptions,
  ISyncResult,
} from '@/lib/sync/interfaces';
import {
  createFailureResult,
  createSuccessResult,
} from '@/lib/sync/interfaces';
import {
  syncTableUpload,
  fetchRemoteActiveRecords,
  SYNC_TABLES,
  DEFAULT_USER_ID,
} from './syncOperations';

const SETTINGS_KEYS = [
  'brewGuideSettings',
  'brewingNotesVersion',
  'equipmentOrder',
  'onboardingCompleted',
  'customFlavorDimensions',
  'flavorDimensionHistoricalLabels',
  'backupReminderSettings',
  'yearlyReports',
  'yearlyReviewReminderSettings',
] as const;

const PRESETS_PREFIX = 'brew-guide:custom-presets:';
const PRESETS_KEYS = ['origins', 'estates', 'processes', 'varieties'] as const;
const ROASTER_LOGOS_KEY = 'roaster-logos';

interface SupabaseConfig {
  provider: 'supabase';
  url: string;
  anonKey: string;
}

export class SupabaseSyncManager implements ISyncManager {
  readonly provider = 'supabase' as const;
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig | null = null;

  isInitialized(): boolean {
    return this.client !== null;
  }

  async initialize(config: SupabaseConfig): Promise<boolean> {
    if (!config.url || !config.anonKey) return false;

    if (
      this.config?.url === config.url &&
      this.config?.anonKey === config.anonKey &&
      this.client
    ) {
      return true;
    }

    try {
      this.client = createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      this.config = config;
      return true;
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('coffee_beans')
        .select('id')
        .limit(1);
      return !error || error.code === '42P01';
    } catch {
      return false;
    }
  }

  async sync(options: ISyncOptions): Promise<ISyncResult> {
    if (!this.client) return createFailureResult('客户端未初始化');

    const store = getSyncStatusStore();
    store.setProvider('supabase');
    store.setSyncing();

    const onProgress = options.onProgress;

    try {
      const result =
        options.direction === 'upload'
          ? await this.upload(onProgress)
          : await this.download(onProgress);
      result.success
        ? store.setSyncSuccess()
        : store.setSyncError(result.message);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : '同步失败';
      store.setSyncError(msg);
      return createFailureResult(msg);
    }
  }

  disconnect(): void {
    this.client = null;
    this.config = null;
  }

  /**
   * 上传本地数据到云端（使用模块化同步操作）
   */
  private async upload(
    onProgress?: (progress: import('@/lib/sync/types').SyncProgress) => void
  ): Promise<ISyncResult> {
    if (!this.client) return createFailureResult('客户端未初始化');

    const errors: string[] = [];
    let count = 0;

    onProgress?.({
      phase: 'uploading',
      message: '正在读取本地数据...',
      percentage: 5,
    });

    const [beans, notes, equipments, methods] = await Promise.all([
      db.coffeeBeans.toArray(),
      db.brewingNotes.toArray(),
      db.customEquipments.toArray(),
      db.customMethods.toArray(),
    ]);

    console.log(
      `[Supabase] 本地数据: 咖啡豆 ${beans.length}, 笔记 ${notes.length}, 器具 ${equipments.length}, 方案 ${methods.length}`
    );

    // 使用模块化同步操作
    onProgress?.({
      phase: 'uploading',
      message: '正在同步咖啡豆数据...',
      percentage: 20,
    });
    const beansResult = await syncTableUpload(
      this.client,
      SYNC_TABLES.COFFEE_BEANS,
      beans,
      b => ({
        id: b.id,
        data: b,
        updated_at: new Date(b.timestamp || Date.now()).toISOString(),
      })
    );
    if (!beansResult.success) errors.push(`咖啡豆: ${beansResult.error}`);
    else count += beansResult.data?.upserted || 0;

    onProgress?.({
      phase: 'uploading',
      message: '正在同步冲煮记录...',
      percentage: 40,
    });
    const notesResult = await syncTableUpload(
      this.client,
      SYNC_TABLES.BREWING_NOTES,
      notes,
      n => ({
        id: n.id,
        data: n,
        updated_at: new Date(n.timestamp || Date.now()).toISOString(),
      })
    );
    if (!notesResult.success) errors.push(`冲煮记录: ${notesResult.error}`);
    else count += notesResult.data?.upserted || 0;

    onProgress?.({
      phase: 'uploading',
      message: '正在同步器具数据...',
      percentage: 60,
    });
    const equipmentsResult = await syncTableUpload(
      this.client,
      SYNC_TABLES.CUSTOM_EQUIPMENTS,
      equipments,
      e => ({ id: e.id, data: e, updated_at: new Date().toISOString() })
    );
    if (!equipmentsResult.success)
      errors.push(`器具: ${equipmentsResult.error}`);
    else count += equipmentsResult.data?.upserted || 0;

    onProgress?.({
      phase: 'uploading',
      message: '正在同步方案数据...',
      percentage: 70,
    });
    const methodsWithId = methods.map(m => ({ ...m, id: m.equipmentId }));
    const methodsResult = await syncTableUpload(
      this.client,
      SYNC_TABLES.CUSTOM_METHODS,
      methodsWithId,
      m => ({
        id: m.equipmentId,
        equipment_id: m.equipmentId,
        data: m,
        updated_at: new Date().toISOString(),
      })
    );
    if (!methodsResult.success) errors.push(`方案: ${methodsResult.error}`);
    else count += methodsResult.data?.upserted || 0;

    onProgress?.({
      phase: 'uploading',
      message: '正在上传设置数据...',
      percentage: 85,
    });
    count += await this.uploadSettings(errors);

    onProgress?.({ phase: 'uploading', message: '上传完成', percentage: 100 });

    return errors.length
      ? {
          success: false,
          message: `上传完成，${errors.length} 个错误`,
          uploadedCount: count,
          downloadedCount: 0,
          errors,
        }
      : createSuccessResult(`上传成功: ${count} 条`, { uploaded: count });
  }

  private async uploadSettings(errors: string[]): Promise<number> {
    if (!this.client) return 0;

    const data: Record<string, unknown> = {};
    for (const key of SETTINGS_KEYS) {
      const val = await Storage.get(key);
      if (val) {
        try {
          let parsed = JSON.parse(val);
          if (key === 'brewGuideSettings' && parsed?.state?.settings)
            parsed = parsed.state.settings;
          data[key] = parsed;
        } catch {
          data[key] = val;
        }
      }
    }

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

      const logos = localStorage.getItem(ROASTER_LOGOS_KEY);
      if (logos)
        try {
          data[ROASTER_LOGOS_KEY] = JSON.parse(logos);
        } catch {
          /* 忽略解析错误 */
        }
    }

    const { error } = await this.client.from('user_settings').upsert(
      {
        id: 'app_settings',
        user_id: DEFAULT_USER_ID,
        data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id,user_id' }
    );

    if (error) {
      errors.push(`settings: ${error.message}`);
      return 0;
    }
    return Object.keys(data).length;
  }

  /**
   * 下载云端数据到本地（使用模块化同步操作）
   */
  private async download(
    onProgress?: (progress: import('@/lib/sync/types').SyncProgress) => void
  ): Promise<ISyncResult> {
    if (!this.client) return createFailureResult('客户端未初始化');

    const errors: string[] = [];
    let count = 0;

    onProgress?.({
      phase: 'downloading',
      message: '正在获取云端数据...',
      percentage: 10,
    });

    // 使用模块化操作获取数据
    const [beansResult, notesResult, equipmentsResult, methodsResult] =
      await Promise.all([
        fetchRemoteActiveRecords<CoffeeBean>(
          this.client,
          SYNC_TABLES.COFFEE_BEANS
        ),
        fetchRemoteActiveRecords<BrewingNote>(
          this.client,
          SYNC_TABLES.BREWING_NOTES
        ),
        fetchRemoteActiveRecords<CustomEquipment>(
          this.client,
          SYNC_TABLES.CUSTOM_EQUIPMENTS
        ),
        fetchRemoteActiveRecords<{ equipmentId: string; methods: Method[] }>(
          this.client,
          SYNC_TABLES.CUSTOM_METHODS
        ),
      ]);

    // 获取设置
    const settings = await this.client
      .from('user_settings')
      .select('data')
      .eq('user_id', DEFAULT_USER_ID)
      .eq('id', 'app_settings')
      .single();

    onProgress?.({
      phase: 'downloading',
      message: '正在导入咖啡豆数据...',
      percentage: 30,
    });
    if (!beansResult.success) {
      errors.push(`beans: ${beansResult.error}`);
    } else if (beansResult.data && beansResult.data.length > 0) {
      await db.coffeeBeans.clear();
      await db.coffeeBeans.bulkPut(beansResult.data);
      (await import('@/lib/stores/coffeeBeanStore'))
        .getCoffeeBeanStore()
        .setBeans(beansResult.data);
      count += beansResult.data.length;
    } else {
      await db.coffeeBeans.clear();
      (await import('@/lib/stores/coffeeBeanStore'))
        .getCoffeeBeanStore()
        .setBeans([]);
    }

    onProgress?.({
      phase: 'downloading',
      message: '正在导入冲煮记录...',
      percentage: 50,
    });
    if (!notesResult.success) {
      errors.push(`notes: ${notesResult.error}`);
    } else if (notesResult.data && notesResult.data.length > 0) {
      await db.brewingNotes.clear();
      await db.brewingNotes.bulkPut(notesResult.data);
      (await import('@/lib/stores/brewingNoteStore'))
        .getBrewingNoteStore()
        .setNotes(notesResult.data);
      count += notesResult.data.length;
    } else {
      await db.brewingNotes.clear();
      (await import('@/lib/stores/brewingNoteStore'))
        .getBrewingNoteStore()
        .setNotes([]);
    }

    onProgress?.({
      phase: 'downloading',
      message: '正在导入器具数据...',
      percentage: 65,
    });
    if (!equipmentsResult.success) {
      errors.push(`equips: ${equipmentsResult.error}`);
    } else if (equipmentsResult.data && equipmentsResult.data.length > 0) {
      await db.customEquipments.clear();
      await db.customEquipments.bulkPut(equipmentsResult.data);
      count += equipmentsResult.data.length;
    } else {
      await db.customEquipments.clear();
    }

    onProgress?.({
      phase: 'downloading',
      message: '正在导入方案数据...',
      percentage: 75,
    });
    if (!methodsResult.success) {
      errors.push(`methods: ${methodsResult.error}`);
    } else if (methodsResult.data && methodsResult.data.length > 0) {
      await db.customMethods.clear();
      await db.customMethods.bulkPut(methodsResult.data);
      count += methodsResult.data.length;
    } else {
      await db.customMethods.clear();
    }

    onProgress?.({
      phase: 'downloading',
      message: '正在导入设置数据...',
      percentage: 90,
    });
    if (settings.error && settings.error.code !== 'PGRST116') {
      errors.push(`settings: ${settings.error.message}`);
    } else if (settings.data?.data) {
      count += await this.downloadSettings(
        settings.data.data as Record<string, unknown>
      );
    }

    onProgress?.({
      phase: 'downloading',
      message: '下载完成',
      percentage: 100,
    });

    const critical = errors.some(
      e => e.includes('beans') || e.includes('notes')
    );
    return critical
      ? {
          success: false,
          message: `下载失败: ${errors[0]}`,
          uploadedCount: 0,
          downloadedCount: count,
          errors,
        }
      : createSuccessResult(`下载成功: ${count} 条`, { downloaded: count });
  }

  private async downloadSettings(
    data: Record<string, unknown>
  ): Promise<number> {
    for (const key of SETTINGS_KEYS) {
      if (data[key] !== undefined) {
        await Storage.set(
          key,
          typeof data[key] === 'object'
            ? JSON.stringify(data[key])
            : String(data[key])
        );
      }
    }

    if (typeof window !== 'undefined' && data.customPresets) {
      const presets = data.customPresets as Record<string, unknown>;
      for (const k of PRESETS_KEYS) {
        if (presets[k])
          localStorage.setItem(
            `${PRESETS_PREFIX}${k}`,
            JSON.stringify(presets[k])
          );
      }
    }

    if (typeof window !== 'undefined' && data[ROASTER_LOGOS_KEY]) {
      localStorage.setItem(
        ROASTER_LOGOS_KEY,
        JSON.stringify(data[ROASTER_LOGOS_KEY])
      );
    }

    window.dispatchEvent(new CustomEvent('settingsChanged'));
    return Object.keys(data).length;
  }
}
