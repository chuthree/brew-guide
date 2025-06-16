import { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
// 导入polyfill库以增强浏览器兼容性
import 'core-js/stable'
import 'regenerator-runtime/runtime'
import AppInstallAndUpdatePrompt from '@/components/app/AppInstallAndUpdatePrompt'
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script'
import { Inter } from 'next/font/google'
import { Noto_Sans_SC } from 'next/font/google'
import { GeistMono } from 'geist/font'
import { ToastProvider } from '@/components/common/feedback/GlobalToast'
import '@/styles/base/globals.css'
import KeyboardManager from '@/components/layout/KeyboardManager'
import { Suspense } from 'react'
import CapacitorInit from '@/providers/CapacitorProvider'
import StorageInit from '@/providers/StorageProvider'

import { BaiduAnalytics } from '@/components/common/BaiduAnalytics'

// 配置 Inter 字体
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

// 配置 Noto Sans SC 字体
const notoSansSC = Noto_Sans_SC({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  display: 'swap',
  variable: '--font-noto-sans-sc',
})

// SEO constants
export const metadata: Metadata = {
  metadataBase: new URL('https://coffee.chu3.top/'),
  title: 'Brew Guide - 咖啡小工具',
  description: '好用的咖啡小工具，包含详细冲煮步骤、参数配置和计时器。记录咖啡豆信息，轻松冲煮完美咖啡。',
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
      }
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
      { url: '/images/icons/app/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/images/icons/app/icon-512x512.png', sizes: '512x512', type: 'image/png' }
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
    }
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 确定当前环境
  const isDevelopment = process.env.NODE_ENV === 'development'

  return (
    <html lang="zh" suppressHydrationWarning className={`${inter.variable} ${notoSansSC.variable}`} style={{
      '--font-sans': `var(--font-noto-sans-sc), var(--font-inter), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif`,
      '--font-timer': GeistMono.style.fontFamily,
    } as React.CSSProperties}>
      <head>
        <meta name="application-name" content="Brew Guide" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Brew Guide" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-tap-highlight" content="no" />
        <link rel="apple-touch-startup-image" href="/images/icons/app/icon-512x512.png" />
        <link rel="apple-touch-icon" href="/images/icons/app/icon-192x192.png" />
        <link rel="icon" href="/images/icons/app/favicon.ico" sizes="any" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#fafafa" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#171717" media="(prefers-color-scheme: dark)" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* 百度统计代码 */}
        <BaiduAnalytics />
        {isDevelopment && (
          <>
            <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            <meta httpEquiv="Pragma" content="no-cache" />
            <meta httpEquiv="Expires" content="0" />
            <Script src="/sw-dev-unregister.js" strategy="afterInteractive" id="sw-unregister" />
          </>
        )}
      </head>
      <body className={`${inter.className} bg-neutral-50 dark:bg-neutral-900 fixed inset-0 overflow-hidden`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ToastProvider>
              <Suspense>
                <CapacitorInit />
                <StorageInit />
                <KeyboardManager />
              </Suspense>
                <div className="h-full w-full overflow-hidden max-w-[500px] mx-auto">
                {children}
                </div>
              <AppInstallAndUpdatePrompt />
            </ToastProvider>
          </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
