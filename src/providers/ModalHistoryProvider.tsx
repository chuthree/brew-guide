'use client';

import { useEffect } from 'react';
import { modalHistory } from '@/lib/navigation/modalHistory';

/**
 * 模态框历史栈管理器初始化组件
 *
 * 在应用启动时初始化全局 popstate 监听器
 */
export default function ModalHistoryInit() {
  useEffect(() => {
    // 初始化历史栈管理器
    modalHistory.init();

    // 页面刷新或关闭时清空栈
    const handleBeforeUnload = () => {
      modalHistory.clear();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return null;
}
