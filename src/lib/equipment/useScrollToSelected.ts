/**
 * 滚动相关的自定义Hook
 * 统一管理滚动到选中项的逻辑，避免重复代码
 */

import { useCallback, useLayoutEffect, useState } from 'react';

export interface UseScrollToSelectedOptions {
  selectedItem: string | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  itemCount: number;
}

export interface UseScrollToSelectedReturn {
  scrollToSelected: () => void;
}

/**
 * 滚动到选中项的Hook
 * 处理滚动容器中选中项的居中显示
 */
export function useScrollToSelected({
  selectedItem,
  containerRef,
  itemCount,
}: UseScrollToSelectedOptions): UseScrollToSelectedReturn {
  const scrollToSelected = useCallback(() => {
    if (!containerRef.current || !selectedItem) return;

    const selectedElement = Array.from(
      containerRef.current.querySelectorAll<HTMLElement>('[data-tab]')
    ).find(element => element.dataset.tab === selectedItem);
    if (!selectedElement) return;

    const container = containerRef.current;
    // Desktop equipment lists use normal vertical flow, not horizontal scrolling.
    const { overflowX } = getComputedStyle(container);
    if (overflowX !== 'auto' && overflowX !== 'scroll') return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = selectedElement.getBoundingClientRect();

    // 计算元素相对于容器的位置
    const elementLeft =
      elementRect.left - containerRect.left + container.scrollLeft;
    const elementWidth = elementRect.width;
    const containerWidth = containerRect.width;

    // 计算目标滚动位置（将选中项居中）
    const targetScrollLeft = elementLeft - (containerWidth - elementWidth) / 2;

    // 直接定位，避免快速切换时多个平滑滚动相互打断。
    container.scrollTo({
      left: Math.max(0, targetScrollLeft),
      behavior: 'instant',
    });
  }, [containerRef, selectedItem]);

  // 当选中项变化时自动滚动
  useLayoutEffect(() => {
    scrollToSelected();
    window.addEventListener('resize', scrollToSelected);
    return () => window.removeEventListener('resize', scrollToSelected);
  }, [scrollToSelected, itemCount]);

  return { scrollToSelected };
}

export interface UseScrollBorderOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  itemCount: number;
}

export interface UseScrollBorderReturn {
  showLeftBorder: boolean;
  showRightBorder: boolean;
}

/**
 * 滚动边框指示器的Hook
 * 处理滚动容器边框渐变效果的显示逻辑
 */
export function useScrollBorder({
  containerRef,
  itemCount,
}: UseScrollBorderOptions): UseScrollBorderReturn {
  const [showLeftBorder, setShowLeftBorder] = useState(false);
  const [showRightBorder, setShowRightBorder] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;

      // 左边框：当向右滚动时显示
      setShowLeftBorder(scrollLeft > 0);

      // 右边框：当还能继续向右滚动时显示
      const maxScrollLeft = scrollWidth - clientWidth;
      const canScrollRight =
        maxScrollLeft > 0 && scrollLeft < maxScrollLeft - 1;
      setShowRightBorder(canScrollRight);
    };

    handleScroll();
    const observer = new ResizeObserver(handleScroll);
    observer.observe(container);
    for (const child of container.children) observer.observe(child);

    container.addEventListener('scroll', handleScroll);
    window.addEventListener('resize', handleScroll);

    return () => {
      observer.disconnect();
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [itemCount, containerRef]);

  return { showLeftBorder, showRightBorder };
}
