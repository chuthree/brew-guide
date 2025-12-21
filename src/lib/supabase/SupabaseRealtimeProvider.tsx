/**
 * Supabase 实时同步 Provider
 * 在应用启动时自动建立实时连接，监听数据变更
 */

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
} from 'react';
import { supabaseSyncManager } from '@/lib/supabase/syncManager';
import { db } from '@/lib/core/db';
import type {
  RealtimeConnectionStatus,
  SupabaseSyncSettings,
} from '@/lib/supabase/types';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';

interface SupabaseRealtimeContextValue {
  /** 实时连接状态 */
  realtimeStatus: RealtimeConnectionStatus;
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 手动触发同步 */
  triggerSync: () => Promise<void>;
  /** 推送单条数据变更 */
  pushDataChange: (
    type: 'coffee_beans' | 'brewing_notes',
    data: CoffeeBean | BrewingNote,
    action: 'create' | 'update' | 'delete'
  ) => void;
}

const SupabaseRealtimeContext =
  createContext<SupabaseRealtimeContextValue | null>(null);

interface SupabaseRealtimeProviderProps {
  children: React.ReactNode;
  settings: SupabaseSyncSettings | null | undefined;
}

export const SupabaseRealtimeProvider: React.FC<
  SupabaseRealtimeProviderProps
> = ({ children, settings }) => {
  const [realtimeStatus, setRealtimeStatus] =
    useState<RealtimeConnectionStatus>('disconnected');
  const [isInitialized, setIsInitialized] = useState(false);
  const initializingRef = useRef(false);
  const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 初始化 Supabase 连接
  useEffect(() => {
    if (!settings?.enabled || !settings.url || !settings.anonKey) {
      // 如果禁用，断开连接
      if (isInitialized) {
        supabaseSyncManager.disconnect();
        setIsInitialized(false);
        setRealtimeStatus('disconnected');
      }
      return;
    }

    if (initializingRef.current) return;

    const initialize = async () => {
      initializingRef.current = true;
      try {
        console.log('🚀 [SupabaseRealtime] 开始初始化...');

        const success = await supabaseSyncManager.initialize({
          url: settings.url,
          anonKey: settings.anonKey,
        });

        if (success) {
          setIsInitialized(true);

          // 如果启用了实时同步，自动开启
          if (settings.realtimeEnabled) {
            await supabaseSyncManager.startRealtime();
            setRealtimeStatus(supabaseSyncManager.getRealtimeStatus());
          }

          console.log('✅ [SupabaseRealtime] 初始化完成');
        }
      } catch (error) {
        console.error('❌ [SupabaseRealtime] 初始化失败:', error);
      } finally {
        initializingRef.current = false;
      }
    };

    initialize();

    // 清理函数
    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [
    settings?.enabled,
    settings?.url,
    settings?.anonKey,
    settings?.realtimeEnabled,
    isInitialized,
  ]);

  // 监控实时连接状态
  useEffect(() => {
    if (!isInitialized || !settings?.realtimeEnabled) return;

    statusIntervalRef.current = setInterval(() => {
      setRealtimeStatus(supabaseSyncManager.getRealtimeStatus());
    }, 3000);

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
      }
    };
  }, [isInitialized, settings?.realtimeEnabled]);

  // 监听 Supabase 数据变更事件，刷新本地 store
  useEffect(() => {
    const handleDataChange = (event: CustomEvent<{ table: string }>) => {
      const { table } = event.detail;
      console.log(`📡 [SupabaseRealtime] 收到数据变更通知: ${table}`);

      // 触发对应 store 的刷新
      if (table === 'coffee_beans') {
        window.dispatchEvent(new CustomEvent('refreshCoffeeBeans'));
      } else if (table === 'brewing_notes') {
        window.dispatchEvent(new CustomEvent('refreshBrewingNotes'));
      }
    };

    window.addEventListener(
      'supabaseDataChange',
      handleDataChange as EventListener
    );
    return () => {
      window.removeEventListener(
        'supabaseDataChange',
        handleDataChange as EventListener
      );
    };
  }, []);

  // 手动触发同步
  const triggerSync = useCallback(async () => {
    if (!isInitialized) {
      console.warn('⚠️ [SupabaseRealtime] 未初始化，无法同步');
      return;
    }

    await supabaseSyncManager.fullSync();
  }, [isInitialized]);

  // 推送单条数据变更（用于本地数据变更时实时上传）
  const pushDataChange = useCallback(
    (
      type: 'coffee_beans' | 'brewing_notes',
      data: CoffeeBean | BrewingNote,
      action: 'create' | 'update' | 'delete'
    ) => {
      if (!isInitialized || !settings?.realtimeEnabled) return;

      supabaseSyncManager.queueChange({
        type: action,
        table: type,
        id: data.id,
        data: action !== 'delete' ? data : undefined,
        timestamp: Date.now(),
      });
    },
    [isInitialized, settings?.realtimeEnabled]
  );

  const value: SupabaseRealtimeContextValue = {
    realtimeStatus,
    isInitialized,
    triggerSync,
    pushDataChange,
  };

  return (
    <SupabaseRealtimeContext.Provider value={value}>
      {children}
    </SupabaseRealtimeContext.Provider>
  );
};

/**
 * Hook: 使用 Supabase 实时同步功能
 */
export const useSupabaseRealtime = () => {
  const context = useContext(SupabaseRealtimeContext);
  if (!context) {
    // 如果不在 Provider 内，返回默认值（降级处理）
    return {
      realtimeStatus: 'disconnected' as RealtimeConnectionStatus,
      isInitialized: false,
      triggerSync: async () => {},
      pushDataChange: () => {},
    };
  }
  return context;
};

/**
 * Hook: 监听数据变更并自动推送到 Supabase
 * 用于在 Store 中集成
 */
export const useSupabaseAutoSync = () => {
  const { pushDataChange, isInitialized } = useSupabaseRealtime();

  const onCoffeeBeanChange = useCallback(
    (bean: CoffeeBean, action: 'create' | 'update' | 'delete') => {
      if (isInitialized) {
        pushDataChange('coffee_beans', bean, action);
      }
    },
    [pushDataChange, isInitialized]
  );

  const onBrewingNoteChange = useCallback(
    (note: BrewingNote, action: 'create' | 'update' | 'delete') => {
      if (isInitialized) {
        pushDataChange('brewing_notes', note, action);
      }
    },
    [pushDataChange, isInitialized]
  );

  return {
    onCoffeeBeanChange,
    onBrewingNoteChange,
  };
};
