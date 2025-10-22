/**
 * 处理 JavaScript chunk 加载错误的工具函数
 * 主要用于解决 PWA 部署后 chunk 缓存问题
 */

// 类型定义
interface WindowWithNext extends Window {
  next?: {
    router?: {
      events?: {
        on: (event: string, handler: (err: Error, url: string) => void) => void;
      };
    };
  };
}

interface ErrorLike {
  message?: string;
  toString?: () => string;
}

class ChunkErrorManager {
  private static instance: ChunkErrorManager;
  private retryCount = 0;
  private maxRetries = 3;
  private retryDelay = 1000;
  private isHandling = false;

  static getInstance(): ChunkErrorManager {
    if (!ChunkErrorManager.instance) {
      ChunkErrorManager.instance = new ChunkErrorManager();
    }
    return ChunkErrorManager.instance;
  }

  /**
   * 初始化 chunk 错误处理
   */
  init() {
    if (typeof window === 'undefined') return;

    try {
      // 监听全局错误
      window.addEventListener('error', this.handleError.bind(this), {
        passive: true,
      });
      window.addEventListener(
        'unhandledrejection',
        this.handleRejection.bind(this),
        { passive: true }
      );

      // 监听 Next.js 路由错误
      if (typeof window !== 'undefined' && 'next' in window) {
        const router = (window as WindowWithNext).next?.router;
        if (router && typeof router.events?.on === 'function') {
          router.events.on(
            'routeChangeError',
            this.handleRouteError.bind(this)
          );
        }
      }

      console.warn('Chunk 错误处理器已初始化');
    } catch (error) {
      console.error('初始化 chunk 错误处理器失败:', error);
    }
  }

  /**
   * 处理脚本加载错误
   */
  private handleError(event: ErrorEvent) {
    const error = event.error;
    const message = event.message || '';

    // 检查是否是 chunk 加载错误
    if (this.isChunkError(error, message)) {
      console.warn('检测到 chunk 加载错误:', { error, message });
      this.handleChunkError();
    }
  }

  /**
   * 处理 Promise 拒绝错误
   */
  private handleRejection(event: PromiseRejectionEvent) {
    const reason = event.reason;

    if (this.isChunkError(reason, reason?.message || '')) {
      console.warn('检测到 chunk Promise 拒绝:', reason);
      this.handleChunkError();
    }
  }

  /**
   * 处理路由错误
   */
  private handleRouteError(err: Error, url: string) {
    if (this.isChunkError(err, err.message)) {
      console.warn('检测到路由 chunk 错误:', { err, url });
      this.handleChunkError();
    }
  }

  /**
   * 判断是否是 chunk 加载错误
   */
  private isChunkError(error: Error | unknown, message: string): boolean {
    if (!error && !message) return false;

    const chunkErrorPatterns = [
      /Loading chunk \d+ failed/i,
      /ChunkLoadError/i,
      /Loading CSS chunk/i,
      /Failed to import/i,
      /Cannot resolve module/i,
      /Script error/i,
      /NetworkError/i,
      /_next\/static\/chunks/i,
    ];

    const errorString = (
      (error as ErrorLike)?.message ||
      message ||
      (error as ErrorLike)?.toString?.() ||
      ''
    ).toLowerCase();

    // 更严格的检查，避免误判
    const isChunkRelated = chunkErrorPatterns.some(pattern =>
      pattern.test(errorString)
    );

    // 排除一些不应该处理的错误
    const shouldIgnore = [
      /cors/i,
      /unauthorized/i,
      /forbidden/i,
      /not found/i,
    ].some(pattern => pattern.test(errorString));

    return isChunkRelated && !shouldIgnore;
  }

  /**
   * 处理 chunk 错误
   */
  private async handleChunkError() {
    if (this.isHandling) return;

    this.isHandling = true;
    this.retryCount++;

    console.warn(
      `处理 chunk 错误，重试次数: ${this.retryCount}/${this.maxRetries}`
    );

    try {
      // 添加防抖机制，避免频繁重试
      if (this.retryCount === 1) {
        // 第一次错误时等待更长时间，可能是临时网络问题
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      if (this.retryCount <= this.maxRetries) {
        await this.clearCachesAndRetry();
      } else {
        console.warn('达到最大重试次数，执行强制重载');
        await this.forceReload();
      }
    } catch (err) {
      console.error('处理 chunk 错误时出现异常:', err);
      await this.forceReload();
    } finally {
      this.isHandling = false;
    }
  }

  /**
   * 清除缓存并重试 - 简化版本
   */
  private async clearCachesAndRetry() {
    try {
      console.warn('Chunk加载失败，正在重新加载页面...');
      // 简单直接重新加载，不进行复杂的缓存清理
      setTimeout(() => {
        window.location.reload();
      }, this.retryDelay);
    } catch (error) {
      console.error('重新加载失败:', error);
      window.location.reload();
    }
  }

  /**
   * 强制重新加载页面 - 简化版本
   */
  private async forceReload() {
    console.warn('强制重新加载页面');
    window.location.reload();
  }

  /**
   * 重置重试计数
   */
  reset() {
    this.retryCount = 0;
    this.isHandling = false;
  }
}

// 导出单例实例
export const chunkErrorHandler = ChunkErrorManager.getInstance();

// 自动初始化
if (typeof window !== 'undefined') {
  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      chunkErrorHandler.init();
    });
  } else {
    chunkErrorHandler.init();
  }
}
