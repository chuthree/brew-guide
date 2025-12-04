'use client';

import React, { useRef, useMemo } from 'react';
import type { CoffeeBean } from '@/types/app';
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
    const origins = new Set<string>();
    const varieties = new Set<string>();
    const processes = new Set<string>();

    beans.forEach(bean => {
      // 处理拼配和单品 - 所有信息都在 blendComponents 中
      if (bean.blendComponents && bean.blendComponents.length > 0) {
        bean.blendComponents.forEach(comp => {
          if (comp.origin) origins.add(comp.origin);
          if (comp.variety) varieties.add(comp.variety);
          if (comp.process) processes.add(comp.process);
        });
      }
    });

    return {
      originCount: origins.size,
      varietyCount: varieties.size,
      processCount: processes.size,
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
