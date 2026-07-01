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
  type SyncOperationResult,
} from '../syncOperations';
import { offlineQueue } from './offlineQueue';
import { hydrateLastSyncTime, setLastSyncTime } from './conflictResolver';
import { InitialSyncManager } from './InitialSyncManager';
import {
  localChangeListener,
  refreshSettingsStores,
  remoteChangeHandler,
} from './handlers';
import {
  useSyncStatusStore,
  type SupabaseSyncPhase,
} from '@/lib/stores/syncStatusStore';
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
  SETTINGS_UPLOAD_TIMEOUT: 60000,
  SUBSCRIPTION_TIMEOUT: 10000,
  SETTINGS_COOLDOWN: 3000,
  RECONNECT_BASE_DELAY: 1000,
  RECONNECT_MAX_DELAY: 30000,
} as const;

const SETTINGS_DIRTY_KEY = 'brew-guide:realtime-sync:settingsDirty';

type PostgresPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

const TASK_LABELS: Record<string, string> = {
  [SYNC_TABLES.COFFEE_BEANS]: '咖啡豆',
  [SYNC_TABLES.BREWING_NOTES]: '笔记',
  [SYNC_TABLES.CUSTOM_EQUIPMENTS]: '自定义器具',
  [SYNC_TABLES.CUSTOM_METHODS]: '自定义方案',
  [SYNC_TABLES.USER_SETTINGS]: '设置',
  offline_queue: '离线队列',
};

const FULL_SYNC_TASKS = [
  {
    id: SYNC_TABLES.COFFEE_BEANS,
    label: TASK_LABELS[SYNC_TABLES.COFFEE_BEANS],
  },
  {
    id: SYNC_TABLES.BREWING_NOTES,
    label: TASK_LABELS[SYNC_TABLES.BREWING_NOTES],
  },
  {
    id: SYNC_TABLES.CUSTOM_EQUIPMENTS,
    label: TASK_LABELS[SYNC_TABLES.CUSTOM_EQUIPMENTS],
  },
  {
    id: SYNC_TABLES.CUSTOM_METHODS,
    label: TASK_LABELS[SYNC_TABLES.CUSTOM_METHODS],
  },
  {
    id: SYNC_TABLES.USER_SETTINGS,
    label: TASK_LABELS[SYNC_TABLES.USER_SETTINGS],
  },
];

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function assertSyncSuccess<T>(
  result: SyncOperationResult<T>,
  fallbackMessage: string
): asserts result is SyncOperationResult<T> & { success: true } {
  if (!result.success) {
    throw new Error(result.error || fallbackMessage);
  }
}

function hasDirtySettings(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(SETTINGS_DIRTY_KEY) === '1';
}

function markSettingsDirty(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(SETTINGS_DIRTY_KEY, '1');
}

function clearSettingsDirty(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SETTINGS_DIRTY_KEY);
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMsg: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMsg)), ms)
    ),
  ]);
}

