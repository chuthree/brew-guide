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
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' }
    ],
    shortcut: '/icons/icon-192x192.png',
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)" />
        {isDevelopment && (
          <Script src="/sw-dev-unregister.js" strategy="beforeInteractive" />
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

                    // 优化更新检查间隔
                    let updateInterval = 60 * 60 * 1000; // 1小时
                    const checkForUpdate = async () => {
                      try {
                        await registration.update();
                      } catch (err) {
                        console.warn('ServiceWorker update check failed:', err);
                      }
                    };
                    setInterval(checkForUpdate, updateInterval);
                    
                    // 添加页面可见性变化监听
                    let lastUpdateCheck = 0;
                    const updateCooldown = 10 * 60 * 1000; // 10分钟冷却时间
                    
                    document.addEventListener('visibilitychange', () => {
                      if (document.visibilityState === 'visible') {
                        const now = Date.now();
                        // 只有当距离上次检查超过冷却时间时才检查更新
                        if (now - lastUpdateCheck > updateCooldown) {
                          lastUpdateCheck = now;
                          navigator.serviceWorker.ready.then(registration => registration.update());
                        }
                      }
                    });
                  } catch (err) {
                    console.warn('ServiceWorker registration failed: ', err);
                  }
                });
              } else {
                // 开发环境 - 卸载 Service Worker
                window.addEventListener('load', function() {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                      registration.unregister();
                      console.log('ServiceWorker unregistered in development mode');
                    }
                  });
                });
              }
            }
          `}
        </Script>
      </body>
    </html>
  )
}
