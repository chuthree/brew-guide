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
    
    // 添加标题
    const title = document.createElement('h2');
    title.innerText = selectedNotes.length === 1 ? '咖啡冲煮笔记' : `${selectedNotes.length}条咖啡冲煮笔记`;
    title.style.textAlign = 'left';
    title.style.marginBottom = '8px';
    title.style.fontSize = '12px';
    title.style.color = isDarkMode ? '#f5f5f5' : '#262626';
    title.style.padding = '24px 24px 0 24px';
    
    tempContainer.appendChild(title);
    
    // 复制选中的笔记到临时容器
    const selectedNoteElements: HTMLElement[] = [];
    
    // 首先收集所有选中的笔记元素
    allNoteElements.forEach((el) => {
      const noteId = el.getAttribute('data-note-id');
      if (noteId && selectedNotes.includes(noteId)) {
        selectedNoteElements.push(el.cloneNode(true) as HTMLElement);
      }
    });
    
    // 然后处理每个笔记元素并添加到临时容器
    selectedNoteElements.forEach((clone, index) => {
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
      
      // 处理评分显示 - 在评分前添加"总体评分"字样
      const hasTasteRatings = clone.querySelector('.grid.grid-cols-2');
      if (hasTasteRatings) {
        // 有风味评分的情况，评分显示在右下角
        const ratingElement = clone.querySelector('.flex.items-baseline.justify-between div:last-child');
        if (ratingElement && ratingElement.textContent && ratingElement.textContent.includes('[') && ratingElement.textContent.includes('/5')) {
          ratingElement.textContent = `总体评分 ${ratingElement.textContent}`;
        }
      } else {
        // 没有风味评分的情况，总体评分已经有标签，不需要处理
      }
      
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
    });
    
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
    const footer = document.createElement('p');
    footer.style.textAlign = 'left';
    footer.style.marginTop = '16px';
    footer.style.fontSize = '12px';
    footer.style.color = isDarkMode ? '#a3a3a3' : '#525252';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.padding = '0 24px 24px 24px';
    
    if (username) {
      // 如果有用户名，将用户名放在左边，Brew Guide放在右边
      const usernameSpan = document.createElement('span');
      usernameSpan.innerText = `@${username}`;
      
      const appNameSpan = document.createElement('span');
      appNameSpan.innerText = '—— Brew Guide';
      
      footer.appendChild(usernameSpan);
      footer.appendChild(appNameSpan);
    } else {
      // 如果没有用户名，保持原样
      footer.innerText = '—— Brew Guide';
    }
    
    tempContainer.appendChild(footer);
    
    // 添加到文档以便能够导出
    document.body.appendChild(tempContainer);
    
    // 使用html-to-image生成PNG
    const imageData = await toPng(tempContainer, {
      quality: 1,
      pixelRatio: 5,
      backgroundColor: backgroundColor,
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
    console.error('生成笔记图片失败', error);
    onError('生成图片失败');
  } finally {
    onComplete();
  }
} 