function getSettingsSyncMode(
  phase: SupabaseSyncPhase,
  settingsDirty: boolean
): 'bidirectional' | 'pull-only' {
  if (phase === 'background-sync' && !settingsDirty) {
    return 'pull-only';
  }

  return 'bidirectional';
}

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
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isDisconnecting = false;
  private isProcessingRemoteSettings = false;
  private isInitialized = false;
  private syncRunPromise: Promise<void> | null = null;

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
    void this.updatePendingCount();
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
      void this.performBackgroundSync(false);
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
    const sameConfig =
      this.config?.url === config.url &&
      this.config?.anonKey === config.anonKey;

    if (this.state.connectionStatus === 'connected' && sameConfig) {
      return true;
    }

    // 清理旧连接（包括失败后的残留 client/channel）
    if (this.client || this.channel) {
      await this.disconnect();
    }

    // 确保服务已初始化（监听器已启动）
    if (!this.isInitialized) {
      this.initialize(config);
    }

    const syncStore = useSyncStatusStore.getState();
    syncStore.setProvider('supabase');
    syncStore.setRealtimeEnabled(true);

    this.config = config;
    this.setState({ connectionStatus: 'connecting', error: null });
    this.clearReconnectTimer();

    try {
      this.client = createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });

      await this.setupRealtimeChannel();
      // setupLocalChangeListeners 已在 initialize 中调用
      this.setState({ connectionStatus: 'connected' });
      this.reconnectAttempts = 0;
      await this.updatePendingCount();

      // 后台执行初始同步
      console.log('[RealtimeSync] 连接成功，开始后台初始同步...');
      const lastSyncTime = await hydrateLastSyncTime();
      void this.performBackgroundSync(
        config.enableOfflineQueue !== false,
        lastSyncTime === 0 ? 'initial-sync' : 'background-sync'
      );

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败';
      console.error('[RealtimeSync] 连接失败:', message);
      this.setState({ connectionStatus: 'error', error: message });
      this.scheduleReconnect(`connect-failed:${message}`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.isDisconnecting = true;
    this.clearReconnectTimer();

    try {
      if (this.channel && this.client) {
        await this.client.removeChannel(this.channel);
        this.channel = null;
      } else if (this.channel) {
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
      this.isInitialized = false;
      this.reconnectAttempts = 0;
      this.pendingLocalChanges.clear();
      this.setState({ connectionStatus: 'disconnected', error: null });

      const syncStore = useSyncStatusStore.getState();
      syncStore.setRealtimeEnabled(false);
      syncStore.setProvider('none');
    } finally {
      this.isDisconnecting = false;
    }
  }

  async manualSync(): Promise<void> {
    if (!this.isConnected() || !this.client) {
      console.warn('[RealtimeSync] 未连接，无法同步');
      return;
    }

    await this.performBackgroundSync(true, 'manual-sync');
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

    this.cleanupExpiredLocalChanges();

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

    const syncStore = useSyncStatusStore.getState();
    const ownsProgress = !syncStore.supabaseSyncProgress.active;
    if (ownsProgress) {
      syncStore.setSyncing();
      syncStore.startSupabaseSyncProgress('local-change', '正在上传本地变更', [
        {
          id: changeKey,
          label: TASK_LABELS[table] || table,
          status: 'uploading',
          detail: action === 'delete' ? '同步删除' : '上传变更',
          total: 1,
          completed: 0,
        },
      ]);
    }

    try {
      if (action === 'delete') {
        const result = await markRecordsAsDeleted(this.client, table, [
          recordId,
        ]);
        assertSyncSuccess(result, `删除 ${table}/${recordId} 失败`);
      } else {
        const record = this.prepareRecordForUpload(table, recordId, data);
        const result = await upsertRecords(
          this.client,
          table,
          [record],
          this.createMapFn(table)
        );
        assertSyncSuccess(result, `上传 ${table}/${recordId} 失败`);
      }

      const now = Date.now();
      setLastSyncTime(now);
      this.setState({ lastSyncTime: now });

      if (ownsProgress) {
        syncStore.updateSupabaseSyncTask(changeKey, {
          status: 'success',
          detail: '已上传',
          completed: 1,
        });
        syncStore.finishSupabaseSyncProgress('上传完成');
        syncStore.setSyncSuccess();
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error(`[RealtimeSync] 同步失败 ${table}/${recordId}:`, error);
      await offlineQueue.enqueue(
        table,
        action === 'delete' ? 'delete' : 'upsert',
        recordId,
        data
      );
      await this.updatePendingCount();
      if (ownsProgress) {
        syncStore.updateSupabaseSyncTask(changeKey, {
          status: 'queued',
          detail: '上传失败，已保留到离线队列',
          error: message,
        });
        syncStore.failSupabaseSyncProgress('上传失败，已保留到离线队列');
        syncStore.setSyncError(message);
      }
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
      let settled = false;
      const timeout = setTimeout(() => {
        settled = true;
        reject(new Error('Realtime 订阅超时'));
      }, SYNC_TIMING.SUBSCRIPTION_TIMEOUT);

      this.channel!.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
          this.reconnectAttempts = 0;
        } else if (
          status === 'CLOSED' ||
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT'
        ) {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            reject(new Error(`订阅失败: ${status}`));
            return;
          }

          this.handleChannelRuntimeIssue(status);
        }
      });
    });
  }

  private handleChannelRuntimeIssue(status: string): void {
    if (this.isDisconnecting) return;

    console.warn(`[RealtimeSync] Channel 状态异常: ${status}`);
    if (this.state.connectionStatus !== 'connecting') {
      this.setState({
        connectionStatus: 'error',
        error: `Channel 异常: ${status}`,
      });
    }
    this.scheduleReconnect(`channel-${status}`);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(reason: string): void {
    if (!this.config || !this.isOnline || this.isDisconnecting) return;
    if (this.reconnectTimer) return;

    const attempt = this.reconnectAttempts + 1;
    const delay = Math.min(
      SYNC_TIMING.RECONNECT_BASE_DELAY * Math.pow(2, attempt - 1),
      SYNC_TIMING.RECONNECT_MAX_DELAY
    );

    this.reconnectAttempts = attempt;
    console.log(
      `[RealtimeSync] ${reason}，${delay}ms 后执行第 ${attempt} 次重连`
    );

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      if (!this.config || !this.isOnline || this.isDisconnecting) return;

      await this.connect(this.config);
    }, delay);
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
        assertSyncSuccess(result, '下载远端设置失败');
        await refreshSettingsStores();
        const now = Date.now();
        setLastSyncTime(now);
        this.setState({ lastSyncTime: now });
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error('[RealtimeSync] 处理远程设置变更失败:', error);
      useSyncStatusStore.getState().setSyncError(message);
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
        markSettingsDirty();

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

  private async performBackgroundSync(
    processQueue: boolean,
    phase: SupabaseSyncPhase = 'background-sync'
  ): Promise<void> {
    if (!this.client) return;

    if (this.syncRunPromise) {
      await this.syncRunPromise;
      if (processQueue) {
        await this.processOfflineQueue();
      }
      return;
    }

    this.syncRunPromise = (async () => {
      const syncStore = useSyncStatusStore.getState();

      // 确保 UI 状态更新
      this.setState({ isInitialSyncing: true, error: null });
      syncStore.setSyncing();
      syncStore.startSupabaseSyncProgress(
        phase,
        phase === 'initial-sync'
          ? '正在初始化 Supabase 数据'
          : '正在同步 Supabase 数据',
        processQueue
          ? [
              ...FULL_SYNC_TASKS,
              { id: 'offline_queue', label: TASK_LABELS.offline_queue },
            ]
          : FULL_SYNC_TASKS
      );

      try {
        const settingsDirty = hasDirtySettings();
        const settingsMode = getSettingsSyncMode(phase, settingsDirty);
        const syncManager = new InitialSyncManager(this.client!, {
          settingsMode,
          settingsDirty,
        });
        await syncManager.performSync();
        if (processQueue) {
          await this.processOfflineQueue();
        }
        if (settingsMode === 'bidirectional') {
          clearSettingsDirty();
        }
        const now = Date.now();
        this.setState({ lastSyncTime: now, error: null });
        syncStore.finishSupabaseSyncProgress('同步完成');
        syncStore.setSyncSuccess();
      } catch (error) {
        const message = getErrorMessage(error);
        console.error('[RealtimeSync] 后台同步失败:', error);
        this.setState({ error: message });
        syncStore.failSupabaseSyncProgress(message);
        syncStore.setSyncError(message);
      } finally {
        this.setState({ isInitialSyncing: false });
      }
    })();

    try {
      await this.syncRunPromise;
    } finally {
      this.syncRunPromise = null;
    }
  }

  private async syncSettingsUpload(): Promise<void> {
    if (!this.client) return;

    if (this.syncRunPromise) {
      try {
        await this.syncRunPromise;
      } catch {
        // 后台同步失败后仍允许本次设置上传尝试给用户一个可恢复路径。
      }

      if (!hasDirtySettings()) {
        return;
      }
    }

    const syncStore = useSyncStatusStore.getState();
    const ownsProgress = !syncStore.supabaseSyncProgress.active;
    if (ownsProgress) {
      syncStore.setSyncing();
      syncStore.startSupabaseSyncProgress('settings', '正在上传设置', [
        {
          id: SYNC_TABLES.USER_SETTINGS,
          label: TASK_LABELS[SYNC_TABLES.USER_SETTINGS],
          status: 'uploading',
          detail: '上传本地设置',
        },
      ]);
    }

    this.isProcessingRemoteSettings = true;
    try {
      const result = await withTimeout(
        uploadSettingsData(this.client, { skipIfUnchanged: true }),
        SYNC_TIMING.SETTINGS_UPLOAD_TIMEOUT,
        '上传设置超时'
      );
      assertSyncSuccess(result, '上传设置失败');
      clearSettingsDirty();
      if (ownsProgress) {
        syncStore.updateSupabaseSyncTask(SYNC_TABLES.USER_SETTINGS, {
          status: 'success',
          detail:
            result.affectedCount > 0
              ? `已上传 ${result.affectedCount} 项设置`
              : '没有需要上传的设置',
          uploaded: result.affectedCount,
        });
        syncStore.finishSupabaseSyncProgress('设置已同步');
        syncStore.setSyncSuccess();
      }
    } catch (error) {
      const message = getErrorMessage(error);
      console.error('[Sync] 设置上传失败:', error);
      if (ownsProgress) {
        syncStore.updateSupabaseSyncTask(SYNC_TABLES.USER_SETTINGS, {
          status: 'error',
          detail: '设置上传失败',
          error: message,
        });
        syncStore.failSupabaseSyncProgress(message);
        syncStore.setSyncError(message);
      }
    } finally {
      setTimeout(() => {
        this.isProcessingRemoteSettings = false;
      }, SYNC_TIMING.SETTINGS_COOLDOWN);
    }
  }

  private async processOfflineQueue(): Promise<void> {
    if (!this.client) return;

    const pendingCount = await offlineQueue.getPendingCount();
    if (pendingCount === 0) {
      useSyncStatusStore.getState().updateSupabaseSyncTask('offline_queue', {
        label: TASK_LABELS.offline_queue,
        status: 'success',
        detail: '没有待上传变更',
        total: 0,
        completed: 0,
      });
      return;
    }

    const syncStore = useSyncStatusStore.getState();
    const ownsProgress = !syncStore.supabaseSyncProgress.active;
    if (ownsProgress) {
      syncStore.setSyncing();
      syncStore.startSupabaseSyncProgress('offline-queue', '正在补传离线变更', [
        {
          id: 'offline_queue',
          label: TASK_LABELS.offline_queue,
          status: 'uploading',
          detail: `补传 ${pendingCount} 项变更`,
          total: pendingCount,
          completed: 0,
        },
      ]);
    } else {
      syncStore.updateSupabaseSyncTask('offline_queue', {
        label: TASK_LABELS.offline_queue,
        status: 'uploading',
        detail: `补传 ${pendingCount} 项变更`,
        total: pendingCount,
        completed: 0,
      });
    }

    const processor = async (op: PendingOperation): Promise<boolean> => {
      if (op.type === 'delete') {
        const result = await markRecordsAsDeleted(this.client!, op.table, [
          op.recordId,
        ]);
        assertSyncSuccess(result, `补传删除失败: ${op.table}/${op.recordId}`);
        return true;
      }

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
      assertSyncSuccess(result, `补传上传失败: ${op.table}/${op.recordId}`);
      return true;
    };

    const result = await offlineQueue.processQueue(processor);
    console.log(
      `[RealtimeSync] 离线队列: ${result.processed} 成功, ${result.failed} 失败, ${result.blocked} 保留`
    );
    await this.updatePendingCount();

    const remainingCount = await offlineQueue.getPendingCount();
    if (result.failed > 0 || result.blocked > 0) {
      syncStore.updateSupabaseSyncTask('offline_queue', {
        status: 'warning',
        detail: `${result.processed} 项已补传，${remainingCount} 项仍待处理`,
        total: pendingCount,
        completed: result.processed,
        failed: remainingCount,
      });
      if (ownsProgress) {
        syncStore.failSupabaseSyncProgress('部分离线变更仍待上传');
        syncStore.setSyncError('部分离线变更仍待上传');
      }
      throw new Error('部分离线变更仍待上传');
    }

    syncStore.updateSupabaseSyncTask('offline_queue', {
      status: 'success',
      detail: `已补传 ${result.processed} 项变更`,
      total: pendingCount,
      completed: result.processed,
    });
    if (ownsProgress) {
      syncStore.finishSupabaseSyncProgress('离线变更已补传');
      syncStore.setSyncSuccess();
    }
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

  private cleanupExpiredLocalChanges(): void {
    const now = Date.now();
    this.pendingLocalChanges.forEach((expireAt, key) => {
      if (expireAt <= now) {
        this.pendingLocalChanges.delete(key);
      }
    });
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
    this.clearReconnectTimer();
    this.setState({ connectionStatus: 'disconnected' });
  };
}

// ============================================================================
// 导出
// ============================================================================

export function getRealtimeSyncService(): RealtimeSyncService {
  return RealtimeSyncService.getInstance();
}
