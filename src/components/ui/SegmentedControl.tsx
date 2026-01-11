'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface SegmentOption<T extends string | number | null = string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string | number | null = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  size?: 'sm' | 'md';
  equalWidth?: boolean; // 按钮是否均分宽度
}

/**
 * iOS 风格的分段控制器
 * 带滑动背景动画效果
 */
function SegmentedControl<T extends string | number | null = string>({
  options,
  value,
  onChange,
  className = '',
  size = 'md',
  equalWidth = false,
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [buttonWidths, setButtonWidths] = useState<number[]>([]);
  const [buttonOffsets, setButtonOffsets] = useState<number[]>([]);

  // 测量按钮宽度和位置
  useEffect(() => {
    if (!containerRef.current) return;

    const buttons = containerRef.current.querySelectorAll('button');
    const widths: number[] = [];
    const offsets: number[] = [];
    let offset = 4; // padding

    buttons.forEach(btn => {
      widths.push(btn.offsetWidth);
      offsets.push(offset);
      offset += btn.offsetWidth + 4; // gap
    });

    setButtonWidths(widths);
    setButtonOffsets(offsets);
  }, [options, equalWidth]);

  const selectedIndex = options.findIndex(opt => opt.value === value);
  const selectedWidth = buttonWidths[selectedIndex] || 0;
  const selectedOffset = buttonOffsets[selectedIndex] || 4;

  const heightClass = size === 'sm' ? 'h-9' : 'h-11';
  const innerHeightClass = size === 'sm' ? 'h-7' : 'h-9';
  const textClass = size === 'sm' ? 'text-xs' : 'text-xs';

  return (
    <div
      ref={containerRef}
      className={`relative flex ${heightClass} items-center gap-1 rounded-full bg-neutral-100 p-1 select-none dark:bg-neutral-800 ${className}`}
    >
      {/* 滑动背景 */}
      {selectedIndex >= 0 && selectedWidth > 0 && (
        <motion.div
          className={`absolute ${innerHeightClass} rounded-full bg-white shadow-sm dark:bg-neutral-700`}
          initial={false}
          animate={{
            width: selectedWidth,
            x: selectedOffset - 4,
          }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      {/* 按钮 */}
      {options.map(option => {
        const isSelected = option.value === value;
        return (
          <button
            key={String(option.value)}
            className={`relative z-10 flex ${innerHeightClass} ${
              equalWidth ? 'flex-1' : 'min-w-14 shrink-0'
            } items-center justify-center rounded-full px-3 ${textClass} font-medium transition-colors ${
              isSelected
                ? 'text-neutral-700 dark:text-neutral-200'
                : 'text-neutral-500 dark:text-neutral-400'
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
