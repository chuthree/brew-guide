'use client';

import { useEffect, useState } from 'react';

/**
 * 轻量级提示组件
 * 设计理念：
 * - 底部居中显示，符合移动端用户习惯
 * - 简洁的文本提示，无复杂UI元素
 * - 原生CSS过渡效果，无需动画库依赖
 * - 自动消失
 */

// 提示显示时长（毫秒）
const TOAST_DURATION = 2000;

interface ToastOptions {
  type?: 'success' | 'error' | 'info' | 'warning';
  title: string;
  duration?: number;
}

let showLightToastFn: ((options: ToastOptions) => void) | null = null;

export function showToast(options: ToastOptions) {
  if (showLightToastFn) {
    showLightToastFn(options);
  }
}

export function LightToast() {
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [currentToast, setCurrentToast] = useState<ToastOptions | null>(null);

  useEffect(() => {
    showLightToastFn = (options: ToastOptions) => {
      setCurrentToast(options);
      setShouldRender(true);
      // 延迟一帧以触发过渡效果
      requestAnimationFrame(() => {
        setVisible(true);
      });
    };

    return () => {
      showLightToastFn = null;
    };
  }, []);

  useEffect(() => {
    if (visible && currentToast) {
      const duration = currentToast.duration || TOAST_DURATION;
      const timer = setTimeout(() => {
        setVisible(false);
        // 等待过渡动画完成后再移除元素
        setTimeout(() => {
          setShouldRender(false);
          setCurrentToast(null);
        }, 200);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible, currentToast]);

  if (!shouldRender || !currentToast) return null;

  // 根据类型获取小圆点颜色
  const getDotColor = () => {
    switch (currentToast.type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] left-1/2 z-[9999]"
      style={{
        transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, 10px)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.2s ease-out',
      }}
    >
      <div className="max-w-[280px] rounded-full border border-neutral-200 bg-white/95 px-5 py-3 text-sm font-medium whitespace-nowrap text-neutral-900 shadow-lg shadow-neutral-200/50 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/90 dark:text-white dark:shadow-black/20">
        <div className="flex items-center justify-center gap-2">
          <div className={`h-2 w-2 rounded-full ${getDotColor()}`} />
          <span>{currentToast.title}</span>
        </div>
      </div>
    </div>
  );
}
