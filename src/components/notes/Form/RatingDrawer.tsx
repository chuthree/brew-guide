'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
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

// 星星图标组件 - 移到组件外部避免重复创建
const StarIcon = React.memo(
  ({ className, halfClass }: { className?: string; halfClass?: string }) => {
    const starPath =
      'M12 2.5c.4 0 .8.2 1 .6l2.4 4.9 5.4.8c.4.1.8.4.9.8.1.4 0 .9-.3 1.2l-3.9 3.8.9 5.4c.1.4-.1.9-.4 1.1-.4.3-.8.3-1.2.1L12 18.8l-4.8 2.5c-.4.2-.9.2-1.2-.1-.4-.3-.5-.7-.4-1.1l.9-5.4-3.9-3.8c-.3-.3-.4-.8-.3-1.2.1-.4.5-.7.9-.8l5.4-.8 2.4-4.9c.2-.4.6-.6 1-.6z';
    return (
      <svg viewBox="0 0 24 24" className={className}>
        {halfClass ? (
          <>
            <defs>
              <clipPath id="leftHalf">
                <rect x="0" y="0" width="12" height="24" />
              </clipPath>
              <clipPath id="rightHalf">
                <rect x="12" y="0" width="12" height="24" />
              </clipPath>
            </defs>
            <path fill="currentColor" clipPath="url(#leftHalf)" d={starPath} />
            <path
              fill="currentColor"
              clipPath="url(#rightHalf)"
              d={starPath}
              className={halfClass}
            />
          </>
        ) : (
          <path fill="currentColor" d={starPath} />
        )}
      </svg>
    );
  }
);

StarIcon.displayName = 'StarIcon';

interface RatingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rating: number;
  onRatingChange: (rating: number) => void;
  taste: Record<string, number>;
  onTasteChange: (taste: Record<string, number>) => void;
  displayDimensions: FlavorDimension[];
  /** 风味评分是否开启半星精度 */
  halfStep?: boolean;
  /** 咖啡豆名称（用于显示"为 XXX 评分"） */
  beanName?: string;
  /** 是否显示总体评分 */
  showOverallRating?: boolean;
  /** 是否显示风味评分 */
  showFlavorRating?: boolean;
  /** 风味评分初始值是否跟随总体评分（仅在新建笔记时生效） */
  flavorFollowOverall?: boolean;
  /** 是否是新建笔记模式 */
  isAdding?: boolean;
  /** 总体评分是否使用滑块 */
  overallUseSlider?: boolean;
}

/**
 * 评分抽屉组件（合并风味评分和总体评分）
 * 基于 ActionDrawer 实现
 */
