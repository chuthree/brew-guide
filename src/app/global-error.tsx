'use client';

/**
 * 全局错误边界 - Next.js 官方推荐方案
 *
 * 用于捕获根布局中的错误，包括：
 * - Chunk 加载失败（PWA 部署后常见问题）
 * - 渲染错误
 * - 其他未捕获的运行时错误
 *
 * 文档: https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 检查是否是 chunk 加载错误
  const isChunkError =
    error.message?.includes('Loading chunk') ||
    error.message?.includes('ChunkLoadError') ||
    error.message?.includes('Failed to fetch') ||
    error.message?.includes('_next/static');

  // 处理 chunk 错误：清除缓存并刷新
  const handleChunkError = async () => {
    try {
      // 清除 Service Worker 缓存
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }

      // 注销 Service Worker
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }

      // 强制刷新
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  return (
    // global-error 必须包含 html 和 body 标签
    <html lang="zh">
      <body className="bg-neutral-50 dark:bg-neutral-900">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 py-4">
          <div className="mx-auto max-w-md text-center">
            <h2 className="text-xl font-light tracking-wide text-neutral-900 dark:text-neutral-100">
              {isChunkError ? '应用需要更新' : '出现了一些问题'}
            </h2>

            <p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
              {isChunkError
                ? '检测到新版本，请刷新页面以获取最新内容。'
                : '应用遇到了意外错误，请尝试刷新页面。'}
            </p>

            {error.digest && (
              <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
                错误代码: {error.digest}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={isChunkError ? handleChunkError : () => reset()}
                className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {isChunkError ? '更新应用' : '重试'}
              </button>

              <button
                onClick={() => (window.location.href = '/')}
                className="rounded-full bg-neutral-100 px-6 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                返回首页
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
