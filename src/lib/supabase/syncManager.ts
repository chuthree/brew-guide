/**
 * Supabase 同步管理器
 * 实现本地 Dexie 数据库与 Supabase 的双向同步
 */

import { db } from '@/lib/core/db';
import { Storage } from '@/lib/core/storage';
import { supabaseClient, SupabaseClientWrapper } from './client';
import type {
  SupabaseConfig,
  SupabaseSyncSettings,
  SupabaseSyncOptions,
  SupabaseSyncResult,
  SupabaseSyncProgress,
  SupabaseConflictStrategy,
  SupabaseTableName,
  RealtimePayload,
  RealtimeConnectionStatus,
  DatabaseChange,
  SupabaseCoffeeBean,
  SupabaseBrewingNote,
} from './types';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';

// 设备 ID 存储键
const DEVICE_ID_KEY = 'supabase_device_id';
const LAST_SYNC_KEY = 'supabase_last_sync';

/**
 * 生成唯一设备 ID
 */
function generateDeviceId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `device_${timestamp}_${randomPart}`;
}

/**
 * Supabase 同步管理器
 */
export class SupabaseSyncManager {
  private client: SupabaseClientWrapper;
  private config: SupabaseConfig | null = null;
  private deviceId: string = '';
  private userId: string = '';
  private syncInProgress: boolean = false;
  private realtimeEnabled: boolean = false;

  // 变更队列（用于批量同步）
  private pendingChanges: DatabaseChange[] = [];
  private syncDebounceTimer: NodeJS.Timeout | null = null;

  // 本地事件监听器引用（用于清理）
  private localEventListeners: Map<string, EventListener> = new Map();

  constructor() {
    this.client = supabaseClient;
  }

  /**
   * 初始化同步管理器
   */
  async initialize(config: SupabaseConfig): Promise<boolean> {
    try {
      console.log('🔄 [SupabaseSync] 开始初始化...');

      // 初始化客户端
      const clientInitialized = this.client.initialize(config);
      if (!clientInitialized) {
        throw new Error('客户端初始化失败');
      }

      this.config = config;

      // 获取或生成设备 ID
      this.deviceId = await this.getOrCreateDeviceId();

      // 生成用户 ID（基于设备 ID，因为没有用户认证）
      this.userId = config.userId || this.deviceId;

      console.log('✅ [SupabaseSync] 初始化完成', {
        deviceId: this.deviceId,
        userId: this.userId,
      });

      return true;
    } catch (error) {
      console.error('❌ [SupabaseSync] 初始化失败:', error);
      return false;
    }
  }

