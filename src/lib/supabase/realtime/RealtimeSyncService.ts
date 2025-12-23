/**
 * Supabase 实时同步服务
 *
 * 核心功能：
 * 1. 建立 Realtime 连接，订阅云端变更
 * 2. 监听本地 Store 变更，自动上传
 * 3. 使用 Last-Write-Wins 解决冲突
 * 4. 离线队列支持
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
} from '../syncOperations';
import { offlineQueue } from './offlineQueue';
import {
  shouldAcceptRemoteChange,
  batchResolveConflicts,
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
      // 创建 Supabase 客户端
      this.client = createClient(config.url, config.anonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });

      // 测试连接
      const { error: testError } = await this.client
        .from(SYNC_TABLES.COFFEE_BEANS)
        .select('id')
        .limit(1);

      if (
        testError &&
        testError.code !== 'PGRST116' &&
        testError.code !== '42P01'
      ) {
        throw new Error(`连接测试失败: ${testError.message}`);
      }

      // 建立 Realtime 订阅
      await this.setupRealtimeSubscription();

      // 设置本地变更监听
      this.setupLocalChangeListeners();

      this.setState({ connectionStatus: 'connected' });
      console.log('[RealtimeSync] 连接成功');

      // 执行初始同步
      await this.performInitialSync();

      // 处理离线队列
      if (config.enableOfflineQueue !== false) {
        await this.processOfflineQueue();
      }

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接失败';
      console.error('[RealtimeSync] 连接失败:', message);
      this.setState({ connectionStatus: 'error', error: message });
      return false;
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

    // 监听连接状态
    this.channel.subscribe(status => {
      console.log(`[RealtimeSync] Channel 状态: ${status}`);
      if (status === 'SUBSCRIBED') {
        this.setState({ connectionStatus: 'connected' });
      } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
        this.setState({ connectionStatus: 'disconnected' });
      }
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

      this.setState({ lastSyncTime: Date.now() });
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

          this.setState({ lastSyncTime: Date.now() });
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
   * 同步设置到云端
   */
  private async syncSettings(): Promise<void> {
    if (!this.client) return;

    try {
      const result = await uploadSettingsData(this.client);
      if (result.success) {
        console.log('[RealtimeSync] 设置已上传到云端');
        this.setState({ lastSyncTime: Date.now() });
      } else {
        console.error('[RealtimeSync] 设置上传失败:', result.error);
      }
    } catch (error) {
      console.error('[RealtimeSync] 设置同步失败:', error);
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

        await upsertRecords(
          this.client,
          table,
          [{ id: recordId, ...(data as object) }],
          mapFn
        );
        console.log(`[RealtimeSync] 已同步更新: ${table}/${recordId}`);
      }

      this.setState({ lastSyncTime: Date.now() });
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
   * 执行初始同步（双向合并）
   */
  private async performInitialSync(): Promise<void> {
    if (!this.client) return;

    console.log('[RealtimeSync] 开始初始同步...');
    this.setState({ isInitialSyncing: true });

    try {
      // 同步咖啡豆
      await this.syncTableGeneric(
        SYNC_TABLES.COFFEE_BEANS,
        async () => db.coffeeBeans.toArray(),
        async (items: CoffeeBean[]) => {
          await db.coffeeBeans.bulkPut(items);
        },
        (bean: CoffeeBean) => ({
          id: bean.id,
          data: bean,
          updated_at: new Date(bean.timestamp || Date.now()).toISOString(),
        })
      );

      // 同步冲煮记录
      await this.syncTableGeneric(
        SYNC_TABLES.BREWING_NOTES,
        async () => db.brewingNotes.toArray(),
        async (items: BrewingNote[]) => {
          await db.brewingNotes.bulkPut(items);
        },
        (note: BrewingNote) => ({
          id: note.id,
          data: note,
          updated_at: new Date(note.timestamp || Date.now()).toISOString(),
        })
      );

      // 同步自定义器具
      await this.syncTableGeneric(
        SYNC_TABLES.CUSTOM_EQUIPMENTS,
        async () => db.customEquipments.toArray(),
        async (items: CustomEquipment[]) => {
          await db.customEquipments.bulkPut(items);
        },
        (equip: CustomEquipment) => ({
          id: equip.id,
          data: equip,
          updated_at: new Date().toISOString(),
        })
      );

      // 同步自定义方案
      type MethodRecord = { equipmentId: string; methods: Method[] };
      await this.syncTableGeneric<MethodRecord & { id: string }>(
        SYNC_TABLES.CUSTOM_METHODS,
        async () => {
          const records = await db.customMethods.toArray();
          // id 就是 equipmentId
          return records.map(r => ({ ...r, id: r.equipmentId }));
        },
        async items => {
          const methodRecords = items.map(
            ({ id, ...rest }) => rest as unknown as MethodRecord
          );
          await db.customMethods.bulkPut(methodRecords);
        },
        method => ({
          id: method.id, // id = equipmentId
          data: { equipmentId: method.equipmentId, methods: method.methods },
          updated_at: new Date().toISOString(),
        })
      );

      // 同步设置（上传本地设置到云端）
      console.log('[RealtimeSync] 同步设置...');
      await this.syncSettings();

      // 刷新所有 Store 以反映最新数据
      await this.refreshAllStores();

      this.setState({ lastSyncTime: Date.now(), isInitialSyncing: false });
      console.log('[RealtimeSync] 初始同步完成');
    } catch (error) {
      console.error('[RealtimeSync] 初始同步失败:', error);
      this.setState({ isInitialSyncing: false });
    }
  }

  /**
   * 刷新所有 Zustand Store（从 IndexedDB 重新加载数据）
   */
  private async refreshAllStores(): Promise<void> {
    try {
      // 刷新咖啡豆 Store
      const { useCoffeeBeanStore } = await import(
        '@/lib/stores/coffeeBeanStore'
      );
      const beans = await db.coffeeBeans.toArray();
      useCoffeeBeanStore.setState({ beans });
      console.log(`[RealtimeSync] 刷新 coffeeBeans Store: ${beans.length} 条`);

      // 刷新冲煮记录 Store
      const { useBrewingNoteStore } = await import(
        '@/lib/stores/brewingNoteStore'
      );
      const notes = await db.brewingNotes.toArray();
      useBrewingNoteStore.setState({ notes });
      console.log(`[RealtimeSync] 刷新 brewingNotes Store: ${notes.length} 条`);

      // 刷新自定义器具 Store
      const { useCustomEquipmentStore } = await import(
        '@/lib/stores/customEquipmentStore'
      );
      const equipments = await db.customEquipments.toArray();
      useCustomEquipmentStore.setState({ equipments });
      console.log(
        `[RealtimeSync] 刷新 customEquipments Store: ${equipments.length} 条`
      );

      // 刷新自定义方案 Store
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
      console.log(
        `[RealtimeSync] 刷新 customMethods Store: ${methodsData.length} 条`
      );

      // 刷新设置 Store
      const { useSettingsStore } = await import('@/lib/stores/settingsStore');
      await useSettingsStore.getState().loadSettings();
      console.log('[RealtimeSync] 刷新 settings Store');
    } catch (error) {
      console.error('[RealtimeSync] 刷新 Store 失败:', error);
    }
  }

  /**
   * 通用表同步方法（双向合并）
   */
  private async syncTableGeneric<T extends { id: string; timestamp?: number }>(
    tableName: RealtimeSyncTable,
    getLocalRecords: () => Promise<T[]>,
    saveLocalRecords: (items: T[]) => Promise<void>,
    mapFn: (record: T) => Record<string, unknown>
  ): Promise<void> {
    if (!this.client) return;

    try {
      // 获取本地数据
      const localRecords = await getLocalRecords();

      // 获取云端数据
      const { data: remoteData, error } = await this.client
        .from(tableName)
        .select('*')
        .eq('user_id', DEFAULT_USER_ID)
        .is('deleted_at', null);

      if (error) {
        console.error(`[RealtimeSync] 获取 ${tableName} 云端数据失败:`, error);
        return;
      }

      const remoteRecords = (remoteData || []) as CloudRecord<T>[];

      // 批量冲突解决
      const { toUpload, toDownload } = batchResolveConflicts(
        localRecords,
        remoteRecords
      );

      console.log(
        `[RealtimeSync] ${tableName} 同步: 本地 ${localRecords.length}, 云端 ${remoteRecords.length}, 上传 ${toUpload.length}, 下载 ${toDownload.length}`
      );

      // 上传本地更新
      if (toUpload.length > 0) {
        await upsertRecords(this.client, tableName, toUpload, mapFn);
      }

      // 下载云端更新
      if (toDownload.length > 0) {
        await saveLocalRecords(toDownload);
      }
    } catch (error) {
      console.error(`[RealtimeSync] 同步 ${tableName} 失败:`, error);
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
