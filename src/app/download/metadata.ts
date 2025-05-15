import { Metadata } from 'next'

// 下载页面的元数据配置，用于 SEO 优化
export const metadata: Metadata = {
  title: 'Brew Guide 下载 - 咖啡小工具',
  description: '下载Brew Guide咖啡小工具，获取详细冲煮步骤、参数配置和计时器。记录咖啡豆信息，轻松冲煮完美咖啡。',
  keywords: ['Brew Guide下载', '咖啡小工具', '手冲咖啡应用', '咖啡计时器下载', '咖啡豆管理工具'],
  alternates: {
    canonical: 'https://coffee.chu3.top/download',
  },
  openGraph: {
    title: 'Brew Guide App下载 - 咖啡小工具',
    description: '下载Brew Guide咖啡小工具，获取详细冲煮步骤、参数配置和计时器。记录咖啡豆信息，轻松冲煮完美咖啡。',
    url: 'https://coffee.chu3.top/download',
    type: 'website',
    images: [
      {
        url: 'https://coffee.chu3.top/images/content/brewing.png',
        width: 300,
        height: 600,
        alt: 'Brew Guide App 界面预览',
      }
    ],
  }
} 