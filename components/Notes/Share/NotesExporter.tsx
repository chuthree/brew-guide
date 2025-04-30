'use client'

import html2canvas from 'html2canvas'
import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import { Filesystem, Directory } from '@capacitor/filesystem'

interface NotesExporterProps {
  selectedNotes: string[]
  notesContainerRef: React.RefObject<HTMLDivElement>
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
    const selectedNoteElements: HTMLElement[] = [];
    const allNoteElements = notesContainerRef.current?.querySelectorAll('.note-item') || [];
    
    allNoteElements.forEach((el) => {
      const noteId = el.getAttribute('data-note-id');
      if (noteId && selectedNotes.includes(noteId)) {
        selectedNoteElements.push(el as HTMLElement);
      }
    });
    
    if (selectedNoteElements.length === 0) {
      onError('找不到选中的笔记元素');
      return;
    }
    
    // 获取原始容器的宽度和背景色
    const originalWidth = notesContainerRef.current?.clientWidth || 500;
    const isDarkMode = document.documentElement.classList.contains('dark');
    const backgroundColor = isDarkMode ? '#171717' : '#fafafa';
    
    // 创建临时容器，精确复制选中笔记的样式和内容
    const tempContainer = document.createElement('div');
    tempContainer.style.backgroundColor = backgroundColor;
    tempContainer.style.width = `${originalWidth}px`;
    tempContainer.style.padding = '24px 0';
    tempContainer.style.position = 'fixed';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.fontFamily = 'inherit'; // 继承当前字体
    
    // 应用深色模式类
    if (isDarkMode) {
      tempContainer.classList.add('dark');
    }
    
    // 将当前页面的样式表复制到临时容器中
    const stylesheets = Array.from(document.styleSheets);
    const styleElement = document.createElement('style');
    let cssRules = '';
    
    stylesheets.forEach(sheet => {
      try {
        const rules = sheet.cssRules || sheet.rules;
        for (let i = 0; i < rules.length; i++) {
          cssRules += rules[i].cssText + '\n';
        }
      } catch (e) {
        // 跨域样式表可能会抛出错误，忽略
        console.log('无法访问样式表:', e);
      }
    });
    
    styleElement.textContent = cssRules + `
      .dark {
        color-scheme: dark;
        --tw-text-opacity: 1;
        color: rgba(229, 229, 229, var(--tw-text-opacity));
        background-color: #171717;
      }
      
      [data-note-id] {
        border-bottom-width: 1px;
      }
      
      [data-note-id]:last-child {
        border-bottom-width: 0;
      }
      
      .dark [data-note-id] {
        border-color: rgba(38, 38, 38, 1);
      }
      
      [data-note-id]:not(.dark) {
        border-color: rgba(229, 229, 229, 1);
      }
      
      .note-item {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
    `;
    tempContainer.appendChild(styleElement);
    
    // 复制选中的笔记到临时容器
    selectedNoteElements.forEach(noteEl => {
      const clone = noteEl.cloneNode(true) as HTMLElement;
      
      // 移除复选框
      const checkbox = clone.querySelector('input[type="checkbox"]');
      if (checkbox && checkbox.parentElement) {
        checkbox.parentElement.remove();
      }
      
      // 移除操作按钮
      const actionMenu = clone.querySelector('.action-menu-container');
      if (actionMenu) {
        actionMenu.remove();
      }
      
      // 保留原始类名和样式
      clone.setAttribute('style', noteEl.getAttribute('style') || '');
      tempContainer.appendChild(clone);
    });
    
    document.body.appendChild(tempContainer);
    
    // 生成图片
    const canvas = await html2canvas(tempContainer, {
      scale: 2, // 提高清晰度
      backgroundColor: backgroundColor,
      logging: false,
      useCORS: true,
      allowTaint: true,
      onclone: (clonedDoc) => {
        // 在克隆的文档中应用深色模式样式
        if (isDarkMode) {
          const clonedBody = clonedDoc.body;
          clonedBody.classList.add('dark');
          
          // 为克隆的笔记元素应用正确的文本颜色
          const textElements = clonedBody.querySelectorAll('p, h1, h2, h3, h4, h5, span, div');
          textElements.forEach((el) => {
            // 保持原有的tailwind类，但确保深色模式下的颜色正确
            if (el.classList.contains('text-neutral-800')) {
              el.classList.remove('text-neutral-800');
              el.classList.add('text-neutral-100');
            } else if (el.classList.contains('text-neutral-600')) {
              el.classList.remove('text-neutral-600');
              el.classList.add('text-neutral-400');
            }
          });
          
          // 为进度条应用正确的颜色
          const progressBars = clonedBody.querySelectorAll('.bg-neutral-800');
          progressBars.forEach((el) => {
            el.classList.remove('bg-neutral-800');
            el.classList.add('bg-neutral-100');
          });
          
          const progressBackgrounds = clonedBody.querySelectorAll('.bg-neutral-200\\/50');
          progressBackgrounds.forEach((el) => {
            el.classList.remove('bg-neutral-200/50');
            el.classList.add('bg-neutral-800');
          });
        }
      }
    });
    
    // 删除临时容器
    document.body.removeChild(tempContainer);
    
    // 转换为图片
    const imageData = canvas.toDataURL('image/png');
    
    // 在移动设备上使用 Capacitor 分享
    if (Capacitor.isNativePlatform()) {
      // 保存到文件
      const timestamp = new Date().getTime();
      const fileName = `brew-notes-${timestamp}.png`;
      
      const result = await Filesystem.writeFile({
        path: fileName,
        data: imageData.split(',')[1],
        directory: Directory.Cache,
        recursive: true
      });
      
      // 分享文件
      await Share.share({
        title: '我的咖啡冲煮笔记',
        url: Capacitor.convertFileSrc(result.uri),
        dialogTitle: '分享我的咖啡冲煮笔记'
      });
    } else {
      // 在网页上下载图片
      const link = document.createElement('a');
      link.download = `brew-notes-${new Date().getTime()}.png`;
      link.href = imageData;
      link.click();
    }
    
    onSuccess('笔记已保存为图片');
  } catch (error) {
    console.error('生成笔记图片失败', error);
    onError('生成图片失败');
  } finally {
    onComplete();
  }
} 