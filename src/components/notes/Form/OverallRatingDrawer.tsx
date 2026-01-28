'use client';

import React, { useState, useEffect, useMemo } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';

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

interface OverallRatingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rating: number;
  onRatingChange: (rating: number) => void;
}

/**
 * 总体评分抽屉组件
 * 基于 ActionDrawer 实现
 */
const OverallRatingDrawer: React.FC<OverallRatingDrawerProps> = ({
  isOpen,
  onClose,
  rating,
  onRatingChange,
}) => {
  // 内部临时状态
  const [tempRating, setTempRating] = useState(rating);
  const [currentSliderValue, setCurrentSliderValue] = useState<number | null>(
    null
  );

  // 同步外部状态到内部
  useEffect(() => {
    if (isOpen) {
      setTempRating(rating);
    }
  }, [isOpen, rating]);

  // 滑块触摸处理
  const sliderHandlers = useMemo(
    () => ({
      onTouchStart: (e: React.TouchEvent) => {
        e.stopPropagation();
        setCurrentSliderValue(tempRating);
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
        const newValue = Math.round((percentage * 5) / 0.5) * 0.5;
        if (newValue !== currentSliderValue) {
          setTempRating(newValue);
          setCurrentSliderValue(newValue);
        }
      },
      onTouchEnd: () => setCurrentSliderValue(null),
    }),
    [currentSliderValue, tempRating]
  );

  const handleConfirm = () => {
    onRatingChange(tempRating);
    onClose();
  };

  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="overall-rating">
      <ActionDrawer.Content className="mb-4!">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
              总体评分
            </div>
            <div className="text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
              [ {tempRating.toFixed(1)} ]
            </div>
          </div>
          <div className="relative py-3">
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              value={tempRating}
              onChange={e => setTempRating(parseFloat(e.target.value))}
              onTouchStart={sliderHandlers.onTouchStart}
              onTouchMove={sliderHandlers.onTouchMove}
              onTouchEnd={sliderHandlers.onTouchEnd}
              className={SLIDER_STYLES}
            />
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

export default OverallRatingDrawer;
