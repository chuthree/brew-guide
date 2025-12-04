'use client';

import { useState } from 'react';

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
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  // 检查是否是 chunk 加载错误
  const isChunkError =
    error.message?.includes('Loading chunk') ||
    error.message?.includes('ChunkLoadError') ||
    error.message?.includes('Failed to fetch') ||
    error.message?.includes('_next/static');

  // 生成错误详情文本
  const getErrorDetails = () => {
    const details = [
      `时间: ${new Date().toLocaleString('zh-CN')}`,
      `错误类型: ${error.name || 'Unknown'}`,
      `错误信息: ${error.message || 'No message'}`,
      error.digest ? `错误代码: ${error.digest}` : '',
      `URL: ${typeof window !== 'undefined' ? window.location.href : 'N/A'}`,
      `User Agent: ${typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}`,
      '',
      '堆栈信息:',
      error.stack || 'No stack trace available',
    ]
      .filter(Boolean)
      .join('\n');
    return details;
  };

  // 复制错误日志
  const handleCopyError = async () => {
    try {
      await navigator.clipboard.writeText(getErrorDetails());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = getErrorDetails();
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
          <div className="mx-auto max-w-2xl text-center">
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

              <button
                onClick={() => setShowDetails(!showDetails)}
                className="rounded-full bg-neutral-100 px-6 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                {showDetails ? '隐藏详情' : '查看详情'}
              </button>
            </div>

            {showDetails && (
              <div className="mt-6 text-left">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    错误日志
                  </span>
                  <button
                    onClick={handleCopyError}
                    className="flex items-center gap-1 rounded-md bg-neutral-200 px-3 py-1 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                  >
                    {copied ? (
                      <>
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        已复制
                      </>
                    ) : (
                      <>
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                          />
                        </svg>
                        复制日志
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-lg bg-neutral-100 p-4 text-xs break-all whitespace-pre-wrap text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                  {getErrorDetails()}
                </pre>
              </div>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
