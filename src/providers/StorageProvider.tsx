'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTraySync } from '@/lib/hooks/useTraySync';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useSyncStatusStore } from '@/lib/stores/syncStatusStore';

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
  useEffect(() => {
    if (!isTauri()) return;

    const initTrayVisibility = async () => {
      try {
        const { Storage } = await import('@/lib/core/storage');
        const settingsStr = await Storage.get('brewGuideSettings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          // 如果设置中明确为 false，则隐藏托盘图标
          if (settings.showMenuBarIcon === false) {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('set_tray_visible', { visible: false });
          }
        }
      } catch (error) {
        console.debug('Failed to init tray visibility:', error);
      }
    };

    initTrayVisibility();
  }, []);

  useEffect(() => {
    async function initStorage() {
      if (!initialized && typeof window !== 'undefined') {
        const syncStatusStore = useSyncStatusStore.getState();

        try {
          // 动态导入存储模块，避免服务端渲染问题
          const { Storage } = await import('@/lib/core/storage');
          await Storage.initialize();

          // 检查是否配置了 Supabase 同步
          let cloudSynced = false;
          try {
            const settingsStr = await Storage.get('brewGuideSettings');
            if (settingsStr) {
              const settings = JSON.parse(settingsStr);
              const supabaseSettings = settings.supabaseSync;

              if (
                supabaseSettings?.enabled &&
                supabaseSettings?.url &&
                supabaseSettings?.anonKey
              ) {
                syncStatusStore.setProvider('supabase');
                syncStatusStore.setSyncing();

                const { simpleSyncService } = await import(
                  '@/lib/supabase/simpleSyncService'
                );

                const initOk = simpleSyncService.initialize({
                  url: supabaseSettings.url,
                  anonKey: supabaseSettings.anonKey,
                });

                if (initOk) {
                  // 测试连接
                  const connected = await simpleSyncService.testConnection();
                  console.log(
                    '[StorageProvider] Supabase 连接测试:',
                    connected
                  );

                  if (connected) {
                    // 关键：每次启动都从云端下载最新数据
                    console.log('[StorageProvider] 从云端下载最新数据...');
                    const result = await simpleSyncService.downloadAllData();
                    console.log('[StorageProvider] 下载结果:', result);

                    // downloadAllData 内部已经更新了 syncStatusStore
                    // 只要下载了数据就算成功同步
                    if (result.downloaded > 0) {
                      cloudSynced = true;
                    }

                    // 启动实时监听
                    if (supabaseSettings.realtimeEnabled) {
                      simpleSyncService.startRealtimeSync();
                      simpleSyncService.startLocalChangeListeners();
                      console.log('[StorageProvider] 实时同步已启动');
                    }
                  } else {
                    syncStatusStore.setSyncError('连接失败');
                  }
                } else {
                  syncStatusStore.setSyncError('初始化失败');
                }
              }
            }
          } catch (supabaseError) {
            console.error('Supabase 初始化失败:', supabaseError);
            syncStatusStore.setSyncError(
              supabaseError instanceof Error
                ? supabaseError.message
                : '同步失败'
            );
          }

          // 如果没有从云端同步成功，则从本地 IndexedDB 加载数据
          if (!cloudSynced) {
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
