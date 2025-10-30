'use client';

import { useEffect, useState } from 'react';

/**
 * 存储系统初始化组件
 * 在应用启动时初始化IndexedDB和其他存储系统
 */
export default function StorageInit() {
  const [initialized, setInitialized] = useState(false);

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
