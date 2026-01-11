'use client';

import React, { useRef } from 'react';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  showTicks?: boolean;
  tickCount?: number;
  minLabel?: string;
  maxLabel?: string;
}

/**
 * 自定义滑块组件
 * 支持胶囊形滑块、刻度显示和标签
 */
const Slider: React.FC<SliderProps> = ({
  value,
  min,
  max,
  step = 0.05,
  onChange,
  className = '',
  showTicks = true,
  tickCount = 9,
  minLabel,
  maxLabel,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const rawValue = min + percentage * (max - min);
    const steppedValue = Math.round(rawValue / step) * step;
    const finalValue = Math.max(min, Math.min(max, steppedValue));
    onChange(finalValue);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handleMove(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons > 0) {
      handleMove(e.clientX);
    }
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div
      className={`flex h-11 items-center gap-3 rounded-full bg-neutral-100 px-4 dark:bg-neutral-800 ${className}`}
    >
      {minLabel && (
        <span className="text-[10px] font-medium text-neutral-400">
          {minLabel}
        </span>
      )}

      <div
        ref={ref}
        className="relative flex h-full flex-1 cursor-pointer touch-none items-center select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        {/* 刻度背景 */}
        {showTicks && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-0.5 opacity-20">
            {Array.from({ length: tickCount }).map((_, i) => (
              <div
                key={i}
                className="h-1 w-0.5 rounded-full bg-neutral-900 dark:bg-white"
              />
            ))}
          </div>
        )}

        {/* 轨道背景 */}
        <div className="absolute inset-x-0 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />

        {/* 胶囊滑块 */}
        <div
          className="absolute top-1/2 h-3.5 w-5.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-xs dark:bg-neutral-300"
          style={{ left: `${percent}%` }}
        />
      </div>

      {maxLabel && (
        <span className="text-sm font-medium text-neutral-400">{maxLabel}</span>
      )}
    </div>
  );
};

export default Slider;
