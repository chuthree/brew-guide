/**
 * Supabase 客户端封装
 * 提供数据库操作和实时订阅功能
 */

import {
  createClient,
  SupabaseClient,
  RealtimeChannel,
} from '@supabase/supabase-js';
import type {
  SupabaseConfig,
  SupabaseTableName,
  SupabaseCoffeeBean,
  SupabaseBrewingNote,
  SupabaseCustomEquipment,
  SupabaseCustomMethod,
  RealtimePayload,
  RealtimeConnectionStatus,
} from './types';

/**
 * Supabase 客户端类
 * 封装所有与 Supabase 的交互
 */
export class SupabaseClientWrapper {
  private client: SupabaseClient | null = null;
  private config: SupabaseConfig | null = null;
  private realtimeChannel: RealtimeChannel | null = null;
  private realtimeStatus: RealtimeConnectionStatus = 'disconnected';
  private realtimeCallbacks: Map<
    SupabaseTableName,
    ((payload: RealtimePayload) => void)[]
  > = new Map();

  /**
   * 初始化 Supabase 客户端
   */
  initialize(config: SupabaseConfig): boolean {
    try {
      if (!config.url || !config.anonKey) {
        console.error('❌ [Supabase] 配置不完整：缺少 URL 或 anonKey');
        return false;
      }

      this.config = config;
      this.client = createClient(config.url, config.anonKey, {
        auth: {
          persistSession: false, // 不持久化会话，因为我们使用自定义用户标识
          autoRefreshToken: false,
        },
        realtime: {
          params: {
            eventsPerSecond: 10,
          },
        },
      });

      console.log('✅ [Supabase] 客户端初始化成功');
      return true;
    } catch (error) {
      console.error('❌ [Supabase] 客户端初始化失败:', error);
      return false;
    }
  }

  /**
   * 获取 Supabase 客户端实例
   */
  getClient(): SupabaseClient | null {
    return this.client;
  }

  /**
   * 获取用户 ID
   */
  getUserId(): string {
    return this.config?.userId || 'anonymous';
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.client) {
      console.error('❌ [Supabase] 客户端未初始化');
      return false;
    }

