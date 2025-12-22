/**
 * Supabase 同步管理器
 *
 * 基于业界标准的同步实现（CouchDB 墓碑模式 + RxDB 离线优先架构）
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { db } from '@/lib/core/db';
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
  uploadSettingsData,
  downloadSettingsData,
  SYNC_TABLES,
  DEFAULT_USER_ID,
} from './syncOperations';

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
    const settingsResult = await uploadSettingsData(this.client);
    if (!settingsResult.success) errors.push(`设置: ${settingsResult.error}`);
    else count += settingsResult.affectedCount;

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
    const settingsResult = await downloadSettingsData(this.client);
    if (!settingsResult.success) {
      errors.push(`settings: ${settingsResult.error}`);
    } else {
      count += settingsResult.affectedCount;
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
}
