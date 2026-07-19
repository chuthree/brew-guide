import { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { ThemeProvider } from 'next-themes';
import localFont from 'next/font/local';
import { LightToast } from '@/components/common/feedback/LightToast';
import { ExitToast } from '@/components/common/feedback/ExitToast';
import '@/styles/base/globals.css';
import KeyboardManager from '@/components/layout/KeyboardManager';
import { Suspense } from 'react';
import CapacitorInit from '@/providers/CapacitorProvider';
import CrashDiagnosticsProvider from '@/providers/CrashDiagnosticsProvider';
import StorageInit from '@/providers/StorageProvider';
import ModalHistoryInit from '@/providers/ModalHistoryProvider';
import { DataLayerProvider } from '@/providers/DataLayerProvider';

import DevTools from '@/components/common/DevTools';
import TauriDragRegion from '@/components/layout/TauriDragRegion';
import PWAUpdatePrompt from '@/components/layout/PWAUpdatePrompt';

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

const SEO_TITLE = 'Brew Guide';

const encodeJsonForHtml = (value: unknown) =>
  JSON.stringify(value).replace(/[<>&]/g, char => {
    switch (char) {
      case '<':
        return '\\u003c';
      case '>':
        return '\\u003e';
      case '&':
        return '\\u0026';
      default:
        return char;
    }
  });

const STRUCTURED_DATA_JSON = encodeJsonForHtml({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Brew Guide',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web, iOS, Android',
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
});

// SEO constants
export const metadata: Metadata = {
  metadataBase: new URL('https://coffee.chu3.top/'),
  title: SEO_TITLE,
  keywords: [
    'Brew Guide',
    '咖啡计时器',
    '手冲计时器',
    '咖啡豆库存',
    '咖啡豆管理',
    '豆仓管理',
    '冲煮记录',
    '咖啡笔记',
    '品鉴记录',
  ],
  manifest: '/manifest.json',
  alternates: {
    canonical: 'https://coffee.chu3.top/',
  },
  openGraph: {
    title: SEO_TITLE,
    url: 'https://coffee.chu3.top/',
    siteName: 'Brew Guide',
    locale: 'zh_CN',
    type: 'website',
    images: [
      {
        url: 'https://coffee.chu3.top/images/icons/app/icon-512x512-opaque.png',
        width: 512,
        height: 512,
        alt: 'Brew Guide Logo',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SEO_TITLE,
    images: [
      'https://coffee.chu3.top/images/icons/app/icon-512x512-opaque.png',
    ],
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
        url: '/images/icons/app/icon-192x192-contained.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/images/icons/app/icon-512x512-contained.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    shortcut: '/images/icons/app/favicon.ico',
    apple: '/images/icons/app/apple-touch-icon.png',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/images/icons/app/apple-touch-icon.png',
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
        {process.env.NODE_ENV === 'development' && (
          <Script
            src="//unpkg.com/react-grab/dist/index.global.js"
            crossOrigin="anonymous"
            strategy="beforeInteractive"
          />
        )}
        {/* JSON-LD 结构化数据 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: STRUCTURED_DATA_JSON,
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
          href="/images/icons/app/icon-512x512-opaque.png"
        />
        <link
          rel="apple-touch-icon"
          href="/images/icons/app/apple-touch-icon.png"
        />
        <link rel="icon" href="/images/icons/app/favicon.ico" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        {/* theme-color 由客户端 useThemeColor hook 动态管理，避免 RSC 静态标签覆盖 */}
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
      </head>
      <body className="select-none [&_[contenteditable]]:select-text [&_input]:select-text [&_textarea]:select-text">
        <h1 className="sr-only">Brew Guide</h1>
        <noscript>
          <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h1>Brew Guide</h1>
          </div>
        </noscript>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          enableColorScheme={false}
          disableTransitionOnChange
        >
          <DataLayerProvider>
            <TauriDragRegion />
            <DevTools />
            <div className="h-dvh overflow-hidden bg-neutral-50 dark:bg-neutral-900">
              <Suspense>
                <CrashDiagnosticsProvider />
                <CapacitorInit />
                <StorageInit />
                <ModalHistoryInit />
                <KeyboardManager />
              </Suspense>
              <div className="mx-auto flex h-full w-full flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
              </div>
              {!isDevelopment && <PWAUpdatePrompt />}
              <LightToast />
              <ExitToast />
            </div>
          </DataLayerProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
