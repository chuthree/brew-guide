'use client';

import React, { useState, useRef, useMemo } from 'react';
import type { CoffeeBean } from '@/types/app';
import type { BeanScreenProps } from '../../types';
import SegmentOriginHeadline from './SegmentOriginHeadline';
import SegmentConsumption from './SegmentConsumption';

/**
 * 第四屏：产地详情
 * 包含产地展示（图片动画） + 产地消耗量
 */
const OriginDetailScreen: React.FC<BeanScreenProps> = ({
  beans,
  beanImages,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  // 0: 产地标题+图片, 1: 产地消耗量
  const [currentSegment, setCurrentSegment] = useState<number>(0);

  // 计算最爱产地及其数据
  const topOriginData = useMemo(() => {
    const originCounts: Record<
      string,
      { count: number; weight: number; images: string[] }
    > = {};

    beans.forEach(bean => {
      // 解析重量
      let beanWeight = 0;
      if (bean.capacity) {
        const match = bean.capacity.match(/(\d+(?:\.\d+)?)/);
        if (match) {
          beanWeight = parseFloat(match[1]);
        }
      }

      if (bean.blendComponents && bean.blendComponents.length > 0) {
        bean.blendComponents.forEach(comp => {
          const origin = comp.origin;
          if (origin) {
            if (!originCounts[origin]) {
              originCounts[origin] = { count: 0, weight: 0, images: [] };
            }
            originCounts[origin].count += 1;
            originCounts[origin].weight += beanWeight;
            if (bean.image && originCounts[origin].images.length < 10) {
              originCounts[origin].images.push(bean.image);
            }
          }
        });
      }
    });

    const sorted = Object.entries(originCounts).sort(
      (a, b) => b[1].count - a[1].count
    );

    if (sorted.length > 0) {
      const [name, data] = sorted[0];
      return { name, ...data };
    }

    return { name: '未知', count: 0, weight: 0, images: [] };
  }, [beans]);

  return (
    <div ref={containerRef} className="h-full w-full pt-32">
      {/* SVG 滤镜定义 - 用于运动模糊 */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter
            id="motion-blur-origin"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
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
        <>
          <SegmentOriginHeadline
            originName={topOriginData.name}
            originImages={topOriginData.images}
            onComplete={() => setCurrentSegment(1)}
            blurRef={blurRef}
          />
        </>
      )}
      {currentSegment === 1 && (
        <SegmentConsumption
          amount={topOriginData.weight}
          unit="g"
          label="一年消耗了"
          onComplete={onComplete}
          blurRef={blurRef}
        />
      )}
    </div>
  );
};

export default OriginDetailScreen;
