'use client';

import { useEffect, useState, useCallback } from 'react';

/**
 * Tauri 桌面端窗口拖动区域组件
 * 仅在 Tauri 环境下渲染，为 Overlay 标题栏模式提供拖动区域
 *
 * 注意：使用 startDragging API 而不是 data-tauri-drag-region，
 * 因为后者在窗口获得焦点时无法工作（这是已知的 WKWebView 限制）
 */
export default function TauriDragRegion() {
  const [isTauri, setIsTauri] = useState(false);

  useEffect(() => {
    // 检测是否在 Tauri 环境中
    const inTauri = typeof window !== 'undefined' && '__TAURI__' in window;
    setIsTauri(inTauri);

    // 为 body 添加 tauri-app class，用于 CSS 样式调整
    if (inTauri) {
      document.body.classList.add('tauri-app');
    }

    return () => {
      document.body.classList.remove('tauri-app');
    };
  }, []);

  // 使用 Tauri API 开始拖动窗口
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    // 只响应左键点击
    if (e.button !== 0) return;

    try {
      // 动态导入 Tauri API
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const currentWindow = getCurrentWindow();
      await currentWindow.startDragging();
    } catch (error) {
      console.warn('Failed to start window dragging:', error);
    }
  }, []);

  // 非 Tauri 环境不渲染
  if (!isTauri) {
    return null;
  }

  return (
    <>
      {/* 顶部拖动区域 - 覆盖标题栏位置 */}
      <div
        onMouseDown={handleMouseDown}
        className="fixed top-0 right-0 z-9999 h-8 cursor-default select-none"
        style={{
          // 在 macOS 上为红绿灯按钮留出空间（约 80px）
          left: '80px',
        }}
      />
    </>
  );
}
