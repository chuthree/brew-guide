'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface SegmentWeightProps {
  totalWeight: number;
  onComplete?: () => void;
  blurRef?: React.RefObject<SVGFEGaussianBlurElement | null>;
}

/**
 * Segment 3: 今年一共买了 NNNNNg 豆子 - 左上角标签 + 超大文字同步动画
 */
const SegmentWeight: React.FC<SegmentWeightProps> = ({
  totalWeight,
  onComplete,
  blurRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const bigTextRef = useRef<HTMLDivElement>(null);
  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);

  const formattedWeight = Math.round(totalWeight).toLocaleString();

  const updateBlur = () => {
    if (!labelRef.current || !blurRef?.current) return;

    const transform = getComputedStyle(labelRef.current).transform;
    if (transform === 'none') return;

    const matrix = new DOMMatrix(transform);
    const currentX = matrix.m41;

    const velocity = Math.abs(currentX - lastXRef.current);
    lastXRef.current = currentX;

    velocityRef.current = velocityRef.current * 0.7 + velocity * 0.3;
    const blurAmount = Math.min(velocityRef.current * 0.6, 30);
    blurRef.current.setAttribute('stdDeviation', `${blurAmount}, 0`);
  };

  useGSAP(
    () => {
      if (!labelRef.current || !bigTextRef.current) return;
      gsap.ticker.add(updateBlur);

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.ticker.remove(updateBlur);
          if (blurRef?.current) {
            blurRef.current.setAttribute('stdDeviation', '0, 0');
          }
        },
      });

      // 左上角标签动画 - 快慢快模式
      tl.set(labelRef.current, { x: '100%', opacity: 0 })
        .to(labelRef.current, {
          x: '2%',
          opacity: 1,
          duration: 0.5,
          ease: 'power3.out',
        })
        .to(labelRef.current, {
          x: '-2%',
          duration: 2.5,
          ease: 'none',
        })
        .to(labelRef.current, {
          x: '-120%',
          opacity: 0,
          duration: 0.5,
          ease: 'power3.in',
          onComplete: () => {
            onComplete?.();
          },
        });

      // 超大文字动画 - 从屏幕右侧边缘匀速滚动到完全离开左侧
      gsap.fromTo(
        bigTextRef.current,
        { x: '100%', opacity: 1 },
        {
          x: '-100%',
          opacity: 1,
          duration: 3.5,
          ease: 'none',
        }
      );
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* 左上角标签 - 快慢快模式 */}
      <div
        ref={labelRef}
        className="absolute top-12 left-0 flex flex-col pl-4 text-white"
        style={{
          filter: 'url(#motion-blur)',
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-[3rem] leading-tight font-bold tracking-tight">
          今年你一共买了
        </span>
        <span className="text-[3rem] leading-tight font-bold tracking-tight">
          {formattedWeight}g 咖啡豆
        </span>
      </div>

      {/* 超大重量文字 - 从右到左匀速滚动 */}
      <div
        ref={bigTextRef}
        className="absolute flex items-center whitespace-nowrap"
        style={{
          top: '50%',
          left: '0',
          transform: 'translateY(-50%)',
          willChange: 'transform',
        }}
      >
        <span
          className="font-bold tracking-tighter text-white"
          style={{
            fontSize: 'clamp(200px, 55vw, 320px)',
            lineHeight: 0.85,
            textShadow: '0 4px 30px rgba(0,0,0,0.3)',
          }}
        >
          {formattedWeight}g
        </span>
      </div>
    </div>
  );
};

export default SegmentWeight;
