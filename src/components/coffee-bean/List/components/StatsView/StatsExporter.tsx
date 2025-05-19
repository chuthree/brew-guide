'use client'

import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { toPng } from 'html-to-image'

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
    
    // 在移动设备上使用Capacitor分享
    if (Capacitor.isNativePlatform()) {
      const timestamp = new Date().getTime();
      const fileName = `coffee-beans-stats-${timestamp}.png`;
      
      // 处理base64数据
      const base64Data = imageData.split(',')[1];
      
      // 写入文件
      await Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: Directory.Cache,
        recursive: true
      });
      
      // 获取文件URI
      const uriResult = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache
      });
      
      // 分享文件
      await Share.share({
        title: '我的咖啡豆统计数据',
        text: '我的咖啡豆统计数据',
        files: [uriResult.uri],
        dialogTitle: '分享我的咖啡豆统计数据'
      });
    } else {
      // 在网页上下载图片
      const link = document.createElement('a');
      link.download = `coffee-beans-stats-${new Date().getTime()}.png`;
      link.href = imageData;
      link.click();
    }
    
    onSuccess('统计数据已保存为图片');
  } catch (error) {
    console.error('生成统计图片失败', error);
    onError('生成图片失败');
  } finally {
    onComplete();
  }
} 