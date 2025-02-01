import { Metadata } from 'next'
import ThemeProvider from './theme-provider'
import './globals.css'

// SEO constants
export const metadata: Metadata = {
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
  openGraph: {
    title: '手冲咖啡冲煮指南',
    description:
      '专业的手冲咖啡冲煮指南，包含手冲咖啡的详细步骤、参数配置和计时器。提供清爽果香和醇厚平衡两种风味的冲煮方案，帮助您在家制作出完美的手冲咖啡。',
    url: 'https://chu3.dev/pour-over-recipes',
    siteName: "Chu3's Coffee Guide",
    // images: [
    //     {
    //         url: 'https://chu3.dev/images/coffee-guide-og.jpg',
    //         width: 1200,
    //         height: 630,
    //         alt: 'V60 手冲咖啡指南',
    //     },
    // ],
    locale: 'zh_CN',
    type: 'article',
  },
  twitter: {
    card: 'summary_large_image',
    title: '咖啡冲煮指南 | 手冲咖啡冲煮指南',
    description:
      '专业的咖啡冲煮指南，包含手冲咖啡的详细步骤、参数配置和计时器。',
    // images: ['https://chu3.dev/images/coffee-guide-og.jpg'],
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
    icon: '/triangle.svg',
    shortcut: '/triangle.svg',
    apple: '/triangle.svg',
    other: {
      rel: 'apple-touch-icon-precomposed',
      url: '/triangle.svg',
    },
  },
  // verification: {
  //     google: 'your-google-verification-code', // 如果有 Google Search Console 验证码，请替换
  // },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
