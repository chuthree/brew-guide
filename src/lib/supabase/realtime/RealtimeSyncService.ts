/**
 * Supabase 实时同步服务
 *
 * 架构设计：
 * - Supabase Realtime: https://supabase.com/docs/guides/realtime/postgres-changes
 * - CouchDB Tombstone: https://docs.couchdb.org/en/stable/replication/conflicts.html
 * - RxDB Offline-First: https://rxdb.info/offline-first.html
 *
 * 核心原则：
 * 1. 云端权威（Cloud-Authoritative）
 * 2. Last-Write-Wins 冲突解决
 * 3. 软删除（Tombstone）模式
 *
 * 职责：
 * - 连接管理
 * - Realtime 订阅
 * - 协调各处理模块
 *
 * 拆分后的模块：
 * - handlers/RemoteChangeHandler: 处理远程变更
 * - handlers/LocalChangeListener: 监听本地事件
 * - handlers/StoreNotifier: 通知 Store 更新
 * - InitialSyncManager: 初始同步逻辑
 * - offlineQueue: 离线队列
 * - conflictResolver: 冲突解决
 */

import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import {
  SYNC_TABLES,
  DEFAULT_USER_ID,
  upsertRecords,
  markRecordsAsDeleted,
  uploadSettingsData,
  downloadSettingsData,
} from '../syncOperations';
import { offlineQueue } from './offlineQueue';
import { setLastSyncTime } from './conflictResolver';
import { InitialSyncManager } from './InitialSyncManager';
import {
  localChangeListener,
  refreshSettingsStores,
  remoteChangeHandler,
} from './handlers';
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import type {
  RealtimeSyncConfig,
  RealtimeSyncState,
  RealtimeSyncTable,
  PendingOperation,
} from './types';
import type { Method } from '@/lib/core/config';

// ============================================================================
// 常量
// ============================================================================

const SYNC_TIMING = {
  IGNORE_OWN_CHANGE_DURATION: 5000,
  SETTINGS_DEBOUNCE: 500,
  SUBSCRIPTION_TIMEOUT: 10000,
  SETTINGS_COOLDOWN: 3000,
} as const;

type PostgresPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

// ============================================================================
// 实时同步服务
// ============================================================================

export class RealtimeSyncService {
  private static instance: RealtimeSyncService | null = null;

  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private config: RealtimeSyncConfig | null = null;

  private state: RealtimeSyncState = {
    connectionStatus: 'disconnected',
    lastSyncTime: null,
    pendingChangesCount: 0,
    isInitialSyncing: false,
    error: null,
  };

  private stateListeners = new Set<(state: RealtimeSyncState) => void>();
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private pendingLocalChanges = new Map<string, number>();
  private settingsDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private isProcessingRemoteSettings = false;
  private isInitialized = false;

