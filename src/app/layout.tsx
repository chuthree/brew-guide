import { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
// 导入polyfill库以增强浏览器兼容性
import 'core-js/stable'
import 'regenerator-runtime/runtime'
import PWAPrompt from '@/components/PWAPrompt'
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
import { TranslationsProvider } from '@/providers/TranslationsProvider'

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
  metadataBase: new URL('https://brew-guide.vercel.app/'),
  title: 'Brew Guide',
  description: '专业的咖啡冲煮指南',
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
    title: '手冲咖啡',
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
        {isDevelopment && (
          <>
            <meta httpEquiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
            <meta httpEquiv="Pragma" content="no-cache" />
            <meta httpEquiv="Expires" content="0" />
            <Script src="/sw-dev-unregister.js" strategy="beforeInteractive" />
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
          <TranslationsProvider>
            <ToastProvider>
              <Suspense>
                <CapacitorInit />
                <StorageInit />
                <KeyboardManager />
              </Suspense>
              <div className="h-full w-full overflow-hidden max-w-[500px] mx-auto">
                {children}
              </div>
              <PWAPrompt />
            </ToastProvider>
          </TranslationsProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
