'use client';

import React from 'react';
import { CoffeeBean } from '@/types/app';

interface RatingSectionProps {
  bean: CoffeeBean | null;
  isAddMode: boolean;
  showBeanRating: boolean;
  onOpenRatingModal: () => void;
}

const RatingSection: React.FC<RatingSectionProps> = ({
  bean,
  isAddMode,
  showBeanRating,
  onOpenRatingModal,
}) => {
  // 不在添加模式下显示，且需要满足显示条件
  if (isAddMode) return null;
  if (!showBeanRating && !(bean?.overallRating && bean.overallRating > 0)) {
    return null;
  }

  return (
    <div className="border-t border-neutral-200/40 pt-3 dark:border-neutral-800/40">
      {bean?.overallRating && bean.overallRating > 0 ? (
        // 已有评价，显示评价内容
        <div className="cursor-pointer space-y-3" onClick={onOpenRatingModal}>
          {/* 评分 */}
          <div className="flex items-start">
            <div className="w-16 shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              评分
            </div>
            <div className="text-xs font-medium text-neutral-800 dark:text-neutral-100">
              {bean?.overallRating} / 5
            </div>
          </div>

          {/* 评价备注 */}
          {bean?.ratingNotes && bean.ratingNotes.trim() && (
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
            onClick={onOpenRatingModal}
            className="text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-400"
          >
            + 添加评价
          </button>
        </div>
      )}
    </div>
  );
};

export default RatingSection;