  /**
   * 获取或创建设备 ID
   */
  private async getOrCreateDeviceId(): Promise<string> {
    let deviceId = await Storage.get(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = generateDeviceId();
      await Storage.set(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  }

  /**
   * 获取上次同步时间
   */
  private async getLastSyncTime(): Promise<number> {
    const lastSync = await Storage.get(LAST_SYNC_KEY);
    return lastSync ? parseInt(lastSync, 10) : 0;
  }

  /**
   * 保存同步时间
   */
  private async saveLastSyncTime(time: number): Promise<void> {
    await Storage.set(LAST_SYNC_KEY, time.toString());
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    return await this.client.testConnection();
  }

  /**
   * 获取服务名称（用于日志）
   */
  getServiceName(): string {
    return 'Supabase';
  }

  /**
   * 执行完整同步
   */
  async fullSync(options?: SupabaseSyncOptions): Promise<SupabaseSyncResult> {
    if (this.syncInProgress) {
      return {
        success: false,
        message: '同步正在进行中',
        uploaded: 0,
        downloaded: 0,
        deleted: 0,
        conflictsResolved: 0,
        errors: ['同步正在进行中，请稍后再试'],
      };
    }

    this.syncInProgress = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let uploaded = 0;
    let downloaded = 0;
    let deleted = 0;
    let conflictsResolved = 0;

    const onProgress = options?.onProgress;
    const conflictStrategy =
      options?.conflictStrategy ||
      ('latest_wins' as unknown as SupabaseConflictStrategy);

    try {
      console.log('🔄 [SupabaseSync] 开始完整同步...');

      // 阶段 1: 下载远程数据
      onProgress?.({
        phase: 'downloading',
        completed: 0,
        total: 4,
        percentage: 0,
        message: '正在下载远程数据...',
      });

      const downloadResult = await this.pullChanges();
      downloaded = downloadResult.downloaded;
      if (downloadResult.errors.length > 0) {
        errors.push(...downloadResult.errors);
      }

      // 阶段 2: 上传本地数据
      onProgress?.({
        phase: 'uploading',
        completed: 1,
        total: 4,
        percentage: 25,
        message: '正在上传本地数据...',
      });

      const uploadResult = await this.pushAllLocalData();
      uploaded = uploadResult.uploaded;
      if (uploadResult.errors.length > 0) {
        errors.push(...uploadResult.errors);
      }

      // 阶段 3: 解决冲突
      onProgress?.({
        phase: 'resolving',
        completed: 2,
        total: 4,
        percentage: 50,
        message: '正在解决冲突...',
      });

      // 冲突解决已在 pull/push 过程中处理

      // 阶段 4: 完成
      onProgress?.({
        phase: 'completed',
        completed: 4,
        total: 4,
        percentage: 100,
        message: '同步完成',
      });

      // 保存同步时间
      await this.saveLastSyncTime(Date.now());

      const duration = Date.now() - startTime;
      console.log(`✅ [SupabaseSync] 完整同步完成，耗时 ${duration}ms`);

      return {
        success: errors.length === 0,
        message: errors.length === 0 ? '同步完成' : '同步完成，但有部分错误',
        uploaded,
        downloaded,
        deleted,
        conflictsResolved,
        errors,
        duration,
      };
    } catch (error) {
      console.error('❌ [SupabaseSync] 完整同步失败:', error);
      return {
        success: false,
        message: `同步失败: ${error instanceof Error ? error.message : '未知错误'}`,
        uploaded,
        downloaded,
        deleted,
        conflictsResolved,
        errors: [
          ...errors,
          error instanceof Error ? error.message : '未知错误',
        ],
        duration: Date.now() - startTime,
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 推送所有本地数据到远程
   */
  async pushAllLocalData(): Promise<SupabaseSyncResult> {
    const errors: string[] = [];
    let uploaded = 0;

    try {
      // 获取本地数据
      const beans = await db.coffeeBeans.toArray();
      const notes = await db.brewingNotes.toArray();
      const equipments = await db.customEquipments.toArray();
      const methods = await db.customMethods.toArray();

      console.log(
        `📤 [SupabaseSync] 准备上传: ${beans.length} 咖啡豆, ${notes.length} 笔记, ${equipments.length} 器具, ${methods.length} 方案`
      );

      // 上传咖啡豆
      if (beans.length > 0) {
        const count = await this.client.upsertCoffeeBeans(this.userId, beans);
        uploaded += count;
      }

      // 上传冲煮笔记
      if (notes.length > 0) {
        const count = await this.client.upsertBrewingNotes(this.userId, notes);
        uploaded += count;
      }

      // 上传自定义器具
      if (equipments.length > 0) {
        const count = await this.client.upsertCustomEquipments(
          this.userId,
          equipments
        );
        uploaded += count;
      }

      // 上传自定义方案
      if (methods.length > 0) {
        const count = await this.client.upsertCustomMethods(
          this.userId,
          methods
        );
        uploaded += count;
      }

      return {
        success: true,
        message: `上传完成: ${uploaded} 条记录`,
        uploaded,
        downloaded: 0,
        deleted: 0,
        conflictsResolved: 0,
        errors,
      };
    } catch (error) {
      console.error('❌ [SupabaseSync] 推送数据失败:', error);
      return {
        success: false,
        message: '推送数据失败',
        uploaded,
        downloaded: 0,
        deleted: 0,
        conflictsResolved: 0,
        errors: [error instanceof Error ? error.message : '未知错误'],
      };
    }
  }

  /**
   * 拉取远程数据到本地
   */
  async pullChanges(since?: number): Promise<SupabaseSyncResult> {
    const errors: string[] = [];
    let downloaded = 0;
    let deleted = 0;

    try {
      const lastSync = since ?? (await this.getLastSyncTime());
      console.log(
        `📥 [SupabaseSync] 拉取自 ${new Date(lastSync).toISOString()} 以来的变更`
      );

      // 获取远程咖啡豆
      const remoteBeans =
        lastSync > 0
          ? await this.client.getCoffeeBeansUpdatedSince(this.userId, lastSync)
          : await this.client.getCoffeeBeans(this.userId);

      // 获取远程冲煮笔记
      const remoteNotes =
        lastSync > 0
          ? await this.client.getBrewingNotesUpdatedSince(this.userId, lastSync)
          : await this.client.getBrewingNotes(this.userId);

      // 获取远程自定义器具
      const remoteEquipments = await this.client.getCustomEquipments(
        this.userId
      );

      // 获取远程自定义方案
      const remoteMethods = await this.client.getCustomMethods(this.userId);

      console.log(
        `📥 [SupabaseSync] 获取到: ${remoteBeans.length} 咖啡豆, ${remoteNotes.length} 笔记, ${remoteEquipments.length} 器具, ${remoteMethods.length} 方案`
      );

      // 合并咖啡豆数据
      for (const remoteBean of remoteBeans) {
        try {
          if (remoteBean.deleted_at) {
            // 远程已删除，本地也删除
            await db.coffeeBeans.delete(remoteBean.id);
            deleted++;
          } else {
            // 更新或插入
            const localBean = await db.coffeeBeans.get(remoteBean.id);
            const remoteUpdatedAt = new Date(remoteBean.updated_at).getTime();

            // 如果本地不存在或远程更新，则使用远程数据
            if (
              !localBean ||
              (localBean.timestamp && localBean.timestamp < remoteUpdatedAt)
            ) {
              await db.coffeeBeans.put(remoteBean.data);
              downloaded++;
            }
          }
        } catch (error) {
          console.error(
            `❌ [SupabaseSync] 合并咖啡豆 ${remoteBean.id} 失败:`,
            error
          );
          errors.push(`合并咖啡豆 ${remoteBean.id} 失败`);
        }
      }

      // 合并冲煮笔记数据
      for (const remoteNote of remoteNotes) {
        try {
          if (remoteNote.deleted_at) {
            await db.brewingNotes.delete(remoteNote.id);
            deleted++;
          } else {
            const localNote = await db.brewingNotes.get(remoteNote.id);
            const remoteUpdatedAt = new Date(remoteNote.updated_at).getTime();

            if (
              !localNote ||
              (localNote.timestamp && localNote.timestamp < remoteUpdatedAt)
            ) {
              await db.brewingNotes.put(remoteNote.data as BrewingNote);
              downloaded++;
            }
          }
        } catch (error) {
          console.error(
            `❌ [SupabaseSync] 合并冲煮笔记 ${remoteNote.id} 失败:`,
            error
          );
          errors.push(`合并冲煮笔记 ${remoteNote.id} 失败`);
        }
      }

      // 合并自定义器具
      for (const remoteEquipment of remoteEquipments) {
        try {
          if (!remoteEquipment.deleted_at) {
            await db.customEquipments.put(remoteEquipment.data);
            downloaded++;
          }
        } catch (error) {
          console.error(
            `❌ [SupabaseSync] 合并自定义器具 ${remoteEquipment.id} 失败:`,
            error
          );
          errors.push(`合并自定义器具 ${remoteEquipment.id} 失败`);
        }
      }

      // 合并自定义方案
      for (const remoteMethod of remoteMethods) {
        try {
          if (!remoteMethod.deleted_at) {
            await db.customMethods.put(remoteMethod.data);
            downloaded++;
          }
        } catch (error) {
          console.error(
            `❌ [SupabaseSync] 合并自定义方案 ${remoteMethod.id} 失败:`,
            error
          );
          errors.push(`合并自定义方案 ${remoteMethod.id} 失败`);
        }
      }

      return {
        success: errors.length === 0,
        message: `下载完成: ${downloaded} 条记录`,
        uploaded: 0,
        downloaded,
        deleted,
        conflictsResolved: 0,
        errors,
      };
    } catch (error) {
      console.error('❌ [SupabaseSync] 拉取数据失败:', error);
      return {
        success: false,
        message: '拉取数据失败',
        uploaded: 0,
        downloaded,
        deleted,
        conflictsResolved: 0,
        errors: [error instanceof Error ? error.message : '未知错误'],
      };
    }
  }

  /**
   * 推送单个变更
   */
  async pushChange(change: DatabaseChange): Promise<boolean> {
    try {
      switch (change.table) {
        case 'coffee_beans':
          if (change.type === 'delete') {
            return await this.client.deleteCoffeeBean(this.userId, change.id);
          } else {
            const bean = change.data as CoffeeBean;
            const result = await this.client.upsertCoffeeBean(
              this.userId,
              bean
            );
            return result !== null;
          }

        case 'brewing_notes':
          if (change.type === 'delete') {
            return await this.client.deleteBrewingNote(this.userId, change.id);
          } else {
            const note = change.data as BrewingNote;
            const result = await this.client.upsertBrewingNote(
              this.userId,
              note
            );
            return result !== null;
          }

        default:
          console.warn(`⚠️ [SupabaseSync] 未处理的表类型: ${change.table}`);
          return false;
      }
    } catch (error) {
      console.error(`❌ [SupabaseSync] 推送变更失败:`, error);
      return false;
    }
  }

  /**
   * 添加变更到队列（用于实时同步）
   */
  queueChange(change: DatabaseChange): void {
    this.pendingChanges.push(change);

    // 防抖处理，避免频繁同步
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }

    this.syncDebounceTimer = setTimeout(() => {
      this.flushPendingChanges();
    }, 1000); // 1秒后批量同步
  }

  /**
   * 刷新待同步队列
   */
  private async flushPendingChanges(): Promise<void> {
    if (this.pendingChanges.length === 0) return;

    const changes = [...this.pendingChanges];
    this.pendingChanges = [];

    console.log(`🔄 [SupabaseSync] 批量推送 ${changes.length} 个变更`);

    for (const change of changes) {
      await this.pushChange(change);
    }
  }

  // ==================== 本地事件监听 ====================

  /**
   * 开始监听本地数据变更事件
   * 当本地数据变更时，自动推送到 Supabase
   */
  startLocalEventListeners(): void {
    if (this.localEventListeners.size > 0) {
      console.log('⚠️ [SupabaseSync] 本地事件监听已启动');
      return;
    }

    console.log('🎧 [SupabaseSync] 开始监听本地数据变更事件...');

    // 监听咖啡豆数据变更
    const coffeeBeanHandler = (async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { action, beanId, bean } = customEvent.detail || {};

      console.log(`📤 [SupabaseSync] 检测到咖啡豆变更: ${action} - ${beanId}`);

      if (!this.config || !this.realtimeEnabled) {
        console.log('⏸️ [SupabaseSync] 未启用实时同步，跳过推送');
        return;
      }

      try {
        // 获取完整的咖啡豆数据
        let beanData = bean;
        if (!beanData && beanId) {
          beanData = await db.coffeeBeans.get(beanId);
        }

        if (action === 'delete') {
          // 删除操作
          await this.pushChange({
            type: 'delete',
            table: 'coffee_beans',
            id: beanId,
            timestamp: Date.now(),
          });
          console.log(`🗑️ [SupabaseSync] 已推送删除咖啡豆: ${beanId}`);
        } else if (beanData) {
          // 创建或更新操作
          await this.pushChange({
            type: action === 'create' ? 'create' : 'update',
            table: 'coffee_beans',
            id: beanData.id,
            data: beanData,
            timestamp: Date.now(),
          });
          console.log(`📤 [SupabaseSync] 已推送咖啡豆变更: ${beanData.id}`);
        }
      } catch (error) {
        console.error('❌ [SupabaseSync] 推送咖啡豆变更失败:', error);
      }
    }) as EventListener;

    // 监听冲煮笔记数据变更
    const brewingNoteHandler = (async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { action, noteId, note } = customEvent.detail || {};

      console.log(
        `📤 [SupabaseSync] 检测到冲煮笔记变更: ${action} - ${noteId}`
      );

      if (!this.config || !this.realtimeEnabled) {
        console.log('⏸️ [SupabaseSync] 未启用实时同步，跳过推送');
        return;
      }

      try {
        let noteData = note;
        if (!noteData && noteId) {
          noteData = await db.brewingNotes.get(noteId);
        }

        if (action === 'delete') {
          await this.pushChange({
            type: 'delete',
            table: 'brewing_notes',
            id: noteId,
            timestamp: Date.now(),
          });
          console.log(`🗑️ [SupabaseSync] 已推送删除冲煮笔记: ${noteId}`);
        } else if (noteData) {
          await this.pushChange({
            type: action === 'create' ? 'create' : 'update',
            table: 'brewing_notes',
            id: noteData.id,
            data: noteData,
            timestamp: Date.now(),
          });
          console.log(`📤 [SupabaseSync] 已推送冲煮笔记变更: ${noteData.id}`);
        }
      } catch (error) {
        console.error('❌ [SupabaseSync] 推送冲煮笔记变更失败:', error);
      }
    }) as EventListener;

    // 添加事件监听器
    window.addEventListener('coffeeBeanDataChanged', coffeeBeanHandler);
    window.addEventListener('brewingNoteDataChanged', brewingNoteHandler);

    // 保存引用以便清理
    this.localEventListeners.set('coffeeBeanDataChanged', coffeeBeanHandler);
    this.localEventListeners.set('brewingNoteDataChanged', brewingNoteHandler);

    console.log('✅ [SupabaseSync] 本地事件监听已启动');
  }

  /**
   * 停止监听本地数据变更事件
   */
  stopLocalEventListeners(): void {
    this.localEventListeners.forEach((handler, eventName) => {
      window.removeEventListener(eventName, handler);
    });
    this.localEventListeners.clear();
    console.log('🔌 [SupabaseSync] 本地事件监听已停止');
  }

  // ==================== 实时同步 ====================

  /**
   * 启动实时同步
   */
  async startRealtime(): Promise<boolean> {
    if (this.realtimeEnabled) {
      console.log('⚠️ [SupabaseSync] 实时同步已启动');
      return true;
    }

    const success = await this.client.startRealtime(this.userId);
    if (success) {
      this.realtimeEnabled = true;
      this.setupRealtimeHandlers();
      // 同时启动本地事件监听
      this.startLocalEventListeners();
      console.log('✅ [SupabaseSync] 实时同步已启动');
    }

    return success;
  }

  /**
   * 停止实时同步
   */
  stopRealtime(): void {
    this.client.stopRealtime();
    this.stopLocalEventListeners();
    this.realtimeEnabled = false;
    console.log('🔌 [SupabaseSync] 实时同步已停止');
  }

  /**
   * 获取实时连接状态
   */
  getRealtimeStatus(): RealtimeConnectionStatus {
    return this.client.getRealtimeStatus();
  }

  /**
   * 设置实时事件处理器
   */
  private setupRealtimeHandlers(): void {
    // 处理咖啡豆变更
    this.client.onRealtimeEvent(
      'coffee_beans',
      async (payload: RealtimePayload) => {
        await this.handleRealtimeChange('coffee_beans', payload);
      }
    );

    // 处理冲煮笔记变更
    this.client.onRealtimeEvent(
      'brewing_notes',
      async (payload: RealtimePayload) => {
        await this.handleRealtimeChange('brewing_notes', payload);
      }
    );

    // 处理自定义器具变更
    this.client.onRealtimeEvent(
      'custom_equipments',
      async (payload: RealtimePayload) => {
        await this.handleRealtimeChange('custom_equipments', payload);
      }
    );

    // 处理自定义方案变更
    this.client.onRealtimeEvent(
      'custom_methods',
      async (payload: RealtimePayload) => {
        await this.handleRealtimeChange('custom_methods', payload);
      }
    );
  }

  /**
   * 处理实时变更
   */
  private async handleRealtimeChange(
    table: SupabaseTableName,
    payload: RealtimePayload
  ): Promise<void> {
    console.log(
      `📡 [SupabaseSync] 处理实时变更 [${table}]:`,
      payload.eventType
    );

    try {
      switch (table) {
        case 'coffee_beans': {
          const data = payload.new as SupabaseCoffeeBean | null;
          if (payload.eventType === 'DELETE' || (data && data.deleted_at)) {
            const oldData = payload.old as SupabaseCoffeeBean | null;
            if (oldData) {
              await db.coffeeBeans.delete(oldData.id);
              console.log(`🗑️ [SupabaseSync] 删除本地咖啡豆: ${oldData.id}`);
            }
          } else if (data) {
            await db.coffeeBeans.put(data.data);
            console.log(`📥 [SupabaseSync] 更新本地咖啡豆: ${data.id}`);
          }
          // 通知 UI 刷新
          window.dispatchEvent(
            new CustomEvent('supabaseDataChange', { detail: { table } })
          );
          break;
        }

        case 'brewing_notes': {
          const data = payload.new as SupabaseBrewingNote | null;
          if (payload.eventType === 'DELETE' || (data && data.deleted_at)) {
            const oldData = payload.old as SupabaseBrewingNote | null;
            if (oldData) {
              await db.brewingNotes.delete(oldData.id);
              console.log(`🗑️ [SupabaseSync] 删除本地冲煮笔记: ${oldData.id}`);
            }
          } else if (data) {
            await db.brewingNotes.put(data.data as BrewingNote);
            console.log(`📥 [SupabaseSync] 更新本地冲煮笔记: ${data.id}`);
          }
          window.dispatchEvent(
            new CustomEvent('supabaseDataChange', { detail: { table } })
          );
          break;
        }

        // 其他表的处理类似...
      }
    } catch (error) {
      console.error(`❌ [SupabaseSync] 处理实时变更失败:`, error);
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopRealtime();
    this.client.disconnect();
    this.config = null;
    console.log('🔌 [SupabaseSync] 已断开连接');
  }
}

// 导出单例
export const supabaseSyncManager = new SupabaseSyncManager();
