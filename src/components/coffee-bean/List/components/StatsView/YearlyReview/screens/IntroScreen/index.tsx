'use client';

import React, { useState, useRef } from 'react';
import type { CoffeeBean } from '@/types/app';
import type { BeanScreenProps } from '../../types';
import SegmentTitle from './SegmentTitle';
import SegmentHeadline from './SegmentHeadline';
import SegmentImages from './SegmentImages';
import SegmentReview from './SegmentReview';
import SegmentWeight from './SegmentWeight';
import SegmentGrid from './SegmentGrid';

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

  // 当前显示的段落索引（0, 1, 1.5, 2, 3, 4）
  const [currentSegment, setCurrentSegment] = useState<number>(0);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
    >
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
        <SegmentGrid beans={beans} onComplete={onComplete} blurRef={blurRef} />
      )}
    </div>
  );
};

export default IntroScreen;
