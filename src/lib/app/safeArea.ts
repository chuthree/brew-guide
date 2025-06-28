'use client'

import { Capacitor } from '@capacitor/core'
import { SafeArea, initialize } from '@capacitor-community/safe-area'

/**
 * 安全区域管理工具
 * 统一管理所有平台的安全区域逻辑
 */
export const SafeAreaManager = {
  /**
   * 初始化安全区域
   */
  async initialize(): Promise<void> {
    try {
      // 初始化插件的 CSS 变量（移动端需要）
      initialize()

      // 加载用户设置并应用安全区域变量
      await this.loadAndApplySettings()

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
        })

        // 监听原生安全区域变化
        this.watchNativeSafeAreaChanges()
      } else {
        // 网页版也需要监听设置变化
        window.addEventListener('storageChange', (event: Event) => {
          const customEvent = event as CustomEvent<{ key?: string }>;
          if (customEvent.detail?.key === 'brewGuideSettings') {
            this.loadAndApplySettings()
          }
        })
      }

      console.warn('SafeArea initialized successfully')
    } catch (error) {
      console.error('Failed to initialize SafeArea:', error)
    }
  },

  /**
   * 设置安全区域 CSS 变量
   * 移动端：原生安全区域 + 用户自定义边距，网页版：用户自定义边距
   */
  setupSafeAreaVariables(customMargins?: { top: number; bottom: number }): void {
    const root = document.documentElement

    // 默认边距
    const defaultMargins = { top: 42, bottom: 42 }
    const margins = customMargins || defaultMargins

    // 固定的左右边距
    const horizontalMargin = 12

    if (Capacitor.isNativePlatform()) {
      // 移动端：原生安全区域 + 用户自定义边距
      root.style.setProperty('--safe-area-top', `calc(var(--safe-area-inset-top, 0px) + ${margins.top}px)`)
      root.style.setProperty('--safe-area-bottom', `calc(var(--safe-area-inset-bottom, 0px) + ${margins.bottom}px)`)
      root.style.setProperty('--safe-area-left', `calc(var(--safe-area-inset-left, 0px) + ${horizontalMargin}px)`)
      root.style.setProperty('--safe-area-right', `calc(var(--safe-area-inset-right, 0px) + ${horizontalMargin}px)`)
    } else {
      // 网页版：用户自定义边距
      root.style.setProperty('--safe-area-top', `${margins.top}px`)
      root.style.setProperty('--safe-area-bottom', `${margins.bottom}px`)
      root.style.setProperty('--safe-area-left', `${horizontalMargin}px`)
      root.style.setProperty('--safe-area-right', `${horizontalMargin}px`)
    }
  },

  /**
   * 监听原生安全区域变化
   */
  watchNativeSafeAreaChanges(): void {
    // 监听方向变化
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        // 重新应用当前的安全区域设置
        this.loadAndApplySettings()
      }, 300)
    })

    // 监听设置变化
    window.addEventListener('storageChange', (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string }>;
      if (customEvent.detail?.key === 'brewGuideSettings') {
        this.loadAndApplySettings()
      }
    })
  },

  /**
   * 从存储中加载设置并应用安全区域边距
   */
  async loadAndApplySettings(): Promise<void> {
    try {
      // 动态导入 Storage 以避免循环依赖
      const { Storage } = await import('@/lib/core/storage')
      const settingsStr = await Storage.get('brewGuideSettings')

      if (settingsStr) {
        const settings = JSON.parse(settingsStr)
        const margins = settings.safeAreaMargins

        if (margins) {
          this.setupSafeAreaVariables(margins)
        } else {
          this.setupSafeAreaVariables()
        }
      } else {
        this.setupSafeAreaVariables()
      }
    } catch (error) {
      console.error('Failed to load safe area settings:', error)
      this.setupSafeAreaVariables()
    }
  },

  /**
   * 更新安全区域边距
   */
  updateMargins(margins: { top: number; bottom: number }): void {
    this.setupSafeAreaVariables(margins)
  },

  /**
   * 动态更新安全区域配置
   * @param config 配置选项
   */
  async updateConfig(config: {
    statusBarColor?: string
    statusBarContent?: 'light' | 'dark'
    navigationBarColor?: string
    navigationBarContent?: 'light' | 'dark'
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
        })
      }
    } catch (error) {
      console.error('Failed to update SafeArea config:', error)
    }
  },
}

export default SafeAreaManager
