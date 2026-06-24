'use client';

import React, { useEffect, useRef, useCallback } from 'react';

export interface StatsExplanation {
  title: string;
  value: string;
  rows?: {
    label: string;
    value: string | number;
  }[];
  formula?: string;
  dataSource?: {
    label: string;
    value: string | number;
  }[];
  note?: string;
}

interface StatsExplainerProps {
  explanation: StatsExplanation | null;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

const STATS_BLOCK_SELECTOR = '[data-stats-block]';

const getEventTarget = (event: Event): Element | null => {
  return event.target instanceof Element ? event.target : null;
};

const StatsExplainer: React.FC<StatsExplainerProps> = ({
  explanation,
  onClose,
  anchorRect,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const outsideTouchPointerIdRef = useRef<number | null>(null);
  const isOpen = explanation !== null && anchorRect !== null;

  // 计算位置
  const calculatePosition = useCallback((rect: DOMRect) => {
    const popoverWidth = 200;
    const popoverHeight = 188;
    const padding = 12;
    const arrowSize = 6;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const anchorCenterX = rect.left + rect.width / 2;

    let left = anchorCenterX - popoverWidth / 2;
    let isAbove = false;

    if (left < padding) {
      left = padding;
    } else if (left + popoverWidth > viewportWidth - padding) {
      left = viewportWidth - popoverWidth - padding;
    }

    let arrowLeft = anchorCenterX - left;
    arrowLeft = Math.max(12, Math.min(popoverWidth - 12, arrowLeft));

    let top = rect.bottom + arrowSize;

    if (top + popoverHeight > viewportHeight - padding) {
      top = rect.top - popoverHeight - arrowSize;
      isAbove = true;
    }

    return { top, left, arrowLeft, isAbove };
  }, []);

  // 统一处理弹层外部交互：统计卡片点击由卡片自身负责切换，其他外部触碰直接关闭。
  useEffect(() => {
    if (!isOpen) return;

    const isInsidePopover = (event: Event) => {
      const popover = popoverRef.current;
      if (!popover) return false;

      return event.composedPath().includes(popover);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (isInsidePopover(event)) {
        outsideTouchPointerIdRef.current = null;
        return;
      }

      outsideTouchPointerIdRef.current =
        event.pointerType === 'touch' ? event.pointerId : null;

      const target = getEventTarget(event);
      if (target?.closest(STATS_BLOCK_SELECTOR)) return;

      onClose();
    };

    const handleScroll = (event: Event) => {
      if (isInsidePopover(event)) return;

      onClose();
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (outsideTouchPointerIdRef.current !== event.pointerId) return;

      outsideTouchPointerIdRef.current = null;
      onClose();
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (outsideTouchPointerIdRef.current !== event.pointerId) return;

      outsideTouchPointerIdRef.current = null;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointercancel', handlePointerCancel, true);
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('scroll', handleScroll, {
      capture: true,
      passive: true,
    });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointercancel', handlePointerCancel, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('scroll', handleScroll, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!explanation || !anchorRect) return null;

  const position = calculatePosition(anchorRect);
  const rows = explanation.rows ?? explanation.dataSource ?? [];

  return (
    <div
      ref={popoverRef}
      className="fixed z-50"
      style={{
        top: position.top,
        left: position.left,
        opacity: 1,
        transform: 'translateY(0)',
        transition: 'opacity 0.12s ease-out, transform 0.12s ease-out',
      }}
    >
      {/* 箭头 */}
      <div
        className={`absolute ${position.isAbove ? '-bottom-1.5' : '-top-1.5'}`}
        style={{ left: position.arrowLeft, transform: 'translateX(-50%)' }}
      >
        <div
          className={`h-3 w-3 rotate-45 border bg-white dark:bg-neutral-900 ${
            position.isAbove
              ? 'border-t-0 border-l-0 border-neutral-200/50 dark:border-neutral-700'
              : 'border-r-0 border-b-0 border-neutral-200/50 dark:border-neutral-700'
          }`}
        />
      </div>

      {/* 卡片 */}
      <div className="w-[200px] rounded-lg border border-neutral-200/50 bg-white shadow-lg shadow-black/5 dark:border-neutral-700 dark:bg-neutral-900 dark:shadow-black/20">
        <div className="space-y-1.5 px-3 py-2.5">
          {/* 公式 */}
          {explanation.formula && (
            <div className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              {explanation.formula}
            </div>
          )}

          {/* 分隔线 */}
          {explanation.formula && rows.length > 0 && (
            <div className="h-px bg-neutral-100 dark:bg-neutral-800" />
          )}

          {/* 数据来源 */}
          {explanation.dataSource && (
            <div className="space-y-0.5">
              {explanation.dataSource.map(item => (
                <div
                  key={item.label}
                  className="flex items-center justify-between text-[11px]"
                >
                  <span className="text-neutral-400 dark:text-neutral-500">
                    {item.label}
                  </span>
                  <span className="font-medium text-neutral-600 tabular-nums dark:text-neutral-300">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 豆种补充 */}
          {explanation.rows && explanation.rows.length > 0 && (
            <>
              <div className="h-px bg-neutral-100 dark:bg-neutral-800" />
              <div className="space-y-0.5">
                {explanation.rows.map(item => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="text-neutral-400 dark:text-neutral-500">
                      {item.label}
                    </span>
                    <span className="font-medium text-neutral-700 tabular-nums dark:text-neutral-200">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 备注 */}
          {explanation.note && (
            <>
              <div className="h-px bg-neutral-100 dark:bg-neutral-800" />
              <div className="text-[10px] leading-relaxed text-neutral-400 dark:text-neutral-500">
                <span className="mr-1">&gt;</span>
                {explanation.note}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsExplainer;
