'use client';

import { toPng } from 'html-to-image';
import { TempFileManager } from '@/lib/utils/tempFileManager';

interface BeansExporterProps {
  selectedBeans: string[];
  beansContainerRef: React.RefObject<HTMLDivElement | null>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onComplete: () => void;
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
 * 导出选中的咖啡豆为图片
 * 采用与笔记导出相同的方式 - 克隆已渲染的 DOM 元素
 */
export async function exportSelectedBeans({
  selectedBeans,
  beansContainerRef,
  onSuccess,
  onError,
  onComplete,
}: BeansExporterProps) {
  if (selectedBeans.length === 0) {
    onError('请选择至少一个咖啡豆');
    return;
  }

  try {
    // 从原始列表中找出选中的咖啡豆元素
    if (!beansContainerRef.current) {
      onError('找不到咖啡豆容器');
      return;
    }

    const allBeanElements =
      beansContainerRef.current.querySelectorAll('[data-bean-item]');

    // 创建临时容器用于导出
    const tempContainer = document.createElement('div');
    const isDarkMode = document.documentElement.classList.contains('dark');
    const backgroundColor = isDarkMode ? '#171717' : '#fafafa';

    // 设置样式
    tempContainer.style.backgroundColor = backgroundColor;
    tempContainer.style.fontFamily =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    tempContainer.style.width = '375px';
    tempContainer.style.boxSizing = 'border-box';

    if (isDarkMode) {
      tempContainer.classList.add('dark');
    }

    // 添加概要信息
    const summary = document.createElement('div');
    summary.style.cssText = `
      padding: 24px 24px 12px 24px;
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.025em;
      color: ${isDarkMode ? '#f5f5f5' : '#262626'};
    `;
    summary.innerText = `共 ${selectedBeans.length} 款咖啡豆`;
    tempContainer.appendChild(summary);

    // 添加简化的器具栏
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `padding: 0 24px 24px 24px;`;
    tabBar.innerHTML = `
      <div style="border-bottom: 1px solid ${isDarkMode ? '#404040' : '#e5e5e5'};">
        <div style="font-size: 12px; font-weight: 500; color: ${isDarkMode ? '#f5f5f5' : '#262626'}; position: relative; padding-bottom: 6px; display: inline-block;">
          咖啡豆库存
          <div style="position: absolute; bottom: -1px; left: 0; right: 0; height: 1px; background-color: ${isDarkMode ? '#f5f5f5' : '#262626'};"></div>
        </div>
      </div>
    `;
    tempContainer.appendChild(tabBar);

    // 创建列表容器
    const listContainer = document.createElement('div');
    listContainer.style.cssText = `
      padding: 0 24px 24px 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    `;

    // 收集选中的咖啡豆元素
    const selectedBeanElements: {
      clone: HTMLElement;
      original: HTMLElement;
    }[] = [];

    allBeanElements.forEach(el => {
      const beanId = el.getAttribute('data-bean-item');
      if (beanId && selectedBeans.includes(beanId)) {
        selectedBeanElements.push({
          clone: el.cloneNode(true) as HTMLElement,
          original: el as HTMLElement,
        });
      }
    });

    // 处理每个咖啡豆元素
    for (let index = 0; index < selectedBeanElements.length; index++) {
      const { clone, original } = selectedBeanElements[index];

      // 移除复选框
      const checkbox = clone.querySelector('input[type="checkbox"]');
      if (checkbox) {
        // 找到包含复选框的容器并移除
        const checkboxContainer = checkbox.closest('.flex.shrink-0');
        if (checkboxContainer) {
          checkboxContainer.remove();
        } else {
          checkbox.remove();
        }
      }

      // 处理 Next.js Image 组件 - 转换为原生 img 元素
      const cloneImages = clone.querySelectorAll('img[src], img[srcSet]');
      const originalImages = original.querySelectorAll('img[src], img[srcSet]');

      cloneImages.forEach((img, imgIndex) => {
        const imgElement = img as HTMLImageElement;
        const parentContainer = imgElement.parentElement;

        // 获取原始元素中对应图片的父容器尺寸
        const originalImg = originalImages[imgIndex] as
          | HTMLImageElement
          | undefined;
        const originalParent = originalImg?.parentElement;

        // 创建新的 img 元素
        const newImg = document.createElement('img');

        // 复制基本属性
        if (imgElement.src) newImg.src = imgElement.src;
        if (imgElement.alt) newImg.alt = imgElement.alt;

        // 给父容器设置明确的内联尺寸
        if (parentContainer && originalParent) {
          const originalRect = originalParent.getBoundingClientRect();
          parentContainer.style.width = `${originalRect.width}px`;
          parentContainer.style.height = `${originalRect.height}px`;
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

      // 移除剩余量的下划线交互样式（导出模式）
      const remainingEditArea = clone.querySelector(
        '[data-click-area="remaining-edit"]'
      );
      if (remainingEditArea) {
        const underlinedSpan = remainingEditArea.querySelector(
          '.border-b.border-dashed'
        );
        if (underlinedSpan) {
          underlinedSpan.classList.remove(
            'border-b',
            'border-dashed',
            'border-neutral-400',
            'dark:border-neutral-600'
          );
        }
      }

      // 确保深色模式下的文本颜色正确
      if (isDarkMode) {
        const textElements = clone.querySelectorAll(
          'p, h1, h2, h3, h4, h5, span, div'
        );
        textElements.forEach((el: Element) => {
          if (el.classList.contains('text-neutral-800')) {
            el.classList.remove('text-neutral-800');
            el.classList.add('text-neutral-100');
          } else if (el.classList.contains('text-neutral-600')) {
            el.classList.remove('text-neutral-600');
            el.classList.add('text-neutral-400');
          }
        });
      }

      listContainer.appendChild(clone);
    }

    tempContainer.appendChild(listContainer);

    // 等待所有图片加载完成
    await waitForImages(tempContainer);

    // 获取用户名
    const { Storage } = await import('@/lib/core/storage');
    const settingsStr = await Storage.get('brewGuideSettings');
    let username = '';
    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        username = settings.username?.trim() || '';
      } catch (e) {
        console.error('解析用户设置失败', e);
      }
    }

    // 添加底部标记
    const footer = document.createElement('div');
    footer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px 24px 24px 24px;
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 0.025em;
      color: ${isDarkMode ? '#737373' : '#a3a3a3'};
    `;

    // 签名：(@用户名 · Brew Guide App)
    const signatureText = username
      ? `(@${username} · Brew Guide App)`
      : '(Brew Guide App)';
    footer.innerText = signatureText;

    tempContainer.appendChild(footer);

    // 添加到文档以便能够导出
    document.body.appendChild(tempContainer);

    // 确保样式计算完成
    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => setTimeout(resolve, 100));

    // 生成图片
    const imageData = await toPng(tempContainer, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: backgroundColor,
      filter: node => {
        if (node instanceof HTMLElement) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
        }
        return true;
      },
    });

    // 删除临时容器
    document.body.removeChild(tempContainer);

    // 分享图片
    await TempFileManager.shareImageFile(imageData, 'coffee-beans-share', {
      title: '',
      text: '',
      dialogTitle: '',
    });

    onSuccess('咖啡豆已保存为图片');
  } catch (error) {
    console.error('生成咖啡豆图片失败:', error);

    let errorMessage = '生成图片失败';
    if (error instanceof Error) {
      if (error.message.includes('canvas')) {
        errorMessage = '图片渲染失败，请检查咖啡豆图片是否正常显示';
      } else if (error.message.includes('network')) {
        errorMessage = '网络错误，请检查图片是否能正常加载';
      } else if (error.message.includes('timeout')) {
        errorMessage = '图片加载超时，请重试';
      }
    }

    onError(errorMessage);
  } finally {
    onComplete();
  }
}
