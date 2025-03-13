import { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import PWAPrompt from '@/components/PWAPrompt'
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script'
import './globals.css'


// SEO constants
export const metadata: Metadata = {
  metadataBase: new URL('https://brew-guide.vercel.app/'),
  title: '手冲咖啡冲煮指南',
  description:
    '专业的手冲咖啡冲煮指南，包含手冲咖啡的详细步骤、参数配置和计时器。提供清爽果香和醇厚平衡两种风味的冲煮方案，帮助您在家制作出完美的手冲咖啡。',
  keywords: [
    '手冲咖啡冲煮',
    'V60',
    '手冲咖啡',
    '手冲咖啡计时器',
    '手冲咖啡教程',
    '手冲咖啡配比',
    '手冲咖啡萃取',
  ],
  manifest: '/manifest.json',
  openGraph: {
    title: '手冲咖啡冲煮指南',
    description:
      '专业的手冲咖啡冲煮指南，包含手冲咖啡的详细步骤、参数配置和计时器。提供清爽果香和醇厚平衡两种风味的冲煮方案，帮助您在家制作出完美的手冲咖啡。',
    url: 'https://brew-guide.vercel.app/',
    siteName: "Chu3's Coffee Guide",
    locale: 'zh_CN',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: '咖啡冲煮指南 | 手冲咖啡冲煮指南',
    description:
      '专业的咖啡冲煮指南，包含手冲咖啡的详细步骤、参数配置和计时器。',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    shortcut: '/favicon.ico',
    apple: '/icons/icon-192x192.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/icons/icon-192x192.png',
    },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 确定当前环境
  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <html lang="zh" suppressHydrationWarning>
      <head>
        <meta name="application-name" content="Brew Guide" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Brew Guide" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512x512.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)" />
        {isDevelopment && (
          <>
            <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            <meta httpEquiv="Pragma" content="no-cache" />
            <meta httpEquiv="Expires" content="0" />
            <Script src="/sw-dev-unregister.js" strategy="beforeInteractive" />
          </>
        )}
      </head>
      <body className="bg-neutral-50 dark:bg-neutral-900 fixed inset-0 overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="h-full w-full overflow-hidden">
            {children}
          </div>
          <PWAPrompt />
        </ThemeProvider>
        <Analytics />
        <Script id="service-worker-handler" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
              
              if (!isDev) {
                // 生产环境 - 注册 Service Worker
                window.addEventListener('load', async function() {
                  try {
                    const registration = await navigator.serviceWorker.register('/sw.js', {
                      scope: '/',
                      updateViaCache: 'none'
                    });
                    console.log('ServiceWorker registration successful');

                    // 检查并应用更新
                    registration.addEventListener('updatefound', () => {
                      const newWorker = registration.installing;
                      console.log('Service Worker update found!');
                      
                      newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          // 新的Service Worker已安装，可以通知用户刷新
                          if (confirm('新版本可用！点击确定刷新页面以应用更新。')) {
                            window.location.reload();
                          }
                        }
                      });
                    });
                    
                    // 优化更新检查间隔
                    let updateInterval = 30 * 60 * 1000; // 30分钟
                    const checkForUpdate = async () => {
                      try {
                        await registration.update();
                        console.log('Service Worker update check completed');
                      } catch (err) {
                        console.warn('ServiceWorker update check failed:', err);
                      }
                    };
                    setInterval(checkForUpdate, updateInterval);
                    
                    // 添加页面可见性变化监听
                    let lastUpdateCheck = 0;
                    const updateCooldown = 5 * 60 * 1000; // 5分钟冷却时间
                    
                    document.addEventListener('visibilitychange', () => {
                      if (document.visibilityState === 'visible') {
                        const now = Date.now();
                        // 只有当距离上次检查超过冷却时间时才检查更新
                        if (now - lastUpdateCheck > updateCooldown) {
                          lastUpdateCheck = now;
                          console.log('Checking for Service Worker updates on page visibility change');
                          navigator.serviceWorker.ready.then(registration => registration.update());
                        }
                      }
                    });
                  } catch (err) {
                    console.warn('ServiceWorker registration failed: ', err);
                  }
                });
              } else {
                // 开发环境 - 卸载 Service Worker 并清除缓存
                window.addEventListener('load', function() {
                  // 清除所有缓存
                  if ('caches' in window) {
                    caches.keys().then(function(cacheNames) {
                      return Promise.all(
                        cacheNames.map(function(cacheName) {
                          console.log('开发环境：删除缓存', cacheName);
                          return caches.delete(cacheName);
                        })
                      );
                    });
                  }
                  
                  // 卸载所有 Service Worker
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                      registration.unregister().then(function(success) {
                        console.log('开发环境：Service Worker 卸载' + (success ? '成功' : '失败'));
                      });
                    }
                  });
                  
                  // 禁用应用缓存
                  if (window.applicationCache) {
                    try {
                      window.applicationCache.swapCache();
                    } catch (e) {}
                  }
                  
                  // 设置禁用缓存的请求头
                  const originalFetch = window.fetch;
                  window.fetch = function(input, init) {
                    init = init || {};
                    init.headers = init.headers || {};
                    init.headers = {
                      ...init.headers,
                      'Pragma': 'no-cache',
                      'Cache-Control': 'no-cache, no-store, must-revalidate'
                    };
                    return originalFetch(input, init);
                  };
                });
              }
            }
          `}
        </Script>
      </body>
    </html>
  )
}
