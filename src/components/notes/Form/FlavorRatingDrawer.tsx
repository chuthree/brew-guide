'use client';

import React, { useState, useEffect, useCallback } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import type { FlavorDimension } from '@/lib/core/db';

// 滑块样式常量
const SLIDER_STYLES = `relative h-px w-full appearance-none bg-neutral-300 dark:bg-neutral-600 cursor-pointer touch-none
[&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none
[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-solid
[&::-webkit-slider-thumb]:border-neutral-300 [&::-webkit-slider-thumb]:bg-neutral-50
[&::-webkit-slider-thumb]:shadow-none [&::-webkit-slider-thumb]:outline-none
dark:[&::-webkit-slider-thumb]:border-neutral-600 dark:[&::-webkit-slider-thumb]:bg-neutral-900
[&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none
[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-solid
[&::-moz-range-thumb]:border-neutral-300 [&::-moz-range-thumb]:bg-neutral-50
[&::-moz-range-thumb]:shadow-none [&::-moz-range-thumb]:outline-none
dark:[&::-moz-range-thumb]:border-neutral-600 dark:[&::-moz-range-thumb]:bg-neutral-900`;

interface FlavorRatingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taste: Record<string, number>;
  onTasteChange: (taste: Record<string, number>) => void;
  displayDimensions: FlavorDimension[];
  /** 是否开启半星精度 */
  halfStep?: boolean;
}

/**
 * 风味评分抽屉组件
 * 基于 ActionDrawer 实现
 */
const FlavorRatingDrawer: React.FC<FlavorRatingDrawerProps> = ({
  isOpen,
  onClose,
  taste,
  onTasteChange,
  displayDimensions,
  halfStep = false,
}) => {
  // 内部临时状态
  const [tempTaste, setTempTaste] = useState<Record<string, number>>(taste);
  const [currentSliderValue, setCurrentSliderValue] = useState<number | null>(
    null
  );

  // 同步外部状态到内部
  useEffect(() => {
    if (isOpen) {
      setTempTaste(taste);
    }
  }, [isOpen, taste]);

  // 更新风味评分
  const updateTasteRating = useCallback((key: string, value: number) => {
    setTempTaste(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  // 滑块触摸处理
  const step = halfStep ? 0.5 : 1;

  const createSliderHandlers = useCallback(
    (key: string, currentValue: number) => ({
      onTouchStart: (e: React.TouchEvent) => {
        e.stopPropagation();
        setCurrentSliderValue(currentValue);
      },
      onTouchMove: (e: React.TouchEvent) => {
        if (currentSliderValue === null) return;
        const touch = e.touches[0];
        const target = e.currentTarget as HTMLInputElement;
        const rect = target.getBoundingClientRect();
        const percentage = Math.max(
          0,
          Math.min(1, (touch.clientX - rect.left) / rect.width)
        );
        const newValue = Math.round((percentage * 5) / step) * step;
        if (newValue !== currentSliderValue) {
          updateTasteRating(key, newValue);
          setCurrentSliderValue(newValue);
        }
      },
      onTouchEnd: () => setCurrentSliderValue(null),
    }),
    [currentSliderValue, step, updateTasteRating]
  );

  const handleConfirm = () => {
    onTasteChange(tempTaste);
    onClose();
  };

  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="flavor-rating">
      <ActionDrawer.Content className="mb-4!">
        <div className="space-y-4">
          <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
            风味评分
          </div>
          <div className="grid grid-cols-2 gap-6">
            {displayDimensions.map(dimension => {
              const value = tempTaste[dimension.id] || 0;
              const handlers = createSliderHandlers(dimension.id, value);

              return (
                <div key={dimension.id} className="relative space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                      {dimension.label}
                      {dimension.order === 999 && (
                        <span className="ml-1 text-[10px] text-neutral-400 dark:text-neutral-500">
                          (已删除)
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
                      [ {halfStep ? (value || 0).toFixed(1) : value || 0} ]
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step={step}
                    value={value || 0}
                    onChange={e =>
                      updateTasteRating(
                        dimension.id,
                        parseFloat(e.target.value)
                      )
                    }
                    onTouchStart={handlers.onTouchStart}
                    onTouchMove={handlers.onTouchMove}
                    onTouchEnd={handlers.onTouchEnd}
                    className={SLIDER_STYLES}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          取消
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={handleConfirm}>
          确定
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default FlavorRatingDrawer;