    try {
      // 尝试查询 coffee_beans 表来测试连接
      const { error } = await this.client
        .from('coffee_beans')
        .select('id')
        .limit(1);

      if (error) {
        // 如果是表不存在的错误，说明连接成功但表未创建
        if (error.code === '42P01') {
          console.warn('⚠️ [Supabase] 连接成功，但数据表尚未创建');
          return true;
        }
        console.error('❌ [Supabase] 连接测试失败:', error.message);
        return false;
      }

      console.log('✅ [Supabase] 连接测试成功');
      return true;
    } catch (error) {
      console.error('❌ [Supabase] 连接测试异常:', error);
      return false;
    }
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopRealtime();
    this.client = null;
    this.config = null;
    console.log('🔌 [Supabase] 已断开连接');
  }

  // ==================== 数据操作方法 ====================

  /**
   * 获取所有咖啡豆
   */
  async getCoffeeBeans(userId: string): Promise<SupabaseCoffeeBean[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('coffee_beans')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [Supabase] 获取咖啡豆失败:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 获取指定时间之后更新的咖啡豆
   */
  async getCoffeeBeansUpdatedSince(
    userId: string,
    since: number
  ): Promise<SupabaseCoffeeBean[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('coffee_beans')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', new Date(since).toISOString())
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [Supabase] 获取更新的咖啡豆失败:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 上传/更新咖啡豆
   */
  async upsertCoffeeBean(
    userId: string,
    bean: SupabaseCoffeeBean['data'],
    version: number = 1
  ): Promise<SupabaseCoffeeBean | null> {
    if (!this.client) return null;

    const record = {
      id: bean.id,
      user_id: userId,
      data: bean,
      updated_at: new Date().toISOString(),
      version,
    };

    const { data, error } = await this.client
      .from('coffee_beans')
      .upsert(record, {
        onConflict: 'id,user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [Supabase] 上传咖啡豆失败:', error);
      return null;
    }

    return data;
  }

  /**
   * 批量上传咖啡豆
   */
  async upsertCoffeeBeans(
    userId: string,
    beans: SupabaseCoffeeBean['data'][]
  ): Promise<number> {
    if (!this.client || beans.length === 0) return 0;

    const records = beans.map(bean => ({
      id: bean.id,
      user_id: userId,
      data: bean,
      updated_at: new Date().toISOString(),
      version: 1,
    }));

    const { error } = await this.client.from('coffee_beans').upsert(records, {
      onConflict: 'id,user_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error('❌ [Supabase] 批量上传咖啡豆失败:', error);
      return 0;
    }

    return beans.length;
  }

  /**
   * 软删除咖啡豆
   */
  async deleteCoffeeBean(userId: string, beanId: string): Promise<boolean> {
    if (!this.client) return false;

    const { error } = await this.client
      .from('coffee_beans')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', beanId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Supabase] 删除咖啡豆失败:', error);
      return false;
    }

    return true;
  }

  /**
   * 获取所有冲煮笔记
   */
  async getBrewingNotes(userId: string): Promise<SupabaseBrewingNote[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('brewing_notes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [Supabase] 获取冲煮笔记失败:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 获取指定时间之后更新的冲煮笔记
   */
  async getBrewingNotesUpdatedSince(
    userId: string,
    since: number
  ): Promise<SupabaseBrewingNote[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('brewing_notes')
      .select('*')
      .eq('user_id', userId)
      .gte('updated_at', new Date(since).toISOString())
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ [Supabase] 获取更新的冲煮笔记失败:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 上传/更新冲煮笔记
   */
  async upsertBrewingNote(
    userId: string,
    note: SupabaseBrewingNote['data'],
    version: number = 1
  ): Promise<SupabaseBrewingNote | null> {
    if (!this.client) return null;

    const record = {
      id: note.id,
      user_id: userId,
      data: note,
      updated_at: new Date().toISOString(),
      version,
    };

    const { data, error } = await this.client
      .from('brewing_notes')
      .upsert(record, {
        onConflict: 'id,user_id',
        ignoreDuplicates: false,
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [Supabase] 上传冲煮笔记失败:', error);
      return null;
    }

    return data;
  }

  /**
   * 批量上传冲煮笔记
   */
  async upsertBrewingNotes(
    userId: string,
    notes: SupabaseBrewingNote['data'][]
  ): Promise<number> {
    if (!this.client || notes.length === 0) return 0;

    const records = notes.map(note => ({
      id: note.id,
      user_id: userId,
      data: note,
      updated_at: new Date().toISOString(),
      version: 1,
    }));

    const { error } = await this.client.from('brewing_notes').upsert(records, {
      onConflict: 'id,user_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error('❌ [Supabase] 批量上传冲煮笔记失败:', error);
      return 0;
    }

    return notes.length;
  }

  /**
   * 软删除冲煮笔记
   */
  async deleteBrewingNote(userId: string, noteId: string): Promise<boolean> {
    if (!this.client) return false;

    const { error } = await this.client
      .from('brewing_notes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [Supabase] 删除冲煮笔记失败:', error);
      return false;
    }

    return true;
  }

  /**
   * 获取所有自定义器具
   */
  async getCustomEquipments(
    userId: string
  ): Promise<SupabaseCustomEquipment[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('custom_equipments')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      console.error('❌ [Supabase] 获取自定义器具失败:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 批量上传自定义器具
   */
  async upsertCustomEquipments(
    userId: string,
    equipments: SupabaseCustomEquipment['data'][]
  ): Promise<number> {
    if (!this.client || equipments.length === 0) return 0;

    const records = equipments.map(equipment => ({
      id: equipment.id,
      user_id: userId,
      data: equipment,
      updated_at: new Date().toISOString(),
      version: 1,
    }));

    const { error } = await this.client
      .from('custom_equipments')
      .upsert(records, {
        onConflict: 'id,user_id',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('❌ [Supabase] 批量上传自定义器具失败:', error);
      return 0;
    }

    return equipments.length;
  }

  /**
   * 获取所有自定义方案
   */
  async getCustomMethods(userId: string): Promise<SupabaseCustomMethod[]> {
    if (!this.client) return [];

    const { data, error } = await this.client
      .from('custom_methods')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      console.error('❌ [Supabase] 获取自定义方案失败:', error);
      return [];
    }

    return data || [];
  }

  /**
   * 批量上传自定义方案
   */
  async upsertCustomMethods(
    userId: string,
    methods: SupabaseCustomMethod['data'][]
  ): Promise<number> {
    if (!this.client || methods.length === 0) return 0;

    const records = methods.map(method => ({
      id: method.equipmentId,
      user_id: userId,
      equipment_id: method.equipmentId,
      data: method,
      updated_at: new Date().toISOString(),
      version: 1,
    }));

    const { error } = await this.client.from('custom_methods').upsert(records, {
      onConflict: 'id,user_id',
      ignoreDuplicates: false,
    });

    if (error) {
      console.error('❌ [Supabase] 批量上传自定义方案失败:', error);
      return 0;
    }

    return methods.length;
  }

  // ==================== 实时订阅方法 ====================

  /**
   * 启动实时订阅
   */
  async startRealtime(userId: string): Promise<boolean> {
    if (!this.client) {
      console.error('❌ [Supabase] 客户端未初始化，无法启动实时订阅');
      return false;
    }

    if (this.realtimeChannel) {
      console.log('⚠️ [Supabase] 实时订阅已存在，先停止旧订阅');
      this.stopRealtime();
    }

    try {
      this.realtimeStatus = 'connecting';

      // 创建实时频道，订阅所有数据表的变更
      this.realtimeChannel = this.client
        .channel(`brew-guide-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'coffee_beans',
            filter: `user_id=eq.${userId}`,
          },
          payload => this.handleRealtimeEvent('coffee_beans', payload)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'brewing_notes',
            filter: `user_id=eq.${userId}`,
          },
          payload => this.handleRealtimeEvent('brewing_notes', payload)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'custom_equipments',
            filter: `user_id=eq.${userId}`,
          },
          payload => this.handleRealtimeEvent('custom_equipments', payload)
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'custom_methods',
            filter: `user_id=eq.${userId}`,
          },
          payload => this.handleRealtimeEvent('custom_methods', payload)
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            this.realtimeStatus = 'connected';
            console.log('✅ [Supabase] 实时订阅已连接');
          } else if (status === 'CHANNEL_ERROR') {
            this.realtimeStatus = 'error';
            console.error('❌ [Supabase] 实时订阅错误');
          } else if (status === 'TIMED_OUT') {
            this.realtimeStatus = 'reconnecting';
            console.warn('⚠️ [Supabase] 实时订阅超时，正在重连');
          }
        });

      return true;
    } catch (error) {
      console.error('❌ [Supabase] 启动实时订阅失败:', error);
      this.realtimeStatus = 'error';
      return false;
    }
  }

  /**
   * 停止实时订阅
   */
  stopRealtime(): void {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
      this.realtimeChannel = null;
    }
    this.realtimeStatus = 'disconnected';
    console.log('🔌 [Supabase] 实时订阅已停止');
  }

  /**
   * 获取实时连接状态
   */
  getRealtimeStatus(): RealtimeConnectionStatus {
    return this.realtimeStatus;
  }

  /**
   * 注册实时事件回调
   */
  onRealtimeEvent(
    table: SupabaseTableName,
    callback: (payload: RealtimePayload) => void
  ): () => void {
    const callbacks = this.realtimeCallbacks.get(table) || [];
    callbacks.push(callback);
    this.realtimeCallbacks.set(table, callbacks);

    // 返回取消注册的函数
    return () => {
      const cbs = this.realtimeCallbacks.get(table) || [];
      const index = cbs.indexOf(callback);
      if (index > -1) {
        cbs.splice(index, 1);
        this.realtimeCallbacks.set(table, cbs);
      }
    };
  }

  /**
   * 处理实时事件
   */
  private handleRealtimeEvent(
    table: SupabaseTableName,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload: any
  ): void {
    console.log(`📡 [Supabase] 收到实时事件 [${table}]:`, payload.eventType);

    const realtimePayload: RealtimePayload = {
      eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
      table,
      new: payload.new,
      old: payload.old,
      commit_timestamp: payload.commit_timestamp,
    };

    // 触发所有注册的回调
    const callbacks = this.realtimeCallbacks.get(table) || [];
    callbacks.forEach(callback => {
      try {
        callback(realtimePayload);
      } catch (error) {
        console.error(`❌ [Supabase] 实时事件回调执行失败:`, error);
      }
    });
  }
}

// 导出单例
export const supabaseClient = new SupabaseClientWrapper();
