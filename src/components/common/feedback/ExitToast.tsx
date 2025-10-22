'use client';

import { useEffect, useState } from 'react';

/**
 * 轻量级退出提示组件
 * 参考微信/支付宝等成熟应用的设计：
 * - 底部居中显示
 * - 简洁的文本提示
 * - 原生CSS过渡效果，无需依赖动画库
 * - 自动消失
 */

// 退出提示文案 - 参考主流应用（微信/QQ/支付宝等）
const EXIT_TOAST_TEXT = '再次返回退出';

// 提示显示时长（毫秒）
const TOAST_DURATION = 2000;

let showExitToastFn: (() => void) | null = null;

export function showExitToast() {
  if (showExitToastFn) {
    showExitToastFn();
  }
}

export function ExitToast() {
  const [visible, setVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    showExitToastFn = () => {
      setShouldRender(true);
      // 延迟一帧以触发过渡效果
      requestAnimationFrame(() => {
        setVisible(true);
      });
    };

    return () => {
      showExitToastFn = null;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setVisible(false);
        // 等待过渡动画完成后再移除元素
        setTimeout(() => {
          setShouldRender(false);
        }, 200);
      }, TOAST_DURATION);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  if (!shouldRender) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] left-1/2 z-[9999]"
      style={{
        transform: visible ? 'translate(-50%, 0)' : 'translate(-50%, 10px)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.2s ease-out',
      }}
    >
      <div className="rounded-full bg-neutral-800/95 px-5 py-3 text-sm font-medium whitespace-nowrap text-white shadow-lg backdrop-blur-sm dark:bg-neutral-200/95 dark:text-neutral-900">
        {EXIT_TOAST_TEXT}
      </div>
    </div>
  );
}
