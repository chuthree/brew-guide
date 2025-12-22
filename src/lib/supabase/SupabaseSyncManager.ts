/**
 * Supabase 同步管理器
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

const DEFAULT_USER_ID = 'default_user';

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

  private async upload(
    onProgress?: (progress: import('@/lib/sync/types').SyncProgress) => void
  ): Promise<ISyncResult> {
    if (!this.client) return createFailureResult('客户端未初始化');

    const errors: string[] = [];
    let count = 0;

    onProgress?.({
      phase: 'uploading',
      message: '正在读取本地数据...',
      percentage: 10,
    });

    const [beans, notes, equipments, methods] = await Promise.all([
      db.coffeeBeans.toArray(),
      db.brewingNotes.toArray(),
      db.customEquipments.toArray(),
      db.customMethods.toArray(),
    ]);

    onProgress?.({
      phase: 'uploading',
      message: '正在上传咖啡豆数据...',
      percentage: 20,
    });

    const upsert = async (table: string, data: object[]) => {
      const { error } = await this.client!.from(table).upsert(data, {
        onConflict: 'id,user_id',
      });
      if (error) errors.push(`${table}: ${error.message}`);
      else count += data.length;
    };

    if (beans.length)
      await upsert(
        'coffee_beans',
        beans.map(b => ({
          id: b.id,
          user_id: DEFAULT_USER_ID,
          data: b,
          updated_at: new Date(b.timestamp || Date.now()).toISOString(),
        }))
      );

    onProgress?.({
      phase: 'uploading',
      message: '正在上传冲煮记录...',
      percentage: 40,
    });

    if (notes.length)
      await upsert(
        'brewing_notes',
        notes.map(n => ({
          id: n.id,
          user_id: DEFAULT_USER_ID,
          data: n,
          updated_at: new Date(n.timestamp || Date.now()).toISOString(),
        }))
      );

    onProgress?.({
      phase: 'uploading',
      message: '正在上传器具数据...',
      percentage: 60,
    });

    if (equipments.length)
      await upsert(
        'custom_equipments',
        equipments.map(e => ({
          id: e.id,
          user_id: DEFAULT_USER_ID,
          data: e,
          updated_at: new Date().toISOString(),
        }))
      );

    onProgress?.({
      phase: 'uploading',
      message: '正在上传方案数据...',
      percentage: 70,
    });

    if (methods.length)
      await upsert(
        'custom_methods',
        methods.map(m => ({
          id: m.equipmentId,
          user_id: DEFAULT_USER_ID,
          equipment_id: m.equipmentId,
          data: m,
          updated_at: new Date().toISOString(),
        }))
      );

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
          } catch {}
      }
      if (Object.keys(presets).length) data.customPresets = presets;

      const logos = localStorage.getItem(ROASTER_LOGOS_KEY);
      if (logos)
        try {
          data[ROASTER_LOGOS_KEY] = JSON.parse(logos);
        } catch {}
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

    const [beans, notes, equips, methods, settings] = await Promise.all([
      this.client
        .from('coffee_beans')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .is('deleted_at', null),
      this.client
        .from('brewing_notes')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .is('deleted_at', null),
      this.client
        .from('custom_equipments')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .is('deleted_at', null),
      this.client
        .from('custom_methods')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .is('deleted_at', null),
      this.client
        .from('user_settings')
        .select('data')
        .eq('user_id', DEFAULT_USER_ID)
        .eq('id', 'app_settings')
        .single(),
    ]);

    onProgress?.({
      phase: 'downloading',
      message: '正在导入咖啡豆数据...',
      percentage: 30,
    });

    if (beans.error) errors.push(`beans: ${beans.error.message}`);
    else if (beans.data?.length) {
      const arr = beans.data.map((r: { data: CoffeeBean }) => r.data);
      await db.coffeeBeans.clear();
      await db.coffeeBeans.bulkPut(arr);
      (await import('@/lib/stores/coffeeBeanStore'))
        .getCoffeeBeanStore()
        .setBeans(arr);
      count += arr.length;
    }

    onProgress?.({
      phase: 'downloading',
      message: '正在导入冲煮记录...',
      percentage: 50,
    });

    if (notes.error) errors.push(`notes: ${notes.error.message}`);
    else if (notes.data?.length) {
      const arr = notes.data.map((r: { data: BrewingNote }) => r.data);
      await db.brewingNotes.clear();
      await db.brewingNotes.bulkPut(arr);
      (await import('@/lib/stores/brewingNoteStore'))
        .getBrewingNoteStore()
        .setNotes(arr);
      count += arr.length;
    }

    onProgress?.({
      phase: 'downloading',
      message: '正在导入器具数据...',
      percentage: 65,
    });

    if (equips.error) errors.push(`equips: ${equips.error.message}`);
    else if (equips.data?.length) {
      const arr = equips.data.map((r: { data: CustomEquipment }) => r.data);
      await db.customEquipments.clear();
      await db.customEquipments.bulkPut(arr);
      count += arr.length;
    }

    onProgress?.({
      phase: 'downloading',
      message: '正在导入方案数据...',
      percentage: 75,
    });

    if (methods.error) errors.push(`methods: ${methods.error.message}`);
    else if (methods.data?.length) {
      const arr = methods.data.map(
        (r: { data: { equipmentId: string; methods: Method[] } }) => r.data
      );
      await db.customMethods.clear();
      await db.customMethods.bulkPut(arr);
      count += arr.length;
    }

    onProgress?.({
      phase: 'downloading',
      message: '正在导入设置数据...',
      percentage: 90,
    });

    if (settings.error && settings.error.code !== 'PGRST116')
      errors.push(`settings: ${settings.error.message}`);
    else if (settings.data?.data)
      count += await this.downloadSettings(
        settings.data.data as Record<string, unknown>
      );

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