  private constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);

      // 统一使用 Web 标准 API 监听可见性变化
      // Capacitor WebView 也支持此 API，且比 App 插件更稳定
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.handleVisibilityChange();
        }
      });
    }
  }

  /**
   * 初始化服务（设置监听器等）
   * 即使离线也应该调用，以确保本地变更被捕获
   */
  initialize(config: RealtimeSyncConfig): void {
    if (this.isInitialized) return;

    this.config = config;
    this.setupLocalChangeListeners();
    this.isInitialized = true;
    console.log('[RealtimeSync] 服务已初始化，本地监听器已启动');
  }

  /**
   * 处理应用回到前台
   */
  private handleVisibilityChange = async () => {
    console.log('[RealtimeSync] 应用回到前台，检查连接状态...');

    // 如果配置了 Supabase 且当前未连接，尝试重连
    if (
      this.config?.url &&
      this.config?.anonKey &&
      this.state.connectionStatus !== 'connected' &&
      this.state.connectionStatus !== 'connecting'
    ) {
      console.log('[RealtimeSync] 连接已断开，尝试重连...');
      await this.connect(this.config);
    }
    // 如果已连接，触发一次增量同步检查
    else if (this.state.connectionStatus === 'connected') {
      console.log('[RealtimeSync] 连接正常，执行前台同步检查...');
      // 强制检查连接有效性
      if (this.client && this.channel) {
        const state = this.channel.state;
        if (state === 'closed' || state === 'errored') {
          console.log('[RealtimeSync] 检测到 Channel 异常，重新连接...');
          await this.disconnect();
          await this.connect(this.config!);
          return;
        }
      }
      this.performBackgroundSync(false);
    }
  };

  // ============================================================================
  // 公共 API
  // ============================================================================

  static getInstance(): RealtimeSyncService {
    if (!RealtimeSyncService.instance) {
      RealtimeSyncService.instance = new RealtimeSyncService();
    }
    return RealtimeSyncService.instance;
  }

  getState(): RealtimeSyncState {
    return { ...this.state };
  }

  subscribe(listener: (state: RealtimeSyncState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  isConnected(): boolean {
    return this.state.connectionStatus === 'connected';
  }

  async connect(config: RealtimeSyncConfig): Promise<boolean> {
    // 确保服务已初始化（监听器已启动）
    if (!this.isInitialized) {
      this.initialize(config);
    }

    if (
      this.state.connectionStatus === 'connected' &&
      this.config?.url === config.url
    ) {
      return true;
    }

    this.config = config;
    this.setState({ connectionStatus: 'connecting', error: null });

    try {
      this.client = createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });

      await this.setupRealtimeChannel();
      // setupLocalChangeListeners 已在 initialize 中调用
      this.setState({ connectionStatus: 'connected' });

      // 后台执行初始同步
      console.log('[RealtimeSync] 连接成功，开始后台初始同步...');
      this.performBackgroundSync(config.enableOfflineQueue !== false);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败';
      console.error('[RealtimeSync] 连接失败:', message);
      this.setState({ connectionStatus: 'error', error: message });
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    localChangeListener.stop();

    if (this.settingsDebounceTimer) {
      clearTimeout(this.settingsDebounceTimer);
      this.settingsDebounceTimer = null;
    }

    this.client = null;
    this.config = null;
    this.pendingLocalChanges.clear();
    this.setState({ connectionStatus: 'disconnected', error: null });
  }

  async manualSync(): Promise<void> {
    if (!this.isConnected() || !this.client) {
      console.warn('[RealtimeSync] 未连接，无法同步');
      return;
    }

    this.setState({ isInitialSyncing: true });
    try {
      const syncManager = new InitialSyncManager(this.client);
      await syncManager.performSync();
      await this.processOfflineQueue();
      this.setState({ lastSyncTime: Date.now(), isInitialSyncing: false });
    } catch (error) {
      console.error('[RealtimeSync] 手动同步失败:', error);
      this.setState({ isInitialSyncing: false });
    }
  }

  /**
   * 同步本地变更到云端
   */
  async syncLocalChange(
    table: RealtimeSyncTable,
    action: 'create' | 'update' | 'delete',
    recordId: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    if (!recordId) {
      console.error(`[RealtimeSync] syncLocalChange: recordId 不能为空`);
      return;
    }

    // 离线时加入队列
    if (!this.isOnline || !this.client) {
      await offlineQueue.enqueue(
        table,
        action === 'delete' ? 'delete' : 'upsert',
        recordId,
        data
      );
      await this.updatePendingCount();
      return;
    }

    // 标记本地变更（防止 Realtime 回环）
    const changeKey = `${table}:${recordId}`;
    this.pendingLocalChanges.set(
      changeKey,
      Date.now() + SYNC_TIMING.IGNORE_OWN_CHANGE_DURATION
    );

    try {
      if (action === 'delete') {
        await markRecordsAsDeleted(this.client, table, [recordId]);
      } else {
        const record = this.prepareRecordForUpload(table, recordId, data);
        await upsertRecords(
          this.client,
          table,
          [record],
          this.createMapFn(table)
        );
      }

      const now = Date.now();
      setLastSyncTime(now);
      this.setState({ lastSyncTime: now });
    } catch (error) {
      console.error(`[RealtimeSync] 同步失败 ${table}/${recordId}:`, error);
      await offlineQueue.enqueue(
        table,
        action === 'delete' ? 'delete' : 'upsert',
        recordId,
        data
      );
      await this.updatePendingCount();
    }
  }

  // ============================================================================
  // 私有方法：Realtime 订阅
  // ============================================================================

  private async setupRealtimeChannel(): Promise<void> {
    if (!this.client) return;

    const channelName = `brew-guide-sync-${DEFAULT_USER_ID}`;

    this.channel = this.client
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SYNC_TABLES.COFFEE_BEANS,
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload => this.handleRemoteChange(SYNC_TABLES.COFFEE_BEANS, payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SYNC_TABLES.BREWING_NOTES,
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload => this.handleRemoteChange(SYNC_TABLES.BREWING_NOTES, payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SYNC_TABLES.CUSTOM_EQUIPMENTS,
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload =>
          this.handleRemoteChange(SYNC_TABLES.CUSTOM_EQUIPMENTS, payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SYNC_TABLES.CUSTOM_METHODS,
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload => this.handleRemoteChange(SYNC_TABLES.CUSTOM_METHODS, payload)
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: SYNC_TABLES.USER_SETTINGS,
          filter: `user_id=eq.${DEFAULT_USER_ID}`,
        },
        payload => this.handleRemoteSettingsChange(payload)
      );

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Realtime 订阅超时'));
      }, SYNC_TIMING.SUBSCRIPTION_TIMEOUT);

      this.channel!.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          resolve();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          reject(new Error(`订阅失败: ${status}`));
        }
      });
    });
  }

  /**
   * 处理远程变更（委托给 RemoteChangeHandler）
   */
  private async handleRemoteChange(
    table: RealtimeSyncTable,
    payload: PostgresPayload
  ): Promise<void> {
    const success = await remoteChangeHandler.handleChange(
      table,
      payload,
      this.pendingLocalChanges
    );

    if (success) {
      const now = Date.now();
      setLastSyncTime(now);
      this.setState({ lastSyncTime: now });
    }
  }

  private async handleRemoteSettingsChange(
    payload: PostgresPayload
  ): Promise<void> {
    if (payload.eventType === 'DELETE') return;
    if (this.isProcessingRemoteSettings) return;

    this.isProcessingRemoteSettings = true;

    try {
      if (this.client) {
        const result = await downloadSettingsData(this.client);
        if (result.success) {
          await refreshSettingsStores();
          const now = Date.now();
          setLastSyncTime(now);
          this.setState({ lastSyncTime: now });
        }
      }
    } catch (error) {
      console.error('[RealtimeSync] 处理远程设置变更失败:', error);
    } finally {
      setTimeout(() => {
        this.isProcessingRemoteSettings = false;
      }, SYNC_TIMING.SETTINGS_COOLDOWN);
    }
  }

  // ============================================================================
  // 私有方法：本地变更监听
  // ============================================================================

  private setupLocalChangeListeners(): void {
    localChangeListener.start(
      // 数据变更回调
      (table, action, recordId, data) => {
        this.syncLocalChange(table, action, recordId, data);
      },
      // 设置变更回调（带防抖）
      () => {
        if (this.settingsDebounceTimer) {
          clearTimeout(this.settingsDebounceTimer);
        }

        const delay = this.isProcessingRemoteSettings
          ? SYNC_TIMING.SETTINGS_COOLDOWN + SYNC_TIMING.SETTINGS_DEBOUNCE
          : SYNC_TIMING.SETTINGS_DEBOUNCE;

        this.settingsDebounceTimer = setTimeout(
          () => this.syncSettingsUpload(),
          delay
        );
      }
    );
  }

  // ============================================================================
  // 私有方法：同步逻辑
  // ============================================================================

  private async performBackgroundSync(processQueue: boolean): Promise<void> {
    if (!this.client) return;

    // 确保 UI 状态更新
    this.setState({ isInitialSyncing: true });

    // 强制通知 store，防止 setState 内部优化导致未触发更新
    useSyncStatusStore.getState().setInitialSyncing(true);

    try {
      const syncManager = new InitialSyncManager(this.client);
      await syncManager.performSync();
      if (processQueue) {
        await this.processOfflineQueue();
      }
      this.setState({ lastSyncTime: Date.now() });
    } catch (error) {
      console.error('[RealtimeSync] 后台同步失败:', error);
    } finally {
      this.setState({ isInitialSyncing: false });
    }
  }

  private async syncSettingsUpload(): Promise<void> {
    if (!this.client) return;

    this.isProcessingRemoteSettings = true;
    try {
      await uploadSettingsData(this.client);
    } catch (error) {
      console.error('[Sync] 设置上传失败:', error);
    } finally {
      setTimeout(() => {
        this.isProcessingRemoteSettings = false;
      }, SYNC_TIMING.SETTINGS_COOLDOWN);
    }
  }

  private async processOfflineQueue(): Promise<void> {
    if (!this.client) return;

    const processor = async (op: PendingOperation): Promise<boolean> => {
      try {
        if (op.type === 'delete') {
          const result = await markRecordsAsDeleted(this.client!, op.table, [
            op.recordId,
          ]);
          return result.success;
        } else {
          const record = this.prepareRecordForUpload(
            op.table,
            op.recordId,
            op.data as Record<string, unknown>
          );
          const result = await upsertRecords(
            this.client!,
            op.table,
            [record],
            this.createMapFn(op.table)
          );
          return result.success;
        }
      } catch {
        return false;
      }
    };

    const result = await offlineQueue.processQueue(processor);
    console.log(
      `[RealtimeSync] 离线队列: ${result.processed} 成功, ${result.failed} 失败`
    );
    await this.updatePendingCount();
  }

  // ============================================================================
  // 私有方法：工具函数
  // ============================================================================

  private setState(updates: Partial<RealtimeSyncState>): void {
    this.state = { ...this.state, ...updates };

    // 直接更新全局 syncStatusStore，确保 UI 状态同步
    const store = useSyncStatusStore.getState();
    if (updates.connectionStatus !== undefined) {
      store.setRealtimeStatus(updates.connectionStatus);
    }
    if (updates.pendingChangesCount !== undefined) {
      store.setPendingChangesCount(updates.pendingChangesCount);
    }
    if (updates.isInitialSyncing !== undefined) {
      store.setInitialSyncing(updates.isInitialSyncing);
    }

    // 保留外部监听器支持（向后兼容）
    this.stateListeners.forEach(listener => listener(this.state));
  }

  private async updatePendingCount(): Promise<void> {
    const count = await offlineQueue.getPendingCount();
    this.setState({ pendingChangesCount: count });
  }

  private prepareRecordForUpload(
    table: RealtimeSyncTable,
    recordId: string,
    data?: Record<string, unknown>
  ): { id: string } & Record<string, unknown> {
    if (table === SYNC_TABLES.CUSTOM_METHODS) {
      return {
        id: recordId,
        equipmentId: recordId,
        methods: (data?.methods as Method[]) || [],
      };
    }
    return { ...(data || {}), id: recordId };
  }

  private createMapFn(
    table: RealtimeSyncTable
  ): (record: { id: string }) => Record<string, unknown> {
    if (table === SYNC_TABLES.CUSTOM_METHODS) {
      return record => ({
        id: record.id,
        data: {
          equipmentId:
            (record as { equipmentId?: string }).equipmentId || record.id,
          methods: (record as { methods?: Method[] }).methods || [],
        },
        updated_at: new Date().toISOString(),
      });
    }

    return record => ({
      id: record.id,
      data: record,
      updated_at: new Date(
        (record as { updatedAt?: number; timestamp?: number }).updatedAt ||
          (record as { timestamp?: number }).timestamp ||
          Date.now()
      ).toISOString(),
    });
  }

  // ============================================================================
  // 网络状态
  // ============================================================================

  private handleOnline = async (): Promise<void> => {
    console.log('[RealtimeSync] 网络恢复');
    this.isOnline = true;

    // 延迟一小段时间，确保网络完全稳定
    setTimeout(async () => {
      if (this.config && this.state.connectionStatus !== 'connected') {
        console.log('[RealtimeSync] 网络恢复，尝试重连...');
        await this.connect(this.config);
      } else if (this.state.connectionStatus === 'connected') {
        console.log('[RealtimeSync] 网络恢复，执行同步检查...');
        await this.performBackgroundSync(true);
      }
    }, 1000);
  };

  private handleOffline = (): void => {
    console.log('[RealtimeSync] 网络断开');
    this.isOnline = false;
    this.setState({ connectionStatus: 'disconnected' });
  };
}

// ============================================================================
// 导出
// ============================================================================

export function getRealtimeSyncService(): RealtimeSyncService {
  return RealtimeSyncService.getInstance();
}
