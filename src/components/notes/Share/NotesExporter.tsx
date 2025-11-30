'use client';

import { toPng } from 'html-to-image';
import { TempFileManager } from '@/lib/utils/tempFileManager';

interface NotesExporterProps {
  selectedNotes: string[];
  notesContainerRef: React.RefObject<HTMLDivElement | null>;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  onComplete: () => void;
}

/**
 * 笔记导出组件，专门用于处理将选中的笔记导出为图片
 */
export async function exportSelectedNotes({
  selectedNotes,
  notesContainerRef,
  onSuccess,
  onError,
  onComplete,
}: NotesExporterProps) {
  if (selectedNotes.length === 0) {
    onError('请选择至少一条笔记');
    return;
  }

  try {
    // 首先，从原始列表中找出选中的笔记元素
    if (!notesContainerRef.current) {
      onError('找不到笔记容器');
      return;
    }

    const allNoteElements =
      notesContainerRef.current.querySelectorAll('.note-item');

    // 创建一个临时容器用于导出
    const tempContainer = document.createElement('div');
    const isDarkMode = document.documentElement.classList.contains('dark');
    const backgroundColor = isDarkMode ? '#171717' : '#fafafa';

    // 设置样式
    tempContainer.style.backgroundColor = backgroundColor;
    tempContainer.style.fontFamily =
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    if (isDarkMode) {
      tempContainer.classList.add('dark');
    }

    // 复制选中的笔记到临时容器
    const selectedNoteElements: {
      clone: HTMLElement;
      original: HTMLElement;
    }[] = [];

    // 首先收集所有选中的笔记元素（同时保存原始元素和克隆元素）
    allNoteElements.forEach(el => {
      const noteId = el.getAttribute('data-note-id');
      if (noteId && selectedNotes.includes(noteId)) {
        selectedNoteElements.push({
          clone: el.cloneNode(true) as HTMLElement,
          original: el as HTMLElement,
        });
      }
    });

    // 等待所有图片加载完成的辅助函数
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

    // 然后处理每个笔记元素并添加到临时容器
    for (let index = 0; index < selectedNoteElements.length; index++) {
      const { clone, original } = selectedNoteElements[index];

      // 移除复选框 - 保留其父级div避免影响布局
      const checkbox = clone.querySelector('input[type="checkbox"]');
      if (checkbox) {
        checkbox.remove();
      }

      // 移除操作按钮 - 替代原来的直接移除父元素的方式
      const actionMenu = clone.querySelector('.action-menu-container');
      if (actionMenu) {
        // 保留操作按钮所在的元素位置，只移除内部内容
        actionMenu.innerHTML = '';
        (actionMenu as HTMLElement).style.display = 'none';
      }

      // 处理 Next.js Image 组件 - 转换为原生 img 元素以确保在 html-to-image 中正确渲染
      // 核心思路：让图片 100% 填充，由父容器控制尺寸，而不是让图片自己决定尺寸
      const cloneImages = clone.querySelectorAll('img[src], img[srcSet]');
      const originalImages = original.querySelectorAll('img[src], img[srcSet]');

      cloneImages.forEach((img, imgIndex) => {
        const imgElement = img as HTMLImageElement;
        const parentContainer = imgElement.parentElement;

        // 获取原始元素中对应图片的父容器尺寸（原始元素在 DOM 中，可以正确获取尺寸）
        const originalImg = originalImages[imgIndex] as
          | HTMLImageElement
          | undefined;
        const originalParent = originalImg?.parentElement;

        // 创建新的 img 元素 - 不复制原有的 className
        const newImg = document.createElement('img');

        // 复制基本属性
        if (imgElement.src) newImg.src = imgElement.src;
        if (imgElement.alt) newImg.alt = imgElement.alt;

        // 给父容器设置明确的内联尺寸（从原始元素获取当前缩放后的实际尺寸）
        if (parentContainer && originalParent) {
          const originalRect = originalParent.getBoundingClientRect();
          parentContainer.style.width = `${originalRect.width}px`;
          parentContainer.style.height = `${originalRect.height}px`;
        }

        // 检查是否是相册视图中的图片（通过父元素类名判断）
        const isGalleryImage = imgElement.closest('.grid') !== null; // 相册视图使用grid布局
        const hasAspectSquare =
          parentContainer?.classList.contains('aspect-square');

        // 图片用 100% 填充父容器
        newImg.style.width = '100%';
        newImg.style.height = '100%';
        newImg.style.objectFit = 'cover';

        // 列表视图中的图片需要圆角
        if (!isGalleryImage && !hasAspectSquare) {
          newImg.style.borderRadius = '6px';
        }

        // 确保图片完全加载
        newImg.loading = 'eager';
        newImg.decoding = 'sync';

        // 替换原来的图片元素
        if (imgElement.parentNode) {
          imgElement.parentNode.replaceChild(newImg, imgElement);
        }
      });

      // 评分显示已经在界面上处理，不需要额外添加"总体评分"字样

      // 如果是最后一条笔记，移除下边框
      if (index === selectedNoteElements.length - 1) {
        clone.style.borderBottom = 'none';
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

        // 处理进度条颜色
        const progressBars = clone.querySelectorAll('.bg-neutral-800');
        progressBars.forEach((el: Element) => {
          el.classList.remove('bg-neutral-800');
          el.classList.add('bg-neutral-100');
        });

        const progressBackgrounds = clone.querySelectorAll(
          '.bg-neutral-200\\/50'
        );
        progressBackgrounds.forEach((el: Element) => {
          el.classList.remove('bg-neutral-200/50');
          el.classList.add('bg-neutral-800');
        });
      }

      tempContainer.appendChild(clone);
    }

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
    footer.style.display = 'flex';
    footer.style.alignItems = 'center';
    footer.style.justifyContent = 'center';
    footer.style.padding = '16px 24px 24px 24px';
    footer.style.fontSize = '11px';
    footer.style.fontWeight = '400';
    footer.style.letterSpacing = '0.025em';
    footer.style.color = isDarkMode ? '#737373' : '#a3a3a3';

    // 签名：(@用户名 · Brew Guide App)
    const signatureText = username
      ? `(@${username} · Brew Guide App)`
      : '(Brew Guide App)';
    footer.innerText = signatureText;

    tempContainer.appendChild(footer);

    // 添加到文档以便能够导出
    document.body.appendChild(tempContainer);

    // 使用html-to-image生成PNG
    const imageData = await toPng(tempContainer, {
      quality: 1,
      pixelRatio: 5,
      backgroundColor: backgroundColor,
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

    // 删除临时容器
    document.body.removeChild(tempContainer);

    // 使用统一的临时文件管理器分享图片
    await TempFileManager.shareImageFile(imageData, 'brew-notes', {
      title: '我的咖啡冲煮笔记',
      text: '我的咖啡冲煮笔记',
      dialogTitle: '分享我的咖啡冲煮笔记',
    });

    onSuccess('笔记已保存为图片');
  } catch (error) {
    console.error('生成笔记图片失败:', error);

    // 提供更详细的错误信息
    let errorMessage = '生成图片失败';
    if (error instanceof Error) {
      if (error.message.includes('canvas')) {
        errorMessage = '图片渲染失败，请检查图片是否正常显示';
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
