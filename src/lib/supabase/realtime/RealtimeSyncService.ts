/**
 * Supabase 实时同步服务
 *
 * 核心功能：
 * 1. 建立 Realtime 连接，订阅云端变更
 * 2. 监听本地 Store 变更，自动上传
 * 3. 使用 Last-Write-Wins 解决冲突
 * 4. 离线队列支持
 *
 * 核心原则（重构后）：
 * - 云端是权威数据源
 * - 连接时先检查云端最新时间戳，决定是否需要拉取
 * - 使用 lastSyncTime 追踪同步状态
 * - 正确处理删除同步（tombstone 模式）
 *
 * 架构参考：
 * - CouchDB Replication Protocol
 * - RxDB Offline-First Architecture
 * - Supabase Realtime Documentation
 */

import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { db } from '@/lib/core/db';
import {
  SYNC_TABLES,
  DEFAULT_USER_ID,
  upsertRecords,
  markRecordsAsDeleted,
  uploadSettingsData,
  downloadSettingsData,
  fetchRemoteAllRecords,
  fetchAllTablesLatestTimestamp,
  fetchRemoteLatestTimestamp,
} from '../syncOperations';
import { offlineQueue } from './offlineQueue';
import {
  shouldAcceptRemoteChange,
  batchResolveConflicts,
  getLastSyncTime,
  setLastSyncTime,
} from './conflictResolver';
import type {
  RealtimeSyncConfig,
  RealtimeSyncState,
  RealtimeSyncTable,
  CloudRecord,
  PendingOperation,
} from './types';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';

// Supabase Realtime Payload 类型
type PostgresPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

// 表名到本地 Store 的映射
const TABLE_CONFIG = {
  [SYNC_TABLES.COFFEE_BEANS]: {
    dbTable: () => db.coffeeBeans,
    getStore: async () =>
      (await import('@/lib/stores/coffeeBeanStore')).useCoffeeBeanStore,
    eventName: 'coffeeBeanDataChanged',
  },
  [SYNC_TABLES.BREWING_NOTES]: {
    dbTable: () => db.brewingNotes,
    getStore: async () =>
      (await import('@/lib/stores/brewingNoteStore')).useBrewingNoteStore,
    eventName: 'brewingNoteDataChanged',
  },
  [SYNC_TABLES.CUSTOM_EQUIPMENTS]: {
    dbTable: () => db.customEquipments,
    getStore: async () =>
      (await import('@/lib/stores/customEquipmentStore'))
        .useCustomEquipmentStore,
    eventName: 'customEquipmentDataChanged',
  },
  [SYNC_TABLES.CUSTOM_METHODS]: {
    dbTable: () => db.customMethods,
    getStore: async () =>
      (await import('@/lib/stores/customMethodStore')).useCustomMethodStore,
    eventName: 'customMethodDataChanged',
  },
} as const;

/**
 * 实时同步服务单例
 */
export class RealtimeSyncService {
  private static instance: RealtimeSyncService | null = null;

  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private config: RealtimeSyncConfig | null = null;

  // 状态
  private state: RealtimeSyncState = {
    connectionStatus: 'disconnected',
    lastSyncTime: null,
    pendingChangesCount: 0,
    isInitialSyncing: false,
    error: null,
  };

  // 状态变更回调
  private stateListeners: Set<(state: RealtimeSyncState) => void> = new Set();

  // 本地变更监听器清理函数
  private localChangeListenerCleanup: (() => void) | null = null;

  // 网络状态监听
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // 防止重复处理的标记
  private processingRemoteChanges = new Set<string>();

  // 设置上传防抖定时器
  private settingsUploadTimer: ReturnType<typeof setTimeout> | null = null;

  // 防止设置同步循环
  private isProcessingRemoteSettings = false;

