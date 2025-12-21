/**
 * 同步管理器 (Apple 风格)
 *
 * 设计原则：
 * 1. 无感同步 - 用户不需要关心同步状态，只在同步时短暂显示转圈
 * 2. 静默重连 - 后台返回时自动重连，失败时静默重试
 * 3. 智能重试 - 指数退避，网络恢复时自动同步
 * 4. 数据安全 - 原子操作，失败可回滚
 * 5. 防抖节流 - 避免频繁同步，合并请求
 */

import { getSyncStatusStore } from '@/lib/stores/syncStatusStore';

// ============================================
// 类型定义
// ============================================

export interface SyncServiceInterface {
  testConnection: () => Promise<boolean>;
  downloadAllData: () => Promise<{ success: boolean; message?: string }>;
  uploadAllData: () => Promise<{ success: boolean; message?: string }>;
  startRealtimeSync: () => boolean;
  stopRealtimeSync: () => void;
  getRealtimeStatus: () => 'connected' | 'disconnected';
}

export interface SyncConfig {
  /** 最大重试次数 */
  maxRetries: number;
  /** 每次重试的延迟时间（毫秒），支持指数退避 */
  retryDelays: number[];
  /** 后台返回重连延迟（毫秒） */
  reconnectDelay: number;
  /** 同步防抖延迟（毫秒） */
  syncDebounceDelay: number;
  /** 网络恢复后同步延迟（毫秒） */
  networkRecoveryDelay: number;
}

interface PendingSync {
  type: 'upload' | 'download' | 'full';
  timestamp: number;
  resolve: (value: boolean) => void;
  reject: (error: Error) => void;
}

// ============================================
// 默认配置
// ============================================

const DEFAULT_CONFIG: SyncConfig = {
  maxRetries: 3,
  retryDelays: [1000, 2000, 4000], // 指数退避
  reconnectDelay: 300, // 后台返回后 300ms 重连
  syncDebounceDelay: 500, // 500ms 防抖
  networkRecoveryDelay: 1000, // 网络恢复后 1 秒同步
};

// ============================================
// 同步管理器
// ============================================

class SyncManagerClass {
  private config: SyncConfig = DEFAULT_CONFIG;
  private syncService: SyncServiceInterface | null = null;
  private isInitialized = false;

  // 事件监听器引用
  private visibilityHandler: (() => void) | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;
  private capacitorListenerIds: string[] = [];

  // 定时器
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private syncDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  // 状态
  private isReconnecting = false;
  private lastSyncTime = 0;
  private pendingSync: PendingSync | null = null;

  // ============================================
  // 生命周期
  // ============================================

  /**
   * 初始化同步管理器
   */
  initialize(
    service: SyncServiceInterface,
    config?: Partial<SyncConfig>
  ): void {
    if (this.isInitialized) {
      console.log('[SyncManager] 已初始化，跳过');
      return;
    }

    this.syncService = service;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.setupEventListeners();
    this.isInitialized = true;

    console.log('[SyncManager] 初始化完成');
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.removeEventListeners();
    this.clearAllTimers();
    this.syncService = null;
    this.isInitialized = false;
    this.pendingSync = null;

    console.log('[SyncManager] 已清理');
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized && this.syncService !== null;
  }

