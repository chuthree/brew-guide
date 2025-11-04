import { Metadata, Viewport } from 'next';
import { ThemeProvider } from 'next-themes';
// 导入polyfill库以增强浏览器兼容性
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script';
import localFont from 'next/font/local';
import { LightToast } from '@/components/common/feedback/LightToast';
import { ExitToast } from '@/components/common/feedback/ExitToast';
import '@/styles/base/globals.css';
import KeyboardManager from '@/components/layout/KeyboardManager';
import { Suspense } from 'react';
import CapacitorInit from '@/providers/CapacitorProvider';
import StorageInit from '@/providers/StorageProvider';
import '@/lib/chunk-error-handler';

import { BaiduAnalytics } from '@/components/common/BaiduAnalytics';

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
  description:
    '好用的咖啡小工具，包含详细冲煮步骤、参数配置和计时器。记录咖啡豆信息，轻松冲煮完美咖啡。',
  keywords: [
    '手冲咖啡冲煮',
    '咖啡计时器',
    'V60',
    '手冲咖啡',
    '手冲咖啡计时器',
    '手冲咖啡教程',
    '手冲咖啡配比',
    '手冲咖啡萃取',
    'brewguide',
    'Brew Guide',
    '咖啡小工具',
    '咖啡豆记录',
    '咖啡冲煮参数',
    '精品咖啡',
    '咖啡风味',
    '咖啡器材',
  ],
  manifest: '/manifest.json',
  alternates: {
    canonical: 'https://coffee.chu3.top/',
  },
  openGraph: {
    title: 'Brew Guide - 咖啡小工具',
    description:
      '好用的咖啡小工具，包含详细冲煮步骤、参数配置和计时器。记录咖啡豆信息，轻松冲煮完美咖啡。',
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
    description:
      '好用的咖啡小工具，包含详细冲煮步骤、参数配置和计时器。记录咖啡豆信息，轻松冲煮完美咖啡。',
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
    title: 'Brew Guide 咖啡冲煮',
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
        <meta
          name="theme-color"
          content="#fafafa"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="theme-color"
          content="#171717"
          media="(prefers-color-scheme: dark)"
        />
        {/* 百度统计代码 */}
        <BaiduAnalytics />
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
          <Script id="sw-register" strategy="afterInteractive">
            {`
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
            `}
          </Script>
        )}
      </head>
      <body className="fixed inset-0 overflow-hidden bg-neutral-50 dark:bg-neutral-900">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Suspense>
            <CapacitorInit />
            <StorageInit />
            <KeyboardManager />
          </Suspense>
          <div className="mx-auto h-full w-full max-w-[500px] overflow-hidden">
            {children}
          </div>
          <LightToast />
          <ExitToast />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
