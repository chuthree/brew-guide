'use client';

import React, { useState, useRef, useMemo } from 'react';
import type { CoffeeBean } from '@/types/app';
import type { BeanScreenProps } from '../../types';
import SegmentTitle from './SegmentTitle';
import SegmentHeadline from './SegmentHeadline';
import SegmentImages from './SegmentImages';
import SegmentReview from './SegmentReview';
import SegmentWeight from './SegmentWeight';
import SegmentGrid from './SegmentGrid';
import SegmentCost from './SegmentCost';

/**
 * 第一屏：开场动画（Apple Music Replay 风格）
 * 分段展示，每段独立滑入滑出，不同位置
 */
const IntroScreen: React.FC<BeanScreenProps> = ({
  beanImages,
  totalWeight,
  beans,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  // 当前显示的段落索引（0, 1, 1.5, 2, 3, 4, 5）
  const [currentSegment, setCurrentSegment] = useState<number>(0);

  // 计算2025年咖啡豆总花费
  const totalCost = useMemo(() => {
    return beans
      .filter(bean => new Date(bean.timestamp).getFullYear() === 2025)
      .reduce((sum, bean) => {
        // 解析价格字符串，支持 "98", "¥98", "98元" 等格式
        const priceStr = bean.price || '0';
        const price = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
        return sum + price;
      }, 0);
  }, [beans]);

  return (
    <div ref={containerRef} className="h-full w-full pt-32">
      {/* SVG 滤镜定义 - 用于运动模糊 */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id="motion-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur
              ref={blurRef}
              in="SourceGraphic"
              stdDeviation="0, 0"
            />
          </filter>
        </defs>
      </svg>

      {/* 根据当前段落显示对应内容 */}
      {currentSegment === 0 && (
        <SegmentTitle
          onComplete={() => setCurrentSegment(1)}
          blurRef={blurRef}
        />
      )}
      {currentSegment === 1 && (
        <SegmentHeadline
          onComplete={() => setCurrentSegment(1.5)}
          blurRef={blurRef}
        />
      )}
      {currentSegment === 1.5 && (
        <SegmentImages
          beanImages={beanImages}
          onComplete={() => setCurrentSegment(2)}
        />
      )}
      {currentSegment === 2 && (
        <SegmentReview
          onComplete={() => setCurrentSegment(3)}
          blurRef={blurRef}
        />
      )}
      {currentSegment === 3 && (
        <SegmentWeight
          totalWeight={totalWeight}
          onComplete={() => setCurrentSegment(4)}
          blurRef={blurRef}
        />
      )}
      {currentSegment === 4 && (
        <SegmentGrid
          beans={beans}
          onComplete={() => setCurrentSegment(5)}
          blurRef={blurRef}
        />
      )}
      {currentSegment === 5 && (
        <SegmentCost
          totalCost={totalCost}
          onComplete={onComplete}
          blurRef={blurRef}
        />
      )}
    </div>
  );
};

export default IntroScreen;
