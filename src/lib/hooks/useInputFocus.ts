'use client';

import { useCallback, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

type FocusableInput = HTMLInputElement | HTMLTextAreaElement;

const focusElement = (element: FocusableInput | null) => {
  if (!element || typeof document === 'undefined') return;
  if (document.activeElement === element) return;
  element.focus({ preventScroll: true });
};

/**
 * 统一输入框聚焦行为：
 * 1) 点击触发时同步渲染并立即聚焦（兼容移动端）
 * 2) 下一帧重试一次，覆盖动画/挂载时序
 */
export function useInputFocus<T extends FocusableInput>(enabled = false) {
  const inputRef = useRef<T>(null);

  const focusNow = useCallback(() => {
    focusElement(inputRef.current);
  }, []);

  const focusWithFallback = useCallback(() => {
    focusNow();
    if (typeof window === 'undefined') return () => {};

    const rafId = window.requestAnimationFrame(() => {
      focusNow();
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [focusNow]);

  const activateAndFocus = useCallback(
    (activate: () => void) => {
      flushSync(() => {
        activate();
      });
      focusWithFallback();
    },
    [focusWithFallback]
  );

  useEffect(() => {
    if (!enabled) return;
    return focusWithFallback();
  }, [enabled, focusWithFallback]);

  return {
    inputRef,
    focusNow,
    focusWithFallback,
    activateAndFocus,
  };
}
