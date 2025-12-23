'use client';

import { Capacitor } from '@capacitor/core';
import { SafeArea, initialize } from '@capacitor-community/safe-area';

/**
 * 安全区域管理工具
 * 统一管理所有平台的安全区域逻辑
 */
export const SafeAreaManager = {
  // 存储 settingsStore 取消订阅函数
  _unsubscribe: null as (() => void) | null,

  /**
   * 初始化安全区域
   */
  async initialize(): Promise<void> {
    try {
      // 初始化插件的 CSS 变量（移动端需要）
      initialize();

      // 加载用户设置并应用安全区域变量
      await this.loadAndApplySettings();

      // 订阅 settingsStore 的 safeAreaMargins 变化
      this.subscribeToSettingsStore();

      // 如果是原生平台，启用插件
      if (Capacitor.isNativePlatform()) {
        await SafeArea.enable({
          config: {
            customColorsForSystemBars: true,
            statusBarColor: '#00000000',
            statusBarContent: 'light',
            navigationBarColor: '#00000000',
            navigationBarContent: 'light',
            offset: 0,
          },
        });

        // 监听原生安全区域变化（屏幕旋转等）
        this.watchNativeSafeAreaChanges();
      }

      console.warn('SafeArea initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SafeArea:', error);
    }
  },

  /**
   * 订阅 settingsStore 的安全区域边距变化
   */
  subscribeToSettingsStore(): void {
    // 动态导入以避免循环依赖
    import('@/lib/stores/settingsStore').then(({ useSettingsStore }) => {
      // 取消之前的订阅
      if (this._unsubscribe) {
        this._unsubscribe();
      }

      // 订阅 safeAreaMargins 变化
      this._unsubscribe = useSettingsStore.subscribe(
        state => state.settings.safeAreaMargins,
        margins => {
          console.log('[SafeArea] safeAreaMargins changed:', margins);
          if (margins) {
            this.setupSafeAreaVariables(margins);
          } else {
            this.setupSafeAreaVariables();
          }
        }
      );
    });
  },

  /**
   * 设置安全区域 CSS 变量
   * 移动端：原生安全区域 + 用户自定义边距
   * Tauri 桌面端：标题栏高度 + 用户自定义边距
   * 网页版：用户自定义边距
   */
  setupSafeAreaVariables(customMargins?: {
    top: number;
    bottom: number;
  }): void {
    const root = document.documentElement;

    // 默认边距
    const defaultMargins = { top: 42, bottom: 42 };
    const margins = customMargins || defaultMargins;

    // 固定的左右边距
    const horizontalMargin = 12;

    // 检测是否在 Tauri 环境中（桌面端）
    const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;
    // 检测是否是中等屏幕以上（md: 768px）
    const isMediumScreen =
      typeof window !== 'undefined' && window.innerWidth >= 768;

    if (Capacitor.isNativePlatform()) {
      // 移动端：原生安全区域 + 用户自定义边距
      root.style.setProperty(
        '--safe-area-top',
        `calc(var(--safe-area-inset-top, 0px) + ${margins.top}px)`
      );
      root.style.setProperty(
        '--safe-area-bottom',
        `calc(var(--safe-area-inset-bottom, 0px) + ${margins.bottom}px)`
      );
      root.style.setProperty(
        '--safe-area-left',
        `calc(var(--safe-area-inset-left, 0px) + ${horizontalMargin}px)`
      );
      root.style.setProperty(
        '--safe-area-right',
        `calc(var(--safe-area-inset-right, 0px) + ${horizontalMargin}px)`
      );
    } else if (isTauri && isMediumScreen) {
      // Tauri 桌面端（md 及以上）：标题栏高度 + 用户自定义边距
      // macOS Overlay 标题栏高度约 28px
      const titlebarHeight = 28;
      root.style.setProperty(
        '--safe-area-top',
        `${titlebarHeight + margins.top}px`
      );
      root.style.setProperty('--safe-area-bottom', `${margins.bottom}px`);
      root.style.setProperty('--safe-area-left', `${horizontalMargin}px`);
      root.style.setProperty('--safe-area-right', `${horizontalMargin}px`);
    } else {
      // 网页版：用户自定义边距
      root.style.setProperty('--safe-area-top', `${margins.top}px`);
      root.style.setProperty('--safe-area-bottom', `${margins.bottom}px`);
      root.style.setProperty('--safe-area-left', `${horizontalMargin}px`);
      root.style.setProperty('--safe-area-right', `${horizontalMargin}px`);
    }
  },

  /**
   * 监听原生安全区域变化（仅屏幕方向变化）
   */
  watchNativeSafeAreaChanges(): void {
    // 监听方向变化
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        // 重新应用当前的安全区域设置
        this.loadAndApplySettings();
      }, 300);
    });
    // 注意：设置变化现在通过 subscribeToSettingsStore() 处理
  },

  /**
   * 从存储中加载设置并应用安全区域边距
   */
  async loadAndApplySettings(): Promise<void> {
    try {
      // 使用 settingsStore 获取设置
      const { getSettingsStore } = await import('@/lib/stores/settingsStore');
      const settings = getSettingsStore().settings;

      if (settings.safeAreaMargins) {
        this.setupSafeAreaVariables(settings.safeAreaMargins);
      } else {
        this.setupSafeAreaVariables();
      }
    } catch (error) {
      console.error('Failed to load safe area settings:', error);
      this.setupSafeAreaVariables();
    }
  },

  /**
   * 更新安全区域边距
   */
  updateMargins(margins: { top: number; bottom: number }): void {
    this.setupSafeAreaVariables(margins);
  },

  /**
   * 动态更新安全区域配置
   * @param config 配置选项
   */
  async updateConfig(config: {
    statusBarColor?: string;
    statusBarContent?: 'light' | 'dark';
    navigationBarColor?: string;
    navigationBarContent?: 'light' | 'dark';
  }): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await SafeArea.enable({
          config: {
            customColorsForSystemBars: true,
            statusBarColor: config.statusBarColor || '#00000000',
            statusBarContent: config.statusBarContent || 'light',
            navigationBarColor: config.navigationBarColor || '#00000000',
            navigationBarContent: config.navigationBarContent || 'light',
            offset: 0,
          },
        });
      }
    } catch (error) {
      console.error('Failed to update SafeArea config:', error);
    }
  },
};
