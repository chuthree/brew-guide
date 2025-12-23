'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTraySync } from '@/lib/hooks/useTraySync';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';
import { getRealtimeSyncService } from '@/lib/supabase/realtime';
import { useSettingsStore } from '@/lib/stores/settingsStore';

// 检查是否在 Tauri 环境中
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI__' in window;
};

/**
 * 存储系统初始化组件
 * 在应用启动时初始化IndexedDB和其他存储系统
 */
export default function StorageInit() {
  const [initialized, setInitialized] = useState(false);
  const beans = useCoffeeBeanStore(state => state.beans);

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

  useEffect(() => {
    async function initStorage() {
      if (!initialized && typeof window !== 'undefined') {
        const syncStatusStore = useSyncStatusStore.getState();

        try {
          // 动态导入存储模块，避免服务端渲染问题
          const { Storage } = await import('@/lib/core/storage');
          await Storage.initialize();

          // 始终从本地 IndexedDB 加载数据（安全第一，不自动同步云端）
          console.log('[StorageProvider] 从本地 IndexedDB 加载数据...');
          try {
            const { useBrewingNoteStore } = await import(
              '@/lib/stores/brewingNoteStore'
            );
            await useBrewingNoteStore.getState().loadNotes();
          } catch (e) {
            console.error('加载笔记失败:', e);
          }

          try {
            const { useCoffeeBeanStore } = await import(
              '@/lib/stores/coffeeBeanStore'
            );
            await useCoffeeBeanStore.getState().loadBeans();
          } catch (e) {
            console.error('加载咖啡豆失败:', e);
          }

          // 检查 Supabase 配置（仅记录状态，不自动同步）
          try {
            const { useSettingsStore: getStore } = await import(
              '@/lib/stores/settingsStore'
            );
            const storeSettings = getStore.getState().settings;
            if (storeSettings) {
              const supabaseSettings = storeSettings.supabaseSync;
              const activeSyncType = storeSettings.activeSyncType;

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
                  syncStatusStore.setPendingChangesCount(
                    state.pendingChangesCount
                  );
                  if (state.lastSyncTime) {
                    syncStatusStore.setStatus('success');
                  }
                });

                // 连接实时同步
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
                console.log(
                  '[StorageProvider] Supabase 已配置，等待用户手动同步'
                );
              }
            }
          } catch (supabaseError) {
            console.debug('检查 Supabase 配置失败:', supabaseError);
          }

          // 清理过期临时文件
          try {
            const { TempFileManager } = await import(
              '@/lib/utils/tempFileManager'
            );
            await TempFileManager.cleanupExpiredTempFiles();
          } catch (cleanupError) {
            console.debug('清理临时文件失败:', cleanupError);
          }

          setInitialized(true);
        } catch (error) {
          console.error('存储系统初始化失败:', error);
        }
      }
    }

    initStorage();
  }, [initialized]);

  // 这个组件不会渲染任何内容，它只是初始化存储系统
  return null;
}