  private constructor() {
    // 监听网络状态
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(): RealtimeSyncService {
    if (!RealtimeSyncService.instance) {
      RealtimeSyncService.instance = new RealtimeSyncService();
    }
    return RealtimeSyncService.instance;
  }

  /**
   * 获取当前状态
   */
  getState(): RealtimeSyncState {
    return { ...this.state };
  }

  /**
   * 订阅状态变更
   */
  subscribe(listener: (state: RealtimeSyncState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  /**
   * 更新状态并通知监听器
   */
  private setState(updates: Partial<RealtimeSyncState>): void {
    this.state = { ...this.state, ...updates };
    this.stateListeners.forEach(listener => listener(this.state));
  }

  /**
   * 初始化并连接
   *
   * 优化说明：
   * 1. 移除了阻塞的连接测试（Realtime 订阅成功即表示连接成功）
   * 2. 初始同步改为异步执行，不阻塞连接返回
   * 3. 遵循 Supabase 官方最佳实践
   */
  async connect(config: RealtimeSyncConfig): Promise<boolean> {
    if (
      this.state.connectionStatus === 'connected' &&
      this.config?.url === config.url
    ) {
      console.log('[RealtimeSync] 已连接，跳过重复连接');
      return true;
    }

    this.config = config;
    this.setState({ connectionStatus: 'connecting', error: null });

    try {
      // 创建 Supabase 客户端（复用已有实例）
      if (!this.client || this.config?.url !== config.url) {
        this.client = createClient(config.url, config.anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          realtime: {
            params: {
              eventsPerSecond: 10,
            },
          },
        });
      }

      // 建立 Realtime 订阅（这是核心连接步骤）
      await this.setupRealtimeSubscription();

      // 设置本地变更监听
      this.setupLocalChangeListeners();

      this.setState({ connectionStatus: 'connected' });
      console.log('[RealtimeSync] 连接成功');

      // 异步执行初始同步和离线队列处理（不阻塞连接返回）
      this.runBackgroundSync(config.enableOfflineQueue !== false);

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败';
      console.error('[RealtimeSync] 连接失败:', message);
      this.setState({ connectionStatus: 'error', error: message });
      return false;
    }
  }

  /**
   * 后台执行同步任务
   */
  private async runBackgroundSync(processOfflineQueue: boolean): Promise<void> {
    try {
      // 执行初始同步
      await this.performInitialSync();

      // 处理离线队列
      if (processOfflineQueue) {
        await this.processOfflineQueue();
      }
    } catch (error) {
      console.error('[RealtimeSync] 后台同步失败:', error);
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    console.log('[RealtimeSync] 断开连接');

    // 清理 Realtime 订阅
    if (this.channel) {
      await this.channel.unsubscribe();
      this.channel = null;
    }

    // 清理本地变更监听
    if (this.localChangeListenerCleanup) {
      this.localChangeListenerCleanup();
      this.localChangeListenerCleanup = null;
    }

    this.client = null;
    this.config = null;
    this.setState({
      connectionStatus: 'disconnected',
      error: null,
    });
  }

  /**
   * 设置 Realtime 订阅
   */
  private async setupRealtimeSubscription(): Promise<void> {
    if (!this.client) return;

    const channelName = `brew-guide-sync-${DEFAULT_USER_ID}`;

    this.channel = this.client
      .channel(channelName)
      // 订阅咖啡豆变更
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
      // 订阅冲煮记录变更
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
      // 订阅自定义器具变更
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
      // 订阅自定义方案变更
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
      // 订阅用户设置变更
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

    // 监听连接状态（5秒超时）
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('订阅超时'));
      }, 5000);

      this.channel!.subscribe(status => {
        console.log(`[RealtimeSync] Channel 状态: ${status}`);
        if (status === 'SUBSCRIBED') {
          clearTimeout(timeout);
          this.setState({ connectionStatus: 'connected' });
          resolve();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          clearTimeout(timeout);
          this.setState({ connectionStatus: 'disconnected' });
          reject(new Error(`订阅失败: ${status}`));
        }
      });
    });
  }

  /**
   * 处理云端变更
   */
  private async handleRemoteChange(
    table: RealtimeSyncTable,
    payload: PostgresPayload
  ): Promise<void> {
    // 从 payload 中提取记录 ID
    const newRecord = payload.new as Record<string, unknown> | null;
    const oldRecord = payload.old as Record<string, unknown> | null;
    const recordId = (newRecord?.id as string) || (oldRecord?.id as string);
    if (!recordId) return;

    // 防止处理自己触发的变更
    const changeKey = `${table}:${recordId}`;
    if (this.processingRemoteChanges.has(changeKey)) {
      console.log(`[RealtimeSync] 跳过自己触发的变更: ${changeKey}`);
      return;
    }

    console.log(
      `[RealtimeSync] 收到云端变更: ${table} - ${payload.eventType} - ${recordId}`
    );

    try {
      const config = TABLE_CONFIG[table];
      if (!config) return;

      const dbTable = config.dbTable();

      if (payload.eventType === 'DELETE' || newRecord?.deleted_at) {
        // 处理删除
        const localRecord = await dbTable.get(recordId);
        if (localRecord) {
          // 检查是否应该接受删除
          const remoteTime = newRecord?.updated_at
            ? new Date(newRecord.updated_at as string).getTime()
            : Date.now();
          const localTime =
            (localRecord as { timestamp?: number }).timestamp || 0;

          if (remoteTime >= localTime) {
            await dbTable.delete(recordId);
            console.log(`[RealtimeSync] 本地删除: ${table}/${recordId}`);

            // 通知 Store 更新
            await this.notifyStoreChange(table, 'delete', recordId);
          }
        }
      } else if (
        payload.eventType === 'INSERT' ||
        payload.eventType === 'UPDATE'
      ) {
        // 处理插入/更新
        const remoteRecord = newRecord as CloudRecord<
          Record<string, unknown>
        > | null;
        if (!remoteRecord?.data) return;

        const localRecord = await dbTable.get(recordId);

        if (
          shouldAcceptRemoteChange(
            localRecord as { id: string; timestamp?: number } | undefined,
            remoteRecord as CloudRecord<{ id: string; timestamp?: number }>
          )
        ) {
          // 接受远程变更 - 使用类型断言
          await (dbTable as { put: (data: unknown) => Promise<unknown> }).put(
            remoteRecord.data
          );
          console.log(`[RealtimeSync] 本地更新: ${table}/${recordId}`);

          // 通知 Store 更新
          await this.notifyStoreChange(
            table,
            localRecord ? 'update' : 'create',
            recordId,
            remoteRecord.data
          );
        } else {
          console.log(
            `[RealtimeSync] 本地数据更新，忽略远程变更: ${table}/${recordId}`
          );
        }
      }

      // 更新同步时间（包括持久化）
      const newSyncTime = Date.now();
      setLastSyncTime(newSyncTime);
      this.setState({ lastSyncTime: newSyncTime });
    } catch (error) {
      console.error(`[RealtimeSync] 处理云端变更失败:`, error);
    }
  }

  /**
   * 处理云端设置变更
   */
  private async handleRemoteSettingsChange(
    payload: PostgresPayload
  ): Promise<void> {
    // 只处理 INSERT 和 UPDATE
    if (payload.eventType === 'DELETE') return;

    console.log('[RealtimeSync] 收到云端设置变更');

    try {
      this.isProcessingRemoteSettings = true;

      // 下载并应用设置
      if (this.client) {
        const result = await downloadSettingsData(this.client);
        if (result.success) {
          console.log('[RealtimeSync] 设置已从云端同步');

          // 刷新设置 Store
          const { useSettingsStore } = await import(
            '@/lib/stores/settingsStore'
          );
          await useSettingsStore.getState().loadSettings();

          // 刷新磨豆机 Store
          const { useGrinderStore } = await import(
            '@/lib/stores/grinderStore'
          );
          await useGrinderStore.getState().refreshGrinders();

          // 更新同步时间（包括持久化）
          const newSyncTime = Date.now();
          setLastSyncTime(newSyncTime);
          this.setState({ lastSyncTime: newSyncTime });
        }
      }
    } catch (error) {
      console.error('[RealtimeSync] 处理云端设置变更失败:', error);
    } finally {
      // 延迟重置标记，避免立即触发上传
      setTimeout(() => {
        this.isProcessingRemoteSettings = false;
      }, 2000);
    }
  }

  /**
   * 双向同步设置（先比较时间戳，决定是下载还是上传）
   *
   * 核心逻辑：
   * 1. 获取云端设置的 updated_at 时间戳
   * 2. 与本地 lastSyncTime 比较
   * 3. 如果云端更新 → 下载（不需要上传，因为本地没有更新）
   * 4. 如果云端没有更新 → 上传本地设置
   *
   * 注意：避免下载后立即上传导致的循环
   */
  private async syncSettings(): Promise<void> {
    if (!this.client) return;

    // 设置标记防止上传触发的 realtime 事件导致循环
    this.isProcessingRemoteSettings = true;

    try {
      const lastSyncTime = getLastSyncTime();

      // 1. 获取云端设置时间戳
      const remoteTimestampResult = await fetchRemoteLatestTimestamp(
        this.client,
        SYNC_TABLES.USER_SETTINGS
      );

      const remoteTimestamp = remoteTimestampResult.success
        ? remoteTimestampResult.data || 0
        : 0;

      // 2. 如果云端有更新的设置（时间戳比上次同步时间更晚），下载
      if (remoteTimestamp > lastSyncTime) {
        console.log(
          `[Sync] 设置: 云端更新 (${new Date(remoteTimestamp).toLocaleString()} > ${new Date(lastSyncTime).toLocaleString()}), 下载`
        );

        const downloadResult = await downloadSettingsData(this.client);
        if (downloadResult.success) {
          console.log('[Sync] 设置: 云端设置已下载');

          // 刷新设置 Store 和磨豆机 Store
          const { useSettingsStore } = await import(
            '@/lib/stores/settingsStore'
          );
          await useSettingsStore.getState().loadSettings();

          // 刷新磨豆机 Store
          const { useGrinderStore } = await import(
            '@/lib/stores/grinderStore'
          );
          await useGrinderStore.getState().refreshGrinders();
        } else {
          console.error('[Sync] 设置下载失败:', downloadResult.error);
        }
        // 下载后不需要上传，直接返回
        return;
      }

      // 3. 云端没有更新，上传本地设置
      const uploadResult = await uploadSettingsData(this.client);
      if (uploadResult.success) {
        console.log('[Sync] 设置: 已上传到云端');
      } else {
        console.error('[Sync] 设置上传失败:', uploadResult.error);
      }
    } catch (error) {
      console.error('[Sync] 设置同步失败:', error);
    } finally {
      // 延迟重置标记，避免上传触发的 realtime 事件导致循环
      setTimeout(() => {
        this.isProcessingRemoteSettings = false;
      }, 3000);
    }
  }

  /**
   * 通知 Store 更新（直接更新 Zustand 内存状态）
   */
  private async notifyStoreChange(
    table: RealtimeSyncTable,
    action: 'create' | 'update' | 'delete',
    recordId: string,
    data?: unknown
  ): Promise<void> {
    try {
      // 根据表名获取对应的 Store 并更新
      if (table === SYNC_TABLES.COFFEE_BEANS) {
        const { useCoffeeBeanStore } = await import(
          '@/lib/stores/coffeeBeanStore'
        );
        const store = useCoffeeBeanStore.getState();

        if (action === 'delete') {
          // 直接从内存中移除，不触发 DB 操作（已经处理过了）
          useCoffeeBeanStore.setState({
            beans: store.beans.filter(b => b.id !== recordId),
          });
        } else {
          // create 或 update
          const bean = data as CoffeeBean;
          const exists = store.beans.some(b => b.id === recordId);
          if (exists) {
            useCoffeeBeanStore.setState({
              beans: store.beans.map(b => (b.id === recordId ? bean : b)),
            });
          } else {
            useCoffeeBeanStore.setState({
              beans: [...store.beans, bean],
            });
          }
        }
        console.log(`[RealtimeSync] Store 已更新: coffee_beans/${action}`);
      } else if (table === SYNC_TABLES.BREWING_NOTES) {
        const { useBrewingNoteStore } = await import(
          '@/lib/stores/brewingNoteStore'
        );
        const store = useBrewingNoteStore.getState();

        if (action === 'delete') {
          useBrewingNoteStore.setState({
            notes: store.notes.filter(n => n.id !== recordId),
          });
        } else {
          const note = data as BrewingNote;
          const exists = store.notes.some(n => n.id === recordId);
          if (exists) {
            useBrewingNoteStore.setState({
              notes: store.notes.map(n => (n.id === recordId ? note : n)),
            });
          } else {
            useBrewingNoteStore.setState({
              notes: [...store.notes, note],
            });
          }
        }
        console.log(`[RealtimeSync] Store 已更新: brewing_notes/${action}`);
      } else if (table === SYNC_TABLES.CUSTOM_EQUIPMENTS) {
        const { useCustomEquipmentStore } = await import(
          '@/lib/stores/customEquipmentStore'
        );
        const store = useCustomEquipmentStore.getState();

        if (action === 'delete') {
          useCustomEquipmentStore.setState({
            equipments: store.equipments.filter(e => e.id !== recordId),
          });
        } else {
          const equipment = data as CustomEquipment;
          const exists = store.equipments.some(e => e.id === recordId);
          if (exists) {
            useCustomEquipmentStore.setState({
              equipments: store.equipments.map(e =>
                e.id === recordId ? equipment : e
              ),
            });
          } else {
            useCustomEquipmentStore.setState({
              equipments: [...store.equipments, equipment],
            });
          }
        }
        console.log(`[RealtimeSync] Store 已更新: custom_equipments/${action}`);
      } else if (table === SYNC_TABLES.CUSTOM_METHODS) {
        const { useCustomMethodStore } = await import(
          '@/lib/stores/customMethodStore'
        );
        const store = useCustomMethodStore.getState();
        const equipmentId = recordId; // id = equipmentId

        if (action === 'delete') {
          // 删除：移除该器具的所有方案
          const newMethodsByEquipment = { ...store.methodsByEquipment };
          delete newMethodsByEquipment[equipmentId];
          useCustomMethodStore.setState({
            methodsByEquipment: newMethodsByEquipment,
          });
        } else {
          // create 或 update：直接更新内存中的方案
          const methodData = data as { equipmentId: string; methods: Method[] };
          useCustomMethodStore.setState({
            methodsByEquipment: {
              ...store.methodsByEquipment,
              [equipmentId]: methodData.methods || [],
            },
          });
        }
        console.log(`[RealtimeSync] Store 已更新: custom_methods/${action}`);
      }
    } catch (error) {
      console.error(`[RealtimeSync] 更新 Store 失败:`, error);
    }
  }

  /**
   * 设置本地变更监听
   */
  private setupLocalChangeListeners(): void {
    if (typeof window === 'undefined') return;

    const handleLocalChange = async (event: CustomEvent) => {
      const { action, beanId, bean, source } = event.detail;

      // 忽略来自远程同步的变更
      if (source === 'remote') return;

      // 忽略离线状态
      if (!this.isOnline) {
        console.log('[RealtimeSync] 离线状态，添加到队列');
        await offlineQueue.enqueue(
          SYNC_TABLES.COFFEE_BEANS,
          action === 'delete' ? 'delete' : 'upsert',
          beanId,
          bean
        );
        this.updatePendingCount();
        return;
      }

      await this.syncLocalChange(
        SYNC_TABLES.COFFEE_BEANS,
        action,
        beanId,
        bean
      );
    };

    const handleNoteChange = async (event: CustomEvent) => {
      const { action, noteId, note, source } = event.detail;
      if (source === 'remote') return;

      if (!this.isOnline) {
        await offlineQueue.enqueue(
          SYNC_TABLES.BREWING_NOTES,
          action === 'delete' ? 'delete' : 'upsert',
          noteId,
          note
        );
        this.updatePendingCount();
        return;
      }

      await this.syncLocalChange(
        SYNC_TABLES.BREWING_NOTES,
        action,
        noteId,
        note
      );
    };

    // 器具变更监听
    const handleEquipmentChange = async (event: CustomEvent) => {
      const { action, equipmentId, equipment, source } = event.detail;
      if (source === 'remote') return;

      if (!this.isOnline) {
        await offlineQueue.enqueue(
          SYNC_TABLES.CUSTOM_EQUIPMENTS,
          action === 'delete' ? 'delete' : 'upsert',
          equipmentId,
          equipment
        );
        this.updatePendingCount();
        return;
      }

      await this.syncLocalChange(
        SYNC_TABLES.CUSTOM_EQUIPMENTS,
        action,
        equipmentId,
        equipment
      );
    };

    // 方案变更监听
    const handleMethodChange = async (event: CustomEvent) => {
      const { action, equipmentId, methods, source } = event.detail;
      if (source === 'remote') return;

      // 验证 equipmentId 存在
      if (!equipmentId) {
        console.warn('[RealtimeSync] 方案变更缺少 equipmentId，跳过同步');
        return;
      }

      // 根据 action 判断操作类型
      const syncAction = action === 'delete' ? 'delete' : 'upsert';
      const data = { equipmentId, methods: methods || [] };

      if (!this.isOnline) {
        await offlineQueue.enqueue(
          SYNC_TABLES.CUSTOM_METHODS,
          syncAction,
          equipmentId,
          data
        );
        this.updatePendingCount();
        return;
      }

      await this.syncLocalChange(
        SYNC_TABLES.CUSTOM_METHODS,
        syncAction,
        equipmentId,
        data
      );
    };

    // 设置变更监听
    const handleSettingsChange = () => {
      // 如果是远程设置同步触发的，跳过
      if (this.isProcessingRemoteSettings) return;

      // 防抖：设置变更可能频繁，延迟上传
      if (this.settingsUploadTimer) {
        clearTimeout(this.settingsUploadTimer);
      }
      this.settingsUploadTimer = setTimeout(async () => {
        if (!this.isOnline || !this.client) return;
        console.log('[RealtimeSync] 检测到设置变更，上传到云端...');
        await this.syncSettings();
      }, 1000); // 1秒防抖
    };

    // 添加监听器 - 使用正确的类型断言
    window.addEventListener(
      'coffeeBeanDataChanged',
      handleLocalChange as unknown as EventListener
    );
    window.addEventListener(
      'brewingNoteDataChanged',
      handleNoteChange as unknown as EventListener
    );
    window.addEventListener(
      'customEquipmentDataChanged',
      handleEquipmentChange as unknown as EventListener
    );
    window.addEventListener(
      'customMethodDataChanged',
      handleMethodChange as unknown as EventListener
    );
    window.addEventListener('settingsChanged', handleSettingsChange);
    // 磨豆机变更也触发设置同步（磨豆机数据包含在设置中）
    window.addEventListener('grinderDataChanged', handleSettingsChange);

    // 保存清理函数
    this.localChangeListenerCleanup = () => {
      window.removeEventListener(
        'coffeeBeanDataChanged',
        handleLocalChange as unknown as EventListener
      );
      window.removeEventListener(
        'brewingNoteDataChanged',
        handleNoteChange as unknown as EventListener
      );
      window.removeEventListener(
        'customEquipmentDataChanged',
        handleEquipmentChange as unknown as EventListener
      );
      window.removeEventListener(
        'customMethodDataChanged',
        handleMethodChange as unknown as EventListener
      );
      window.removeEventListener('settingsChanged', handleSettingsChange);
      window.removeEventListener('grinderDataChanged', handleSettingsChange);
      if (this.settingsUploadTimer) {
        clearTimeout(this.settingsUploadTimer);
      }
    };
  }

  /**
   * 同步本地变更到云端
   */
  private async syncLocalChange(
    table: RealtimeSyncTable,
    action: string,
    recordId: string,
    data?: unknown
  ): Promise<void> {
    if (!this.client) return;

    const changeKey = `${table}:${recordId}`;
    this.processingRemoteChanges.add(changeKey);

    try {
      if (action === 'delete') {
        await markRecordsAsDeleted(this.client, table, [recordId]);
        console.log(`[RealtimeSync] 已同步删除: ${table}/${recordId}`);
      } else {
        // create 或 update - 统一映射函数
        // 注意：对于 custom_methods，id 就是 equipmentId
        const mapFn = (record: { id: string }) => ({
          id: record.id,
          data: record,
          updated_at: new Date().toISOString(),
        });

        // 确保 id 字段正确（展开 data 后再设置 id，防止被覆盖）
        const recordData = { ...(data as object), id: recordId };

        await upsertRecords(
          this.client,
          table,
          [recordData as { id: string }],
          mapFn
        );
        console.log(`[RealtimeSync] 已同步更新: ${table}/${recordId}`);
      }

      // 更新同步时间（包括持久化）
      const newSyncTime = Date.now();
      setLastSyncTime(newSyncTime);
      this.setState({ lastSyncTime: newSyncTime });
    } catch (error) {
      console.error(`[RealtimeSync] 同步失败:`, error);

      // 添加到离线队列重试
      await offlineQueue.enqueue(
        table,
        action === 'delete' ? 'delete' : 'upsert',
        recordId,
        data
      );
      this.updatePendingCount();
    } finally {
      // 延迟移除标记，避免收到自己的变更
      setTimeout(() => {
        this.processingRemoteChanges.delete(changeKey);
      }, 1000);
    }
  }

  /**
   * 执行初始同步（改进版：云端优先 + 正确的删除处理）
   *
   * 核心逻辑：
   * 1. 检查云端最新时间戳，与本地 lastSyncTime 比较
   * 2. 如果云端有更新，先拉取云端数据
   * 3. 然后上传本地的新增/修改
   * 4. 正确处理删除（本地删除→云端标记删除，云端删除→本地删除）
   */
  private async performInitialSync(): Promise<void> {
    if (!this.client) return;

    const syncStartTime = Date.now();
    this.setState({ isInitialSyncing: true });

    try {
      const lastSyncTime = getLastSyncTime();
      console.log(
        `[Sync] 开始, lastSync=${lastSyncTime ? new Date(lastSyncTime).toLocaleString() : '首次'}`
      );

      // 并行同步所有表（使用 allSettled 避免一个失败导致全部失败）
      const results = await Promise.allSettled([
        this.syncTableWithDelete(
          SYNC_TABLES.COFFEE_BEANS,
          async () => db.coffeeBeans.toArray(),
          async (items: CoffeeBean[]) => {
            await db.coffeeBeans.bulkPut(items);
          },
          async (ids: string[]) => {
            for (const id of ids) {
              await db.coffeeBeans.delete(id);
            }
          },
          (bean: CoffeeBean) => ({
            id: bean.id,
            data: bean,
            updated_at: new Date(bean.timestamp || Date.now()).toISOString(),
          }),
          lastSyncTime
        ),
        this.syncTableWithDelete(
          SYNC_TABLES.BREWING_NOTES,
          async () => db.brewingNotes.toArray(),
          async (items: BrewingNote[]) => {
            await db.brewingNotes.bulkPut(items);
          },
          async (ids: string[]) => {
            for (const id of ids) {
              await db.brewingNotes.delete(id);
            }
          },
          (note: BrewingNote) => ({
            id: note.id,
            data: note,
            updated_at: new Date(note.timestamp || Date.now()).toISOString(),
          }),
          lastSyncTime
        ),
        this.syncTableWithDelete(
          SYNC_TABLES.CUSTOM_EQUIPMENTS,
          async () => db.customEquipments.toArray(),
          async (items: CustomEquipment[]) => {
            await db.customEquipments.bulkPut(items);
          },
          async (ids: string[]) => {
            for (const id of ids) {
              await db.customEquipments.delete(id);
            }
          },
          (equip: CustomEquipment) => ({
            id: equip.id,
            data: equip,
            updated_at: new Date(equip.timestamp || Date.now()).toISOString(),
          }),
          lastSyncTime
        ),
        (async () => {
          // 扩展类型以包含 timestamp 字段用于冲突解决
          type MethodRecord = {
            equipmentId: string;
            methods: Method[];
            timestamp?: number;
          };
          return this.syncTableWithDelete<MethodRecord & { id: string }>(
            SYNC_TABLES.CUSTOM_METHODS,
            async () => {
              const records = await db.customMethods.toArray();
              // 为每条记录计算 timestamp（取方案数组中最新的时间戳）
              return records.map(r => {
                const maxTimestamp = Math.max(
                  0,
                  ...r.methods.map(m => m.timestamp || 0)
                );
                return {
                  ...r,
                  id: r.equipmentId,
                  timestamp: maxTimestamp || undefined,
                };
              });
            },
            async items => {
              const methodRecords = items.map(
                ({ id, ...rest }) => rest as unknown as MethodRecord
              );
              await db.customMethods.bulkPut(methodRecords);
            },
            async (ids: string[]) => {
              for (const id of ids) {
                await db.customMethods.delete(id);
              }
            },
            method => {
              // 获取方案数组中最新的时间戳
              const maxTimestamp = Math.max(
                0,
                ...method.methods.map(m => m.timestamp || 0)
              );
              return {
                id: method.id,
                data: {
                  equipmentId: method.equipmentId,
                  methods: method.methods,
                },
                updated_at: new Date(maxTimestamp || Date.now()).toISOString(),
              };
            },
            lastSyncTime
          );
        })(),
      ]);

      // 汇总同步结果
      const successResults = results
        .filter(
          (
            r
          ): r is PromiseFulfilledResult<{
            uploaded: number;
            downloaded: number;
            deleted: number;
          }> => r.status === 'fulfilled'
        )
        .map(r => r.value);

      const failedCount = results.filter(r => r.status === 'rejected').length;
      if (failedCount > 0) {
        console.warn(`[Sync] ${failedCount} 个表同步失败`);
      }

      const totalChanges = successResults.reduce(
        (acc, r) => ({
          uploaded: acc.uploaded + r.uploaded,
          downloaded: acc.downloaded + r.downloaded,
          deleted: acc.deleted + r.deleted,
        }),
        { uploaded: 0, downloaded: 0, deleted: 0 }
      );

      // 同步设置
      await this.syncSettings();

      // 刷新所有 Store
      await this.refreshAllStores();

      // 更新 lastSyncTime
      const newSyncTime = Date.now();
      setLastSyncTime(newSyncTime);
      this.setState({ lastSyncTime: newSyncTime, isInitialSyncing: false });

      const elapsed = Date.now() - syncStartTime;
      console.log(
        `[Sync] 完成 (${elapsed}ms): ↑${totalChanges.uploaded} ↓${totalChanges.downloaded} ×${totalChanges.deleted}`
      );
    } catch (error) {
      console.error('[Sync] 同步失败:', error);
      this.setState({ isInitialSyncing: false });
    }
  }

  /**
   * 带删除处理的表同步方法（改进版）
   *
   * 使用新的 batchResolveConflicts 方法，正确处理：
   * 1. 本地新增 → 上传
   * 2. 云端新增 → 下载
   * 3. 两边都有 → 比较时间戳
   * 4. 云端已删除 → 本地删除
   * 5. 本地删除 → 上传删除标记
   */
  private async syncTableWithDelete<
    T extends { id: string; timestamp?: number },
  >(
    tableName: RealtimeSyncTable,
    getLocalRecords: () => Promise<T[]>,
    saveLocalRecords: (items: T[]) => Promise<void>,
    deleteLocalRecords: (ids: string[]) => Promise<void>,
    mapFn: (record: T) => Record<string, unknown>,
    lastSyncTime: number
  ): Promise<{ uploaded: number; downloaded: number; deleted: number }> {
    const emptyResult = { uploaded: 0, downloaded: 0, deleted: 0 };

    if (!this.client) {
      console.error(`[Sync] ${tableName}: 无客户端`);
      return emptyResult;
    }

    try {
      // 1. 获取本地数据
      const localRecords = await getLocalRecords();

      // 2. 获取云端所有数据
      const remoteResult = await fetchRemoteAllRecords<T>(
        this.client,
        tableName
      );
      if (!remoteResult.success) {
        console.error(`[Sync] ${tableName}: 拉取失败 - ${remoteResult.error}`);
        return emptyResult;
      }

      const remoteRecords = (remoteResult.data || []).map(r => ({
        id: r.id,
        user_id: DEFAULT_USER_ID,
        data: r.data,
        updated_at: r.updated_at,
        deleted_at: r.deleted_at,
      })) as CloudRecord<T>[];

      // 统计云端已删除的记录数
      const deletedInCloud = remoteRecords.filter(r => r.deleted_at).length;
      console.log(
        `[Sync] ${tableName}: 本地=${localRecords.length}, 云端=${remoteRecords.length} (已删除=${deletedInCloud})`
      );

      // 3. 使用冲突解决算法
      const { toUpload, toDownload, toDeleteLocal } = batchResolveConflicts(
        localRecords,
        remoteRecords,
        lastSyncTime
      );

      // 4. 执行上传
      if (toUpload.length > 0) {
        const result = await upsertRecords(
          this.client,
          tableName,
          toUpload,
          mapFn
        );
        if (!result.success) {
          console.error(`[Sync] ${tableName} 上传失败:`, result.error);
        }
      }

      // 5. 执行下载
      if (toDownload.length > 0) {
        await saveLocalRecords(toDownload);
      }

      // 6. 执行本地删除
      if (toDeleteLocal.length > 0) {
        await deleteLocalRecords(toDeleteLocal);
        console.log(
          `[Sync] ${tableName} 本地删除: ${toDeleteLocal.join(', ')}`
        );
      }

      // 输出同步结果
      if (toUpload.length || toDownload.length || toDeleteLocal.length) {
        console.log(
          `[Sync] ${tableName}: ↑${toUpload.length} ↓${toDownload.length} ×${toDeleteLocal.length}`
        );
      }

      return {
        uploaded: toUpload.length,
        downloaded: toDownload.length,
        deleted: toDeleteLocal.length,
      };
    } catch (error) {
      console.error(`[Sync] ${tableName} 失败:`, error);
      return { uploaded: 0, downloaded: 0, deleted: 0 };
    }
  }

  /**
   * 刷新所有 Zustand Store（从 IndexedDB 重新加载数据）
   */
  private async refreshAllStores(): Promise<void> {
    try {
      // 并行刷新所有 Store
      await Promise.all([
        (async () => {
          const { useCoffeeBeanStore } = await import(
            '@/lib/stores/coffeeBeanStore'
          );
          const beans = await db.coffeeBeans.toArray();
          useCoffeeBeanStore.setState({ beans });
        })(),
        (async () => {
          const { useBrewingNoteStore } = await import(
            '@/lib/stores/brewingNoteStore'
          );
          const notes = await db.brewingNotes.toArray();
          useBrewingNoteStore.setState({ notes });
        })(),
        (async () => {
          const { useCustomEquipmentStore } = await import(
            '@/lib/stores/customEquipmentStore'
          );
          const equipments = await db.customEquipments.toArray();
          useCustomEquipmentStore.setState({ equipments });
        })(),
        (async () => {
          const { useCustomMethodStore } = await import(
            '@/lib/stores/customMethodStore'
          );
          const methodsData = await db.customMethods.toArray();
          const methodsByEquipment: Record<string, Method[]> = {};
          for (const item of methodsData) {
            methodsByEquipment[item.equipmentId] = item.methods;
          }
          useCustomMethodStore.setState({
            methodsByEquipment,
            initialized: true,
          });
        })(),
        (async () => {
          const { useSettingsStore } = await import(
            '@/lib/stores/settingsStore'
          );
          await useSettingsStore.getState().loadSettings();
        })(),
      ]);
    } catch (error) {
      console.error('[Sync] 刷新 Store 失败:', error);
    }
  }

  /**
   * 处理离线队列
   */
  private async processOfflineQueue(): Promise<void> {
    if (!this.client) return;

    const processor = async (operation: PendingOperation): Promise<boolean> => {
      try {
        if (operation.type === 'delete') {
          const result = await markRecordsAsDeleted(
            this.client!,
            operation.table,
            [operation.recordId]
          );
          return result.success;
        } else {
          const result = await upsertRecords(
            this.client!,
            operation.table,
            [{ id: operation.recordId, ...(operation.data as object) }],
            record => ({
              id: record.id,
              data: record,
              updated_at: new Date().toISOString(),
            })
          );
          return result.success;
        }
      } catch {
        return false;
      }
    };

    const result = await offlineQueue.processQueue(processor);
    console.log(
      `[RealtimeSync] 离线队列处理完成: ${result.processed} 成功, ${result.failed} 失败`
    );
    this.updatePendingCount();
  }

  /**
   * 更新待同步数量
   */
  private async updatePendingCount(): Promise<void> {
    const count = await offlineQueue.getPendingCount();
    this.setState({ pendingChangesCount: count });
  }

  /**
   * 网络恢复处理
   */
  private handleOnline = async (): Promise<void> => {
    console.log('[RealtimeSync] 网络恢复');
    this.isOnline = true;

    // 重新连接
    if (this.config && this.state.connectionStatus !== 'connected') {
      await this.connect(this.config);
    }

    // 处理离线队列
    await this.processOfflineQueue();
  };

  /**
   * 网络断开处理
   */
  private handleOffline = (): void => {
    console.log('[RealtimeSync] 网络断开');
    this.isOnline = false;
    this.setState({ connectionStatus: 'disconnected' });
  };

  /**
   * 手动触发同步
   */
  async manualSync(): Promise<void> {
    if (this.state.connectionStatus !== 'connected') {
      console.warn('[RealtimeSync] 未连接，无法同步');
      return;
    }

    await this.performInitialSync();
    await this.processOfflineQueue();
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.state.connectionStatus === 'connected';
  }
}

// 导出单例获取函数
export function getRealtimeSyncService(): RealtimeSyncService {
  return RealtimeSyncService.getInstance();
}
