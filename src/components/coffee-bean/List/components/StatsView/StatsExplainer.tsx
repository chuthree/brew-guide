'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

export interface StatsExplanation {
  title: string;
  value: string;
  formula: string;
  dataSource: {
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

const StatsExplainer: React.FC<StatsExplainerProps> = ({
  explanation,
  onClose,
  anchorRect,
}) => {
  const [displayState, setDisplayState] = useState<
    'hidden' | 'entering' | 'visible' | 'leaving'
  >('hidden');
  const [currentData, setCurrentData] = useState<{
    explanation: StatsExplanation;
    anchorRect: DOMRect;
  } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 计算位置
  const calculatePosition = useCallback((rect: DOMRect) => {
    const popoverWidth = 200;
    const popoverHeight = 120;
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

  // 处理显示/隐藏
  useEffect(() => {
    if (explanation && anchorRect) {
      // 有新数据要显示
      if (displayState === 'hidden') {
        // 直接进入
        setCurrentData({ explanation, anchorRect });
        setDisplayState('entering');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setDisplayState('visible');
          });
        });
      } else if (displayState === 'visible' || displayState === 'entering') {
        // 直接切换内容（不做动画）
        setCurrentData({ explanation, anchorRect });
      }
    } else {
      // 需要关闭
      if (displayState === 'visible' || displayState === 'entering') {
        setDisplayState('leaving');
        setTimeout(() => {
          setDisplayState('hidden');
          setCurrentData(null);
        }, 120);
      }
    }
  }, [explanation, anchorRect, displayState]);

  // 点击外部关闭
  useEffect(() => {
    if (displayState === 'hidden') return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (popoverRef.current?.contains(target)) return;
      if (target.closest('[data-stats-block]')) return;
      onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [displayState, onClose]);

  if (displayState === 'hidden' || !currentData) return null;

  const position = calculatePosition(currentData.anchorRect);
  const isVisible = displayState === 'visible';

  return (
    <div
      ref={popoverRef}
      className="fixed z-50"
      style={{
        top: position.top,
        left: position.left,
        opacity: isVisible ? 1 : 0,
        transform: isVisible
          ? 'translateY(0)'
          : position.isAbove
            ? 'translateY(4px)'
            : 'translateY(-4px)',
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
          <div className="text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
            {currentData.explanation.formula}
          </div>

          {/* 分隔线 */}
          <div className="h-px bg-neutral-100 dark:bg-neutral-800" />

          {/* 数据来源 */}
          <div className="space-y-0.5">
            {currentData.explanation.dataSource.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-neutral-400 dark:text-neutral-500">
                  {item.label}
                </span>
                <span className="font-medium text-neutral-600 dark:text-neutral-300">
                  {item.value}
                </span>
              </div>
            ))}
          </div>

          {/* 备注 */}
          {currentData.explanation.note && (
            <>
              <div className="h-px bg-neutral-100 dark:bg-neutral-800" />
              <div className="text-[10px] leading-relaxed text-neutral-400 dark:text-neutral-500">
                <span className="mr-1">&gt;</span>
                {currentData.explanation.note}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatsExplainer;
