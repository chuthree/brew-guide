'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface StarRatingProps {
  value: number;
  maxValue?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  onChange?: (value: number) => void;
  readonly?: boolean;
}

const StarRating: React.FC<StarRatingProps> = ({
  value,
  maxValue = 5,
  size = 'md',
  color = 'text-amber-400',
  onChange,
  readonly = false,
}) => {
  const starSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const containerSizes = {
    sm: 'gap-1',
    md: 'gap-1.5',
    lg: 'gap-2',
  };

  const handleStarClick = (rating: number) => {
    if (readonly) return;

    // 如果点击的是当前评分所在的星星，进行切换逻辑
    const currentStarIndex = Math.ceil(value);

    if (currentStarIndex === rating) {
      if (value === rating) {
        // 当前是整星，切换到半星
        onChange?.(rating - 0.5);
      } else if (value === rating - 0.5) {
        // 当前是半星，切换到整星
        onChange?.(rating);
      } else {
        // 其他情况，设置为整星
        onChange?.(rating);
      }
    } else {
      // 点击的不是当前星星，直接设置为整星
      onChange?.(rating);
    }
  };

  // 获取星星的填充状态
  const getStarFillState = (starIndex: number) => {
    const starValue = starIndex + 1;
    if (value >= starValue) {
      return 'full'; // 完全填充
    } else if (value >= starValue - 0.5) {
      return 'half'; // 半填充
    } else {
      return 'empty'; // 空星
    }
  };

  return (
    <div className={`flex items-center ${containerSizes[size]}`}>
      {[...Array(maxValue)].map((_, index) => {
        const starValue = index + 1;
        const fillState = getStarFillState(index);

        return (
          <div key={index} className={`relative ${starSizes[size]}`}>
            {/* 星星点击区域 */}
            {!readonly && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.9 }}
                className="absolute inset-0 z-10 cursor-pointer"
                onClick={() => handleStarClick(starValue)}
              />
            )}

            {/* 星星 SVG */}
            <svg
              viewBox="0 0 24 24"
              className={`${starSizes[size]} transition-colors ${readonly ? 'cursor-default' : 'cursor-pointer'} ${color}`}
            >
              <defs>
                <linearGradient
                  id={`star-gradient-${index}`}
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop offset="50%" stopColor="currentColor" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>

              {/* 背景星星 */}
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-neutral-300 dark:text-neutral-700"
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />

              {/* 填充星星 */}
              {fillState !== 'empty' && (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill={
                    fillState === 'half'
                      ? `url(#star-gradient-${index})`
                      : 'currentColor'
                  }
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
};

export default StarRating;
