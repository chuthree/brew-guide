import { toPng } from 'html-to-image';
import { TempFileManager } from '@/lib/utils/tempFileManager';
import { ExtendedCoffeeBean } from '../types';
import { createRoot } from 'react-dom/client';
import React from 'react';
import ExportListView from './ExportListView';

interface ExportOptions {
  backgroundColor?: string;
  emptyBeans?: ExtendedCoffeeBean[];
}

/**
 * 等待所有图片加载完成的辅助函数
 */
const waitForImages = (element: HTMLElement): Promise<void> => {
  return new Promise(resolve => {
    const images = element.querySelectorAll('img');
    if (images.length === 0) {
      resolve();
      return;
    }

    let loadedCount = 0;
    const totalImages = images.length;

    const checkComplete = () => {
      loadedCount++;
      if (loadedCount === totalImages) {
        resolve();
      }
    };

    images.forEach(img => {
      if (img.complete && img.naturalWidth > 0) {
        checkComplete();
      } else {
        img.addEventListener('load', checkComplete);
        img.addEventListener('error', checkComplete);
        // 设置超时，避免无限等待
        setTimeout(checkComplete, 3000);
      }
    });
  });
};

/**
 * 处理Next.js Image组件，转换为原生img元素以确保在html-to-image中正确渲染
 * 核心思路：让图片 100% 填充，由父容器控制尺寸，而不是让图片自己决定尺寸
 */
const processImages = (container: HTMLElement) => {
  const nextImages = container.querySelectorAll('img[src], img[srcSet]');
  nextImages.forEach(img => {
    const imgElement = img as HTMLImageElement;
    const parentContainer = imgElement.parentElement;

    // 创建新的 img 元素 - 不复制原有的 className
    const newImg = document.createElement('img');

    // 复制基本属性
    if (imgElement.src) newImg.src = imgElement.src;
    if (imgElement.alt) newImg.alt = imgElement.alt;

    // 给父容器设置明确的内联尺寸（使用 getBoundingClientRect 获取当前缩放后的实际尺寸）
    if (parentContainer) {
      const parentRect = parentContainer.getBoundingClientRect();
      parentContainer.style.width = `${parentRect.width}px`;
      parentContainer.style.height = `${parentRect.height}px`;
    }

    // 图片用 100% 填充父容器
    newImg.style.width = '100%';
    newImg.style.height = '100%';
    newImg.style.objectFit = 'cover';
    newImg.style.borderRadius = '4px';

    // 确保图片完全加载
    newImg.loading = 'eager';
    newImg.decoding = 'sync';

    // 替换原来的图片元素
    if (imgElement.parentNode) {
      imgElement.parentNode.replaceChild(newImg, imgElement);
    }
  });
};

/**
 * 导出咖啡豆列表预览图 - 使用React组件渲染
 * @param filteredBeans 当前筛选的咖啡豆列表
 * @param expandedNotes 展开状态记录
 * @param userSettings 用户设置
 * @param summaryText 概要文本
 * @param options 导出选项
 */
export const exportListPreview = async (
  filteredBeans: ExtendedCoffeeBean[],
  expandedNotes: Record<string, boolean> = {},
  userSettings?: {
    dateDisplayMode?: 'date' | 'flavorPeriod' | 'agingDays';
    showFlavorInfo?: boolean;
    limitNotesLines?: boolean;
    notesMaxLines?: number;
    showTotalPrice?: boolean;
    showStatusDots?: boolean;
  },
  summaryText?: string,
  options: ExportOptions = {}
) => {
  if (filteredBeans.length === 0) {
    throw new Error('没有咖啡豆数据可导出');
  }

  const isDarkMode = document.documentElement.classList.contains('dark');
  const backgroundColor =
    options.backgroundColor || (isDarkMode ? '#171717' : '#fafafa');

  // 创建临时容器
  const tempContainer = document.createElement('div');
  tempContainer.style.cssText = `
        position: absolute;
        top: -9999px;
        left: -9999px;
        z-index: -1;
        overflow: visible;
    `;

  // 将容器添加到DOM
  document.body.appendChild(tempContainer);

  try {
    // 创建React根节点
    const root = createRoot(tempContainer);

    // 渲染ExportListView组件
    await new Promise<void>(resolve => {
      root.render(
        React.createElement(ExportListView, {
          filteredBeans,
          emptyBeans: options.emptyBeans,
          isDarkMode,
          expandedNotes,
          settings: userSettings || {
            dateDisplayMode: 'date',
            showFlavorInfo: false, // 默认不显示风味
            limitNotesLines: true,
            notesMaxLines: 1, // 默认只显示一行
            showTotalPrice: false,
            showStatusDots: true,
          },
          summaryText: summaryText || '',
        })
      );

      // 等待React渲染完成
      setTimeout(() => {
        resolve();
      }, 300);
    });

    // 获取实际渲染的组件
    const exportComponent = tempContainer.querySelector(
      '.export-list-container'
    ) as HTMLElement;
    if (!exportComponent) {
      throw new Error('无法找到导出组件');
    }

    // 处理Next.js Image组件
    processImages(exportComponent);

    // 确保组件完全渲染并等待图片加载
    await new Promise(resolve => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 100);
      });
    });

    // 等待所有图片加载完成
    await waitForImages(exportComponent);

    const rect = exportComponent.getBoundingClientRect();
    const scrollHeight = exportComponent.scrollHeight;
    const actualHeight = Math.max(rect.height, scrollHeight);

    // 生成图片
    const imageData = await toPng(exportComponent, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: backgroundColor,
      width: rect.width,
      height: actualHeight,
      style: {
        transform: 'scale(1)',
        transformOrigin: 'top left',
        overflow: 'visible',
      },
      // 添加过滤器确保不包含隐藏元素
      filter: node => {
        // 跳过隐藏元素
        if (node instanceof HTMLElement) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
        }
        return true;
      },
    });

    // 清理React根节点
    root.unmount();

    // 直接分享图片，使用简洁的分享选项
    await TempFileManager.shareImageFile(imageData, 'coffee-list-preview', {
      title: '',
      text: '',
      dialogTitle: '',
    });

    return {
      success: true,
      message: '列表预览图已生成',
    };
  } catch (error) {
    console.error('生成咖啡豆列表图片失败:', error);

    // 提供更详细的错误信息
    let errorMessage = '生成预览图失败';
    if (error instanceof Error) {
      if (error.message.includes('canvas')) {
        errorMessage = '图片渲染失败，请检查咖啡豆图片是否正常显示';
      } else if (error.message.includes('network')) {
        errorMessage = '网络错误，请检查图片是否能正常加载';
      } else if (error.message.includes('timeout')) {
        errorMessage = '图片加载超时，请重试';
      }
    }

    throw new Error(errorMessage);
  } finally {
    // 清理临时容器
    if (tempContainer.parentNode) {
      document.body.removeChild(tempContainer);
    }
  }
};
