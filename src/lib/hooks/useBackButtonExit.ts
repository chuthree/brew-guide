'use client';

import { useEffect, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { showExitToast } from '@/components/common/feedback/ExitToast';

/**
 * 自定义 Hook: 处理 Android 设备的双击返回键退出应用
 *
 * 功能：
 * - 第一次按返回键：显示轻量级提示"再按一次退出应用"
 * - 在2秒内再次按返回键：退出应用
 * - 超过2秒后按返回键：重新计时
 *
 * 只在 Android 原生环境下生效
 */
export function useBackButtonExit() {
  const lastBackPressTime = useRef<number>(0);
  const EXIT_INTERVAL = 2000; // 2秒内双击退出

  useEffect(() => {
    // 只在 Android 原生平台启用
    if (
      !Capacitor.isNativePlatform() ||
      Capacitor.getPlatform() !== 'android'
    ) {
      return;
    }

    let listenerHandle: Awaited<
      ReturnType<typeof CapacitorApp.addListener>
    > | null = null;

    const setupListener = async () => {
      listenerHandle = await CapacitorApp.addListener(
        'backButton',
        ({ canGoBack }) => {
          // 如果应用有历史记录可以返回，则执行默认返回操作
          if (canGoBack) {
            window.history.back();
            return;
          }

          // 应用在根页面，需要双击退出
          const currentTime = Date.now();
          const timeSinceLastPress = currentTime - lastBackPressTime.current;

          if (timeSinceLastPress < EXIT_INTERVAL) {
            // 双击退出
            CapacitorApp.exitApp();
          } else {
            // 第一次按返回键，显示轻量级提示
            lastBackPressTime.current = currentTime;
            showExitToast();
          }
        }
      );
    };

    setupListener();

    // 清理监听器
    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);
}
