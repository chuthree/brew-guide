'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import ElasticSlider from '@/components/common/ui/ElasticSlider';
import type { FlavorDimension } from '@/lib/data/models';

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
  /** 风味评分是否开启十分位精度 */
  tenthStep?: boolean;
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
  tenthStep = false,
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
      // 如果开启小数精度，保留小数；否则向下取整
      const syncedValue =
        halfStep || tenthStep ? tempRating : Math.floor(tempRating);

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
    tenthStep,
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

  const overallStep = tenthStep ? 0.1 : 0.5;
  const tasteStep = tenthStep ? 0.1 : halfStep ? 0.5 : 1;
  const shouldUseSlider = overallUseSlider || tenthStep;
  const formatOverallValue = useCallback((value: number) => {
    return value.toFixed(1);
  }, []);
  const formatTasteValue = useCallback(
    (value: number) => {
      return halfStep || tenthStep ? value.toFixed(1) : String(value);
    },
    [halfStep, tenthStep]
  );

  const handleConfirm = useCallback(() => {
    onRatingChange(tempRating);
    onTasteChange(tempTaste);
    onClose();
  }, [tempRating, tempTaste, onRatingChange, onTasteChange, onClose]);

  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="rating">
      <ActionDrawer.Content className="mb-4! overflow-visible">
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
              {shouldUseSlider ? (
                <>
                  <div data-vaul-no-drag>
                    <ElasticSlider
                      label="总体评分"
                      min={0}
                      max={5}
                      step={overallStep}
                      value={tempRating}
                      onValueChange={setTempRating}
                      formatValue={formatOverallValue}
                      aria-label="总体评分"
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
              {shouldUseSlider ? (
                <div className="mb-3 grid grid-cols-2 gap-3">
                  {displayDimensions.map(dimension => {
                    const value = tempTaste[dimension.id] || 0;

                    return (
                      <div key={dimension.id} data-vaul-no-drag>
                        <ElasticSlider
                          label={
                            dimension.order === 999
                              ? `${dimension.label} (已删除)`
                              : dimension.label
                          }
                          min={0}
                          max={5}
                          step={tasteStep}
                          value={value}
                          onValueChange={nextValue =>
                            updateTasteRating(dimension.id, nextValue)
                          }
                          formatValue={formatTasteValue}
                          aria-label={dimension.label}
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
