'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import type { FlavorDimension } from '@/lib/core/db';

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
  /** 是否开启半星精度 */
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
}) => {
  // 内部临时状态
  const [tempRating, setTempRating] = useState(rating);
  const [tempTaste, setTempTaste] = useState<Record<string, number>>(taste);
  const [showDetails, setShowDetails] = useState(false);
  // 标记用户是否手动修改过风味评分
  const [userModifiedFlavor, setUserModifiedFlavor] = useState(false);

  // 同步外部状态到内部
  useEffect(() => {
    if (isOpen) {
      setTempRating(rating);
      setTempTaste(taste);
      // 如果已有评分，直接显示详细评分
      setShowDetails(rating > 0);
      // 重置用户修改标记
      // 如果已有风味评分数据，说明用户之前修改过
      const hasTasteValues = Object.values(taste).some(value => value > 0);
      setUserModifiedFlavor(hasTasteValues);
    } else {
      // 关闭时重置状态，避免下次打开时闪烁
      setShowDetails(false);
    }
  }, [isOpen, rating, taste]);

  // 当用户设置总体评分后，立即显示详细评分（仅当风味评分开启时）
  useEffect(() => {
    if (tempRating > 0 && showFlavorRating) {
      setShowDetails(true);
    }
  }, [tempRating, showFlavorRating]);

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
              <p className="text-base font-medium text-neutral-500 dark:text-neutral-400">
                为这杯
                <span className="mx-1 text-neutral-800 dark:text-neutral-200">
                  {beanName || '这杯咖啡'}
                </span>
                评分
              </p>
              <div className="flex justify-between" data-vaul-no-drag>
                {[1, 2, 3, 4, 5].map(star => {
                  const isHalf = halfStep && tempRating === star - 0.5;
                  const isFull = star <= tempRating;
                  return (
                    <motion.button
                      key={star}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => {
                        if (halfStep) {
                          // 半星模式：1 → 0.5 → 0，其他：整星 → 半星 → 整星
                          if (star === 1 && tempRating === 0.5) {
                            setTempRating(0);
                          } else if (tempRating === star) {
                            setTempRating(star - 0.5);
                          } else {
                            setTempRating(star);
                          }
                        } else {
                          // 整星模式：再次点击1星时清零
                          if (star === 1 && tempRating === 1) {
                            setTempRating(0);
                          } else {
                            setTempRating(star);
                          }
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
            </div>
          )}

          {/* 风味评分 - 简单淡入动画 */}
          {showFlavorRating && displayDimensions.length > 0 && showDetails && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="flex flex-col gap-3"
            >
              {/* 改用 auto auto 让内容紧凑靠左对其，同时保持列对齐 */}
              <div className="grid grid-cols-[auto_auto] items-center justify-start gap-x-3 gap-y-3">
                {displayDimensions.map(dimension => {
                  const value = tempTaste[dimension.id] || 0;

                  return (
                    <React.Fragment key={dimension.id}>
                      <span
                        className="max-w-[10rem] truncate text-left text-sm font-medium text-neutral-500 dark:text-neutral-400"
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
                                    updateTasteRating(dimension.id, star - 0.5);
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
            </motion.div>
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
