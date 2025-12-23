'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTraySync } from '@/lib/hooks/useTraySync';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import { getRealtimeSyncService } from '@/lib/supabase/realtime';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useDataLayer } from './DataLayerProvider';

// 检查是否在 Tauri 环境中
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * 存储系统初始化组件
 *
 * 优化说明：
 * 1. 依赖 DataLayerProvider 完成数据加载，不再重复加载
 * 2. 专注于 Supabase Realtime 连接的建立
 * 3. Realtime 连接与数据加载并行进行
 */
export default function StorageInit() {
  const [initialized, setInitialized] = useState(false);
  const beans = useCoffeeBeanStore(state => state.beans);
  const { isInitialized: dataLayerReady } = useDataLayer();

  // 处理从菜单栏点击咖啡豆导航
  const handleNavigateToBean = useCallback(
    (beanId: string) => {
      // 从 store 中查找咖啡豆
      const bean = beans.find(b => b.id === beanId);
      if (bean) {
        // 触发咖啡豆详情打开事件
        window.dispatchEvent(
          new CustomEvent('beanDetailOpened', {
            detail: { bean, searchQuery: '' },
          })
        );
      } else {
        console.warn('未找到咖啡豆:', beanId);
      }
    },
    [beans]
  );

  // 同步咖啡豆数据到 Tauri 菜单栏（桌面端）
  useTraySync(handleNavigateToBean);

  // 初始化托盘图标可见性（根据设置）
  const showMenuBarIcon = useSettingsStore(
    state => state.settings.showMenuBarIcon
  );

  useEffect(() => {
    if (!isTauri()) return;

    const initTrayVisibility = async () => {
      try {
        // 如果设置中明确为 false，则隐藏托盘图标
        if (showMenuBarIcon === false) {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('set_tray_visible', { visible: false });
        }
      } catch (error) {
        console.debug('Failed to init tray visibility:', error);
      }
    };

    initTrayVisibility();
  }, [showMenuBarIcon]);

  // 初始化 Supabase Realtime 同步
  useEffect(() => {
    // 等待数据层就绪
    if (!dataLayerReady || initialized) return;

    async function initRealtimeSync() {
      if (typeof window === 'undefined') return;

      const syncStatusStore = useSyncStatusStore.getState();
      const settings = useSettingsStore.getState().settings;

      try {
        // 检查 Supabase 配置
        const supabaseSettings = settings?.supabaseSync;
        const activeSyncType = settings?.activeSyncType;

        if (
          activeSyncType === 'supabase' &&
          supabaseSettings?.enabled &&
          supabaseSettings?.url &&
          supabaseSettings?.anonKey
        ) {
          syncStatusStore.setProvider('supabase');
          syncStatusStore.setRealtimeEnabled(true);

          // 启动实时同步服务
          console.log('[StorageProvider] 启动 Supabase 实时同步...');
          const realtimeService = getRealtimeSyncService();

          // 订阅实时同步状态变更
          realtimeService.subscribe(state => {
            syncStatusStore.setRealtimeStatus(state.connectionStatus);
            syncStatusStore.setPendingChangesCount(state.pendingChangesCount);
            syncStatusStore.setInitialSyncing(state.isInitialSyncing);
            if (state.lastSyncTime) {
              syncStatusStore.setStatus('success');
            }
          });

          // 连接实时同步（现在是非阻塞的）
          const connected = await realtimeService.connect({
            url: supabaseSettings.url,
            anonKey: supabaseSettings.anonKey,
            enableOfflineQueue: true,
          });

          if (connected) {
            console.log('[StorageProvider] Supabase 实时同步已连接');
            syncStatusStore.setStatus('idle');
          } else {
            console.warn('[StorageProvider] Supabase 实时同步连接失败');
            syncStatusStore.setStatus('error');
          }
        } else if (
          supabaseSettings?.enabled &&
          supabaseSettings?.url &&
          supabaseSettings?.anonKey
        ) {
          // Supabase 已配置但不是活动同步类型，设置为手动模式
          syncStatusStore.setProvider('supabase');
          syncStatusStore.setStatus('idle');
          console.log('[StorageProvider] Supabase 已配置，等待用户手动同步');
        }

        // 清理过期临时文件（异步执行，不阻塞）
        import('@/lib/utils/tempFileManager').then(({ TempFileManager }) => {
          TempFileManager.cleanupExpiredTempFiles().catch(e => {
            console.debug('清理临时文件失败:', e);
          });
        });

        setInitialized(true);
      } catch (error) {
        console.error('Realtime 同步初始化失败:', error);
        setInitialized(true); // 即使失败也标记为已初始化，避免重试
      }
    }

    initRealtimeSync();
  }, [dataLayerReady, initialized]);

  // 这个组件不会渲染任何内容，它只是初始化存储系统
  return null;
}
