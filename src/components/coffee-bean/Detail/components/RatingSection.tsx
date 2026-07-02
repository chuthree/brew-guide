'use client';

import React from 'react';
import type { CoffeeBean } from '@/types/app';
import type { BeanRatingInfo } from '@/lib/utils/beanRatingUtils';

interface RatingSectionProps {
  bean: CoffeeBean | null;
  isAddMode: boolean;
  showBeanRating: boolean;
  ratingInfo: BeanRatingInfo | null;
  onOpenRatingModal: () => void;
}

const RatingSection: React.FC<RatingSectionProps> = ({
  bean,
  isAddMode,
  showBeanRating,
  ratingInfo,
  onOpenRatingModal,
}) => {
  // 不在添加模式下显示，且需要满足显示条件
  if (isAddMode) return null;
  if (!showBeanRating && !ratingInfo) {
    return null;
  }

  return (
    <>
      {ratingInfo && ratingInfo.rating > 0 ? (
        // 已有评价（手动或自动），显示评价内容
        <div className="cursor-pointer space-y-3" onClick={onOpenRatingModal}>
          {/* 评分 */}
          <div className="flex items-start">
            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              评分
            </div>
            <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
              {ratingInfo.isAutoCalculated && (
                <span className="mr-0.5 opacity-30">≈</span>
              )}
              {ratingInfo.rating} / 5
            </div>
          </div>

          {/* 评价备注 - 仅手动评分时显示 */}
          {!ratingInfo.isAutoCalculated &&
            bean?.ratingNotes &&
            bean.ratingNotes.trim() && (
              <div className="flex items-start">
                <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  评价
                </div>
                <div className="text-xs font-medium whitespace-pre-line text-neutral-800 dark:text-neutral-100">
                  {bean?.ratingNotes}
                </div>
              </div>
            )}
        </div>
      ) : (
        // 无评价，显示添加提示
        <div className="flex items-start">
          <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            评分
          </div>
          <button
            type="button"
            onClick={onOpenRatingModal}
            className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400"
          >
            + 添加评价
          </button>
        </div>
      )}
    </>
  );
};

export default RatingSection;