  // ============================================
  // 事件监听
  // ============================================

  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    // 页面可见性监听（前后台切换）
    this.visibilityHandler = this.handleVisibilityChange.bind(this);
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // 网络状态监听
    this.onlineHandler = this.handleOnline.bind(this);
    this.offlineHandler = this.handleOffline.bind(this);
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);

    // Capacitor 原生监听
    this.setupCapacitorListeners();
  }

  private async setupCapacitorListeners(): Promise<void> {
    try {
      const { App } = await import('@capacitor/app');

      // 应用状态变化
      const stateListener = await App.addListener(
        'appStateChange',
        ({ isActive }) => {
          if (isActive) {
            this.handleAppResume();
          }
        }
      );
      this.capacitorListenerIds.push(stateListener.toString());

      // 应用恢复
      const resumeListener = await App.addListener('resume', () => {
        this.handleAppResume();
      });
      this.capacitorListenerIds.push(resumeListener.toString());
    } catch {
      // 非 Capacitor 环境，静默忽略
    }
  }

  private removeEventListeners(): void {
    if (typeof window === 'undefined') return;

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }
    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
      this.offlineHandler = null;
    }

    // 清理 Capacitor 监听器
    this.cleanupCapacitorListeners();
  }

  private async cleanupCapacitorListeners(): Promise<void> {
    try {
      const { App } = await import('@capacitor/app');
      await App.removeAllListeners();
    } catch {
      // 静默忽略
    }
    this.capacitorListenerIds = [];
  }

  private clearAllTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
  }

  // ============================================
  // 事件处理
  // ============================================

  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      this.handleAppResume();
    }
  }

  private handleAppResume(): void {
    // 防止重复触发
    if (this.isReconnecting) return;

    const syncStore = getSyncStatusStore();
    if (!this.syncService || syncStore.provider === 'none') return;

    console.log('[SyncManager] 应用恢复前台');

    // 检查是否需要重新同步（距离上次同步超过 30 秒）
    const timeSinceLastSync = Date.now() - this.lastSyncTime;
    if (timeSinceLastSync < 30000 && this.lastSyncTime > 0) {
      console.log('[SyncManager] 最近已同步，跳过');
      return;
    }

    // 延迟重连，避免立即触发
    this.clearAllTimers();
    this.reconnectTimer = setTimeout(() => {
      this.silentReconnect();
    }, this.config.reconnectDelay);
  }

  private handleOnline(): void {
    console.log('[SyncManager] 网络恢复');
    const syncStore = getSyncStatusStore();

    // 网络恢复，延迟同步
    if (syncStore.provider !== 'none') {
      this.clearAllTimers();
      this.reconnectTimer = setTimeout(() => {
        this.silentReconnect();
      }, this.config.networkRecoveryDelay);
    }
  }

  private handleOffline(): void {
    console.log('[SyncManager] 网络断开');
    // 清理定时器，不显示离线状态（Apple 风格）
    this.clearAllTimers();
  }

  // ============================================
  // 核心同步逻辑
  // ============================================

  /**
   * 静默重连（Apple 风格：不打扰用户）
   */
  private async silentReconnect(): Promise<boolean> {
    if (!this.syncService || this.isReconnecting) return false;

    const syncStore = getSyncStatusStore();
    this.isReconnecting = true;

    // 检查网络
    if (!this.isOnline()) {
      console.log('[SyncManager] 网络不可用，跳过重连');
      this.isReconnecting = false;
      return false;
    }

    console.log('[SyncManager] 开始静默重连...');

    // 显示同步中状态（转圈图标）
    syncStore.setReconnecting(true);

    try {
      // 测试连接
      const connected = await this.withTimeout(
        this.syncService.testConnection(),
        10000,
        '连接测试超时'
      );

      if (!connected) {
        throw new Error('连接测试失败');
      }

      // 重启实时同步
      if (this.syncService.getRealtimeStatus() === 'disconnected') {
        this.syncService.startRealtimeSync();
      }

      // 下载最新数据
      const result = await this.withTimeout(
        this.syncService.downloadAllData(),
        30000,
        '数据下载超时'
      );

      this.lastSyncTime = Date.now();

      if (result.success) {
        console.log('[SyncManager] 静默重连成功');
        // downloadAllData 内部会调用 setSyncSuccess
      } else {
        // 下载失败但不报错，静默重置
        syncStore.setStatus('idle');
      }

      syncStore.setReconnecting(false);
      syncStore.resetRetry();
      return true;
    } catch (error) {
      console.warn('[SyncManager] 静默重连失败:', error);

      // 静默重试
      const retryCount = syncStore.incrementRetry();
      if (retryCount < this.config.maxRetries) {
        const delay = this.config.retryDelays[retryCount - 1] || 5000;
        console.log(
          `[SyncManager] ${delay}ms 后重试 (${retryCount}/${this.config.maxRetries})`
        );

        this.reconnectTimer = setTimeout(() => {
          this.isReconnecting = false;
          this.silentReconnect();
        }, delay);
      } else {
        // 重试次数用完，静默放弃
        console.log('[SyncManager] 重试次数用完，等待下次机会');
        syncStore.setStatus('idle');
        syncStore.setReconnecting(false);
        syncStore.resetRetry();
        this.isReconnecting = false;
      }

      return false;
    } finally {
      if (!this.reconnectTimer) {
        this.isReconnecting = false;
      }
    }
  }

  /**
   * 手动触发同步（带防抖）
   */
  async requestSync(
    type: 'upload' | 'download' | 'full' = 'download'
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // 如果有待处理的同步请求，取消它
      if (this.pendingSync) {
        this.pendingSync.resolve(false);
      }

      // 记录新的待处理请求
      this.pendingSync = { type, timestamp: Date.now(), resolve, reject };

      // 清除之前的防抖定时器
      if (this.syncDebounceTimer) {
        clearTimeout(this.syncDebounceTimer);
      }

      // 设置防抖
      this.syncDebounceTimer = setTimeout(async () => {
        const pending = this.pendingSync;
        this.pendingSync = null;

        if (!pending) return;

        try {
          const result = await this.executeSync(pending.type);
          pending.resolve(result);
        } catch (error) {
          pending.reject(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }, this.config.syncDebounceDelay);
    });
  }

  /**
   * 执行同步操作
   */
  private async executeSync(
    type: 'upload' | 'download' | 'full'
  ): Promise<boolean> {
    if (!this.syncService) {
      console.warn('[SyncManager] 同步服务未初始化');
      return false;
    }

    const syncStore = getSyncStatusStore();

    if (!this.isOnline()) {
      console.log('[SyncManager] 网络不可用');
      return false;
    }

    syncStore.setSyncing();

    try {
      let result: { success: boolean; message?: string };

      switch (type) {
        case 'upload':
          result = await this.withTimeout(
            this.syncService.uploadAllData(),
            60000,
            '上传超时'
          );
          break;
        case 'download':
          result = await this.withTimeout(
            this.syncService.downloadAllData(),
            60000,
            '下载超时'
          );
          break;
        case 'full':
          // 先上传后下载
          const uploadResult = await this.withTimeout(
            this.syncService.uploadAllData(),
            60000,
            '上传超时'
          );
          if (!uploadResult.success) {
            result = uploadResult;
          } else {
            result = await this.withTimeout(
              this.syncService.downloadAllData(),
              60000,
              '下载超时'
            );
          }
          break;
      }

      this.lastSyncTime = Date.now();

      if (result.success) {
        syncStore.setSyncSuccess();
        return true;
      } else {
        // 同步失败但不报错，静默处理
        syncStore.setStatus('idle');
        return false;
      }
    } catch (error) {
      console.error('[SyncManager] 同步失败:', error);
      syncStore.setStatus('idle'); // Apple 风格：不显示错误
      return false;
    }
  }

  // ============================================
  // 带重试的操作包装
  // ============================================

  /**
   * 带重试的异步操作
   */
  async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries?: number
  ): Promise<T> {
    const retries = maxRetries ?? this.config.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          const delay = this.config.retryDelays[attempt] || 5000;
          console.log(
            `[SyncManager] ${operationName} 失败，${delay}ms 后重试 (${attempt + 1}/${retries})`
          );
          await this.delay(delay);
        }
      }
    }

    throw lastError || new Error(`${operationName} 失败`);
  }

  /**
   * 带超时的 Promise
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      }),
    ]);
  }

  // ============================================
  // 工具方法
  // ============================================

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 检查网络状态
   */
  isOnline(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  /**
   * 获取上次同步时间
   */
  getLastSyncTime(): number {
    return this.lastSyncTime;
  }

  /**
   * 获取同步服务
   */
  getService(): SyncServiceInterface | null {
    return this.syncService;
  }
}

// 导出单例
export const SyncManager = new SyncManagerClass();

export default SyncManager;
