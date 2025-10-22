'use client';

import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import SafeAreaManager from './safeArea';

export const isNative = () => {
  return Capacitor.isNativePlatform();
};

export const getPlatform = () => {
  return Capacitor.getPlatform();
};

export const initCapacitor = async (): Promise<void> => {
  try {
    // 初始化安全区域（在所有平台上都需要）
    await SafeAreaManager.initialize();

    if (isNative()) {
      // 隐藏启动屏幕
      await SplashScreen.hide();

      // 处理状态栏
      const platform = getPlatform();
      if (platform === 'android' || platform === 'ios') {
        try {
          // 设置状态栏样式
          const prefersDark = window.matchMedia(
            '(prefers-color-scheme: dark)'
          ).matches;
          await StatusBar.setStyle({
            style: prefersDark ? Style.Dark : Style.Light,
          });

          // 设置状态栏覆盖
          await StatusBar.setOverlaysWebView({ overlay: true });
          await StatusBar.show();

          // 添加平台标识，用于 Tailwind 的数据属性选择器
          document.documentElement.setAttribute('data-platform', platform);
        } catch (error) {
          console.error('Capacitor状态栏初始化失败:', error);
        }
      }

      // 监听系统深色模式变化
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', async e => {
          try {
            await StatusBar.setStyle({
              style: e.matches ? Style.Dark : Style.Light,
            });

            // 同时更新安全区域的状态栏内容颜色
            await SafeAreaManager.updateConfig({
              statusBarContent: e.matches ? 'light' : 'dark',
              navigationBarContent: e.matches ? 'light' : 'dark',
            });
          } catch (error) {
            console.error('状态栏设置失败:', error);
          }
        });
    }
  } catch (e) {
    console.error('Capacitor initialization error:', e);
  }
};

const capacitorUtils = {
  isNative,
  getPlatform,
  initCapacitor,
};

export default capacitorUtils;
