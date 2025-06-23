'use client'

import { toPng } from 'html-to-image'
import { TempFileManager } from '@/lib/utils/tempFileManager'

interface StatsExporterProps {
  statsContainerRef: React.RefObject<HTMLDivElement | null>
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onComplete: () => void
}

/**
 * 统计数据导出组件，专门用于处理将统计视图导出为图片
 */
export async function exportStatsView({
  statsContainerRef,
  onSuccess,
  onError,
  onComplete
}: StatsExporterProps) {
  try {
    // 检查容器是否存在
    if (!statsContainerRef.current) {
      onError('找不到统计视图容器');
      return;
    }
    
    // 获取当前主题和背景色
    const isDarkMode = document.documentElement.classList.contains('dark');
    const backgroundColor = isDarkMode ? '#171717' : '#fafafa';
    
    // 使用html-to-image直接从原始容器生成PNG
    const imageData = await toPng(statsContainerRef.current, {
      quality: 1,
      pixelRatio: 3,
      backgroundColor: backgroundColor,
      filter: (node) => {
        // 过滤掉按钮元素
        return node.tagName !== 'BUTTON';
      }
    });
    
    // 使用统一的临时文件管理器分享图片
    await TempFileManager.shareImageFile(
      imageData,
      'coffee-beans-stats',
      {
        title: '我的咖啡豆统计数据',
        text: '我的咖啡豆统计数据',
        dialogTitle: '分享我的咖啡豆统计数据'
      }
    );
    
    onSuccess('统计数据已保存为图片');
  } catch (error) {
    console.error('生成统计图片失败', error);
    onError('生成图片失败');
  } finally {
    onComplete();
  }
} 