const RatingDrawer: React.FC<RatingDrawerProps> = ({
  isOpen,
  onClose,
  rating,
  onRatingChange,
  taste,
  onTasteChange,
  displayDimensions,
  halfStep = false,
  beanName,
  showOverallRating = true,
  showFlavorRating = true,
  flavorFollowOverall = false,
  isAdding = false,
  overallUseSlider = false,
}) => {
  // 内部临时状态
  const [tempRating, setTempRating] = useState(rating);
  const [tempTaste, setTempTaste] = useState<Record<string, number>>(taste);
  // 标记用户是否手动修改过风味评分
  const [userModifiedFlavor, setUserModifiedFlavor] = useState(false);
  const [currentSliderValue, setCurrentSliderValue] = useState<number | null>(
    null
  );

  // 同步外部状态到内部
  useEffect(() => {
    if (isOpen) {
      setTempRating(rating);
      setTempTaste(taste);
      // 重置用户修改标记
      // 如果已有风味评分数据，说明用户之前修改过
      const hasTasteValues = Object.values(taste).some(value => value > 0);
      setUserModifiedFlavor(hasTasteValues);
    }
  }, [isOpen, rating, taste]);

  // 🎯 实现"初始值跟随总评"功能
  // 当总体评分变化时，如果满足条件，自动同步风味评分
  useEffect(() => {
    // 条件：
    // 1) 是新建模式
    // 2) 开启了跟随设置
    // 3) 开启了风味评分显示 ⭐ 关键条件
    // 4) 用户未手动修改过风味评分
    // 5) 有风味维度
    const shouldSync =
      isAdding &&
      flavorFollowOverall &&
      showFlavorRating &&
      !userModifiedFlavor &&
      displayDimensions.length > 0;

    if (shouldSync && tempRating > 0) {
      // 将总评映射到风味评分
      // 如果开启半星精度，保留0.5；否则向下取整
      const syncedValue = halfStep ? tempRating : Math.floor(tempRating);

      // 更新所有风味维度的评分
      const syncedTaste: Record<string, number> = {};
      displayDimensions.forEach(dimension => {
        syncedTaste[dimension.id] = syncedValue;
      });
      setTempTaste(syncedTaste);
    }
  }, [
    tempRating,
    isAdding,
    flavorFollowOverall,
    showFlavorRating,
    userModifiedFlavor,
    displayDimensions,
    halfStep,
  ]);

  // 更新风味评分
  const updateTasteRating = useCallback((key: string, value: number) => {
    // 标记用户已手动修改风味评分
    setUserModifiedFlavor(true);
    setTempTaste(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const overallStep = 0.5;
  const tasteStep = halfStep ? 0.5 : 1;

  const overallSliderHandlers = useMemo(
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
        const newValue =
          Math.round((percentage * 5) / overallStep) * overallStep;
        if (newValue !== currentSliderValue) {
          setTempRating(newValue);
          setCurrentSliderValue(newValue);
        }
      },
      onTouchEnd: () => setCurrentSliderValue(null),
    }),
    [currentSliderValue, overallStep, tempRating]
  );

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
        const newValue =
          Math.round((percentage * 5) / tasteStep) * tasteStep;
        if (newValue !== currentSliderValue) {
          updateTasteRating(key, newValue);
          setCurrentSliderValue(newValue);
        }
      },
      onTouchEnd: () => setCurrentSliderValue(null),
    }),
    [currentSliderValue, tasteStep, updateTasteRating]
  );

  const handleConfirm = useCallback(() => {
    onRatingChange(tempRating);
    onTasteChange(tempTaste);
    onClose();
  }, [tempRating, tempTaste, onRatingChange, onTasteChange, onClose]);

  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="rating">
      <ActionDrawer.Content className="mb-4! max-h-[60vh] overflow-y-auto">
        <div className="space-y-3">
          {/* 总体评分 */}
          {showOverallRating && (
            <div className="flex flex-col gap-3">
              {!overallUseSlider && (
                <p className="text-base font-medium text-neutral-500 dark:text-neutral-400">
                  {beanName ? (
                    <>
                      为这杯
                      <span className="mx-1 text-neutral-800 dark:text-neutral-200">
                        {beanName}
                      </span>
                      评分
                    </>
                  ) : (
                    <>为这杯咖啡评分</>
                  )}
                </p>
              )}
              {overallUseSlider ? (
                <>
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
                      step={overallStep}
                      value={tempRating}
                      onChange={e => setTempRating(parseFloat(e.target.value))}
                      onTouchStart={overallSliderHandlers.onTouchStart}
                      onTouchMove={overallSliderHandlers.onTouchMove}
                      onTouchEnd={overallSliderHandlers.onTouchEnd}
                      className={SLIDER_STYLES}
                    />
                  </div>
                </>
              ) : (
                <div className="flex justify-between" data-vaul-no-drag>
                  {[1, 2, 3, 4, 5].map(star => {
                    const isHalf = tempRating === star - 0.5;
                    const isFull = star <= tempRating;
                    return (
                      <motion.button
                        key={star}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => {
                          // 总体评分始终支持半星：1 → 0.5 → 0，其他：整星 → 半星 → 整星
                          if (star === 1 && tempRating === 0.5) {
                            setTempRating(0);
                          } else if (tempRating === star) {
                            setTempRating(star - 0.5);
                          } else {
                            setTempRating(star);
                          }
                        }}
                        className="cursor-pointer p-2"
                        type="button"
                      >
                        <StarIcon
                          halfClass={
                            isHalf
                              ? 'text-neutral-200 dark:text-neutral-700'
                              : undefined
                          }
                          className={`h-8 w-8 ${
                            isFull || isHalf
                              ? 'text-amber-400'
                              : 'text-neutral-200 dark:text-neutral-700'
                          }`}
                        />
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 风味评分 */}
          {showFlavorRating && displayDimensions.length > 0 && (
            <div className="flex flex-col gap-3">
              {overallUseSlider ? (
                <div className="mb-3 grid grid-cols-2 gap-6">
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
                            [ {halfStep ? value.toFixed(1) : value} ]
                          </div>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="5"
                          step={tasteStep}
                          value={value}
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
              ) : (
                <div className="grid grid-cols-[auto_auto] items-center justify-start gap-x-3 gap-y-3">
                  {displayDimensions.map(dimension => {
                    const value = tempTaste[dimension.id] || 0;

                    return (
                      <React.Fragment key={dimension.id}>
                        <span
                          className="max-w-40 truncate text-left text-sm font-medium text-neutral-500 dark:text-neutral-400"
                          title={dimension.label}
                        >
                          {dimension.label}
                          {dimension.order === 999 && (
                            <span className="ml-1">(已删除)</span>
                          )}
                        </span>
                        <div className="flex gap-0.5" data-vaul-no-drag>
                          {[1, 2, 3, 4, 5].map(star => {
                            const isHalf = halfStep && value === star - 0.5;
                            const isFull = star <= value;
                            return (
                              <motion.button
                                key={star}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => {
                                  if (halfStep) {
                                    // 半星模式：1 → 0.5 → 0，其他：整星 → 半星 → 整星
                                    if (star === 1 && value === 0.5) {
                                      updateTasteRating(dimension.id, 0);
                                    } else if (value === star) {
                                      updateTasteRating(
                                        dimension.id,
                                        star - 0.5
                                      );
                                    } else {
                                      updateTasteRating(dimension.id, star);
                                    }
                                  } else {
                                    // 整星模式：再次点击1星时清零
                                    if (star === 1 && value === 1) {
                                      updateTasteRating(dimension.id, 0);
                                    } else {
                                      updateTasteRating(dimension.id, star);
                                    }
                                  }
                                }}
                                className="cursor-pointer p-1"
                                type="button"
                              >
                                <StarIcon
                                  halfClass={
                                    isHalf
                                      ? 'text-neutral-200 dark:text-neutral-700'
                                      : undefined
                                  }
                                  className={`h-6 w-6 ${
                                    isFull || isHalf
                                      ? 'text-amber-400'
                                      : 'text-neutral-200 dark:text-neutral-700'
                                  }`}
                                />
                              </motion.button>
                            );
                          })}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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

export default RatingDrawer;
