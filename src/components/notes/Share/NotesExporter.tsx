'use client'

import { toPng } from 'html-to-image'
import { TempFileManager } from '@/lib/utils/tempFileManager'

interface NotesExporterProps {
  selectedNotes: string[]
  notesContainerRef: React.RefObject<HTMLDivElement | null>
  onSuccess: (message: string) => void
  onError: (message: string) => void
  onComplete: () => void
}

/**
 * 笔记导出组件，专门用于处理将选中的笔记导出为图片
 */
export async function exportSelectedNotes({
  selectedNotes,
  notesContainerRef,
  onSuccess,
  onError,
  onComplete
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
    
    const allNoteElements = notesContainerRef.current.querySelectorAll('.note-item');
    
    // 创建一个临时容器用于导出
    const tempContainer = document.createElement('div');
    const isDarkMode = document.documentElement.classList.contains('dark');
    const backgroundColor = isDarkMode ? '#171717' : '#fafafa';
    
    // 设置样式
    tempContainer.style.backgroundColor = backgroundColor;
    tempContainer.style.maxWidth = '100%';
    tempContainer.style.width = '360px';
    tempContainer.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    
    if (isDarkMode) {
      tempContainer.classList.add('dark');
    }
    
    // 复制选中的笔记到临时容器
    const selectedNoteElements: HTMLElement[] = [];
    
    // 首先收集所有选中的笔记元素
    allNoteElements.forEach((el) => {
      const noteId = el.getAttribute('data-note-id');
      if (noteId && selectedNotes.includes(noteId)) {
        selectedNoteElements.push(el.cloneNode(true) as HTMLElement);
      }
    });
    
    // 等待所有图片加载完成的辅助函数
    const waitForImages = (element: HTMLElement): Promise<void> => {
      return new Promise((resolve) => {
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

        images.forEach((img) => {
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
      const clone = selectedNoteElements[index];
      
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
      const nextImages = clone.querySelectorAll('img[src], img[srcSet]');
      nextImages.forEach((img) => {
        const imgElement = img as HTMLImageElement;
        // 创建新的 img 元素
        const newImg = document.createElement('img');
        
        // 复制基本属性
        if (imgElement.src) newImg.src = imgElement.src;
        if (imgElement.alt) newImg.alt = imgElement.alt;
        
        // 复制样式类和内联样式
        newImg.className = imgElement.className;
        
        // 检查是否是相册视图中的图片（通过父元素类名判断）
        const isGalleryImage = imgElement.closest('.grid') !== null; // 相册视图使用grid布局
        const parentContainer = imgElement.parentElement;
        const hasAspectSquare = parentContainer?.classList.contains('aspect-square');
        
        if (isGalleryImage || hasAspectSquare) {
          // 相册视图中的图片保持其原有尺寸比例
          newImg.style.cssText = imgElement.style.cssText;
          // 确保图片能正确填充容器
          newImg.style.objectFit = 'cover';
          newImg.style.width = '100%';
          newImg.style.height = '100%';
        } else {
          // 列表视图中的图片使用固定尺寸
          newImg.style.cssText = imgElement.style.cssText;
          newImg.style.width = '56px'; // 14*4 = 56px (Tailwind的w-14)
          newImg.style.height = '56px';
          newImg.style.objectFit = 'cover';
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
        const textElements = clone.querySelectorAll('p, h1, h2, h3, h4, h5, span, div');
        textElements.forEach((el) => {
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
        progressBars.forEach((el) => {
          el.classList.remove('bg-neutral-800');
          el.classList.add('bg-neutral-100');
        });
        
        const progressBackgrounds = clone.querySelectorAll('.bg-neutral-200\\/50');
        progressBackgrounds.forEach((el) => {
          el.classList.remove('bg-neutral-200/50');
          el.classList.add('bg-neutral-800');
        });
      }
      
      tempContainer.appendChild(clone);
    }

    // 等待所有图片加载完成
    await waitForImages(tempContainer);
    
    // 获取用户名
    // const { Storage } = await import('@/lib/core/storage');
    // const settingsStr = await Storage.get('brewGuideSettings');
    // let username = '';
    // if (settingsStr) {
    //   try {
    //     const settings = JSON.parse(settingsStr);
    //     username = settings.username?.trim() || '';
    //   } catch (e) {
    //     console.error('解析用户设置失败', e);
    //   }
    // }
    
    // 添加底部标记
    // const footer = document.createElement('p');
    // footer.style.textAlign = 'left';
    // footer.style.marginTop = '16px';
    // footer.style.fontSize = '12px';
    // footer.style.color = isDarkMode ? '#a3a3a3' : '#525252';
    // footer.style.display = 'flex';
    // footer.style.justifyContent = 'center';
    // footer.style.padding = '0 24px 24px 24px';
    
    // if (username) {
    //   // 如果有用户名，将用户名放在左边，Brew Guide放在右边
    //   const usernameSpan = document.createElement('span');
    //   usernameSpan.innerText = `@${username} `;
      
    //   const appNameSpan = document.createElement('span');
    //   appNameSpan.innerText = ' —— Brew Guide';
      
    //   footer.appendChild(usernameSpan);
    //   footer.appendChild(appNameSpan);
    // } else {
    //   // 如果没有用户名，保持原样
    //   footer.innerText = '—— Brew Guide';
    // }
    
    // tempContainer.appendChild(footer);
    
    // 添加到文档以便能够导出
    document.body.appendChild(tempContainer);
    
    // 使用html-to-image生成PNG
    const imageData = await toPng(tempContainer, {
      quality: 1,
      pixelRatio: 5,
      backgroundColor: backgroundColor,
      // 添加过滤器确保不包含隐藏元素
      filter: (node) => {
        // 跳过隐藏元素
        if (node instanceof HTMLElement) {
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
        }
        return true;
      }
    });
    
    // 删除临时容器
    document.body.removeChild(tempContainer);

    // 使用统一的临时文件管理器分享图片
    await TempFileManager.shareImageFile(
      imageData,
      'brew-notes',
      {
        title: '我的咖啡冲煮笔记',
        text: '我的咖啡冲煮笔记',
        dialogTitle: '分享我的咖啡冲煮笔记'
      }
    );
    
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