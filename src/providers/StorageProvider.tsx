'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTraySync } from '@/lib/hooks/useTraySync';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';

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
        try {
          // 动态导入存储模块，避免服务端渲染问题
          const { Storage } = await import('@/lib/core/storage');
          await Storage.initialize();

          // 🔥 关键修复：初始化 Zustand store，提前加载笔记数据
          try {
            const { useBrewingNoteStore } = await import(
              '@/lib/stores/brewingNoteStore'
            );
            // 应用启动时立即加载笔记数据到内存
            await useBrewingNoteStore.getState().loadNotes();
            console.warn('✅ 笔记数据已预加载到内存');
          } catch (storeError) {
            console.error('⚠️ 预加载笔记数据失败:', storeError);
            // 不阻止应用启动
          }

          // 加载咖啡豆数据（用于菜单栏同步）
          try {
            const { useCoffeeBeanStore } = await import(
              '@/lib/stores/coffeeBeanStore'
            );
            await useCoffeeBeanStore.getState().loadBeans();
            console.warn('✅ 咖啡豆数据已预加载');
          } catch (beanError) {
            console.error('⚠️ 预加载咖啡豆数据失败:', beanError);
          }

          // 初始化完成后清理过期的临时文件
          try {
            const { TempFileManager } = await import(
              '@/lib/utils/tempFileManager'
            );
            await TempFileManager.cleanupExpiredTempFiles();
          } catch (tempFileError) {
            console.warn('临时文件清理失败:', tempFileError);
            // 不阻止应用启动
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
