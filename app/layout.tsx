import { Metadata, Viewport } from 'next'
import { ThemeProvider } from 'next-themes'
import PWAPrompt from '@/components/PWAPrompt'
import { Analytics } from '@vercel/analytics/next';
import Script from 'next/script'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import { ToastProvider } from '@/components/GlobalToast'
import './globals.css'
import { KeyboardManager } from '@/app/components/KeyboardManager'

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
    <html lang="zh" suppressHydrationWarning style={{
      '--font-sans': GeistSans.style.fontFamily,
      '--font-mono': GeistMono.style.fontFamily,
    } as React.CSSProperties}>
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
      <body className="bg-neutral-50 dark:bg-neutral-900 fixed inset-0 overflow-hidden">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ToastProvider>
            <KeyboardManager />
            <div className="h-full w-full overflow-hidden">
              {children}
            </div>
            <PWAPrompt />
          </ToastProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
