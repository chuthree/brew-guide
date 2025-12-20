import { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
import { Analytics } from '@vercel/analytics/next';
import localFont from 'next/font/local';
import { LightToast } from '@/components/common/feedback/LightToast';
import { ExitToast } from '@/components/common/feedback/ExitToast';
import '@/styles/base/globals.css';
import KeyboardManager from '@/components/layout/KeyboardManager';
import { Suspense } from 'react';
import CapacitorInit from '@/providers/CapacitorProvider';
import StorageInit from '@/providers/StorageProvider';
import ModalHistoryInit from '@/providers/ModalHistoryProvider';

import { BaiduAnalytics } from '@/components/common/BaiduAnalytics';
import DevTools from '@/components/common/DevTools';
import TauriDragRegion from '@/components/layout/TauriDragRegion';

// 只加载需要的 GeistMono 字重（用于计时器）
const geistMono = localFont({
  src: [
    {
      path: '../styles/fonts/GeistMonoVF.woff2',
      weight: '100 900',
      style: 'normal',
    },
  ],
  variable: '--font-geist-mono',
  display: 'swap',
});

// SEO constants
export const metadata: Metadata = {
  metadataBase: new URL('https://coffee.chu3.top/'),
  title: 'Brew Guide - 咖啡小工具',
  description: '一站式咖啡小工具，支持辅助冲煮，豆仓管理与品鉴记录功能。',
  keywords: [
    '手冲咖啡',
    '咖啡计时器',
    'V60',
    '手冲咖啡计时器',
    '手冲咖啡教程',
    '咖啡冲煮',
    '咖啡萃取',
    'Brew Guide',
    '咖啡小工具',
    '咖啡豆管理',
    '豆仓管理',
    '咖啡品鉴',
    '品鉴记录',
    '精品咖啡',
    '咖啡风味',
    '咖啡器材',
    '意式咖啡',
    '咖啡笔记',
  ],
  manifest: '/manifest.json',
  alternates: {
    canonical: 'https://coffee.chu3.top/',
  },
  openGraph: {
    title: 'Brew Guide - 咖啡小工具',
    description: '一站式咖啡小工具，支持辅助冲煮，豆仓管理与品鉴记录功能。',
    url: 'https://coffee.chu3.top/',
    siteName: "Brew Guide - Chu3's Coffee Guide",
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: 'https://coffee.chu3.top/images/icons/app/icon-512x512.png',
        width: 512,
        height: 512,
        alt: 'Brew Guide Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Brew Guide - 咖啡小工具',
    description: '一站式咖啡小工具，支持辅助冲煮，豆仓管理与品鉴记录功能。',
    images: ['https://coffee.chu3.top/images/icons/app/icon-512x512.png'],
    creator: '@chu3',
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
      { url: '/images/icons/app/favicon.ico', sizes: 'any' },
      {
        url: '/images/icons/app/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/images/icons/app/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcut: '/images/icons/app/favicon.ico',
    apple: '/images/icons/app/icon-192x192.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/images/icons/app/icon-192x192.png',
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Brew Guide',
  },
  verification: {
    google: null,
    yandex: null,
    yahoo: null,
    other: {
      baidu: '1d5ab7c4016b8737328359797bfaac08',
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 确定当前环境
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <html
      lang="zh"
      suppressHydrationWarning
      className={geistMono.variable}
      style={
        {
          // 正文字体：优先使用系统 UI 字体
          '--font-sans': `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif`,
          // 计时器/数字字体：等宽字体保证对齐
          '--font-timer':
            'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          // 系统数字字体（可选）：用于表格、价格等
          '--font-numeric': 'ui-rounded, "SF Pro Rounded", system-ui',
        } as React.CSSProperties
      }
    >
      <head>
        {/* JSON-LD 结构化数据 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'Brew Guide',
              applicationCategory: 'LifestyleApplication',
              operatingSystem: 'Web, iOS, Android',
              description:
                '一站式咖啡小工具，支持辅助冲煮，豆仓管理与品鉴记录功能。',
              url: 'https://coffee.chu3.top/',
              author: {
                '@type': 'Person',
                name: 'Chu3',
              },
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'CNY',
              },
              aggregateRating: {
                '@type': 'AggregateRating',
                ratingValue: '5',
                ratingCount: '1',
              },
            }),
          }}
        />
        <meta name="application-name" content="Brew Guide" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Brew Guide" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link
          rel="apple-touch-startup-image"
          href="/images/icons/app/icon-512x512.png"
        />
        <link
          rel="apple-touch-icon"
          href="/images/icons/app/icon-192x192.png"
        />
        <link rel="icon" href="/images/icons/app/favicon.ico" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        {/* theme-color 由客户端 useThemeColor hook 动态管理，避免 RSC 静态标签覆盖 */}
        {/* 百度统计代码 */}
        <BaiduAnalytics />
        {/* 字体缩放初始化脚本 - 必须在页面渲染前执行，避免字体闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedZoom = localStorage.getItem('fontZoomLevel');
                  if (savedZoom) {
                    const zoomLevel = parseFloat(savedZoom);
                    if (!isNaN(zoomLevel) && zoomLevel >= 0.8 && zoomLevel <= 1.4) {
                      document.documentElement.style.setProperty('--font-scale', zoomLevel.toString());
                    }
                  }
                } catch (e) {
                  // 静默处理错误
                }
              })();
            `,
          }}
        />
        {isDevelopment && (
          <>
            <meta
              httpEquiv="Cache-Control"
              content="no-cache, no-store, must-revalidate"
            />
            <meta httpEquiv="Pragma" content="no-cache" />
            <meta httpEquiv="Expires" content="0" />
          </>
        )}
        {!isDevelopment && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // PWA Service Worker 注册 - 遵循 Google 最佳实践
                if ('serviceWorker' in navigator) {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker
                      .register('/sw.js', { scope: '/' })
                      .then(function(registration) {
                        console.log('✅ Service Worker registered:', registration.scope);
                        
                        // 检查更新
                        registration.addEventListener('updatefound', function() {
                          const newWorker = registration.installing;
                          console.log('🔄 Service Worker update found');
                        });
                      })
                      .catch(function(error) {
                        console.error('❌ Service Worker registration failed:', error);
                      });
                  });
                }
              `,
            }}
          />
        )}
      </head>
      <body>
        {/* SEO: 为不支持 JavaScript 的搜索引擎爬虫提供内容 */}
        <noscript>
          <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h1>Brew Guide - 咖啡小工具</h1>
            <p>一站式咖啡小工具，支持辅助冲煮，豆仓管理与品鉴记录功能。</p>

            <h2>冲煮管理</h2>
            <ul>
              <li>支持多种器具：V60、聪明杯、蛋糕滤杯、折纸滤杯、意式咖啡机</li>
              <li>丰富的冲煮方案库，预设和自定义方法</li>
              <li>精确的计时器，按阶段引导冲煮</li>
              <li>可视化注水过程</li>
            </ul>

            <h2>咖啡豆管理</h2>
            <ul>
              <li>详细库存记录（产地、庄园、处理法、品种、烘焙度等）</li>
              <li>烘焙日期追踪和新鲜度监控</li>
              <li>消耗跟踪和剩余量管理</li>
              <li>
                智能搜索：支持名称、品牌、产区、庄园、风味、处理法、品种筛选
              </li>
            </ul>

            <h2>冲煮笔记</h2>
            <ul>
              <li>详细记录评分、口感和笔记</li>
              <li>关联器具、方法和豆子数据</li>
              <li>趋势分析和偏好统计</li>
            </ul>

            <h2>其他特性</h2>
            <ul>
              <li>PWA 支持，可离线使用</li>
              <li>深色/浅色模式</li>
              <li>数据导入导出</li>
              <li>多平台支持（Web、iOS、Android、桌面）</li>
            </ul>

            <p>
              <a href="https://coffee.chu3.top/">访问 Brew Guide 网页版</a> |
              <a href="https://gitee.com/chu3/brew-guide/releases">下载 App</a>
            </p>
          </div>
        </noscript>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme={false}
          disableTransitionOnChange
        >
          <TauriDragRegion />
          <DevTools />
          <div className="h-dvh overflow-hidden bg-neutral-50 dark:bg-neutral-900">
            <Suspense>
              <CapacitorInit />
              <StorageInit />
              <ModalHistoryInit />
              <KeyboardManager />
            </Suspense>
            <div className="mx-auto h-full w-full overflow-hidden">
              {children}
            </div>
            <LightToast />
            <ExitToast />
          </div>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
