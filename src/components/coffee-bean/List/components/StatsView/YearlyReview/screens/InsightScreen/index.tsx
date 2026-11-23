'use client';

import { rankBeanCategories } from '../../categoryStats';

import React, { useRef, useMemo } from 'react';
import type { BeanScreenProps } from '../../types';
import SegmentExploreStats from './SegmentExploreStats';

/**
 * 综合洞察屏
 * 展示用户的咖啡探索统计：产地数量、品种数量、处理法数量
 */
const InsightScreen: React.FC<BeanScreenProps> = ({ beans, onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  // 计算统计数据
  const stats = useMemo(() => {
    return {
      originCount: rankBeanCategories(beans, 'origin').length,
      varietyCount: rankBeanCategories(beans, 'variety').length,
      processCount: rankBeanCategories(beans, 'process').length,
    };
  }, [beans]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {/* SVG 模糊滤镜 */}
      <svg className="absolute h-0 w-0">
        <defs>
          <filter id="insight-motion-blur">
            <feGaussianBlur ref={blurRef} stdDeviation="0, 0" />
          </filter>
        </defs>
      </svg>

      {/* 探索统计 */}
      <SegmentExploreStats
        originCount={stats.originCount}
        varietyCount={stats.varietyCount}
        processCount={stats.processCount}
        onComplete={onComplete}
        blurRef={blurRef}
      />
    </div>
  );
};

export default InsightScreen;
