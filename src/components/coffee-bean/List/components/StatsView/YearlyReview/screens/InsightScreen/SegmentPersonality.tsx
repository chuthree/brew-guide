'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface SegmentPersonalityProps {
  labels: string[];
  onComplete?: () => void;
  blurRef?: React.RefObject<SVGFEGaussianBlurElement | null>;
}

/**
 * 综合洞察 - 个性标签
 * 复用 SegmentHeadline 的设计：快慢快节奏展示标签
 */
const SegmentPersonality: React.FC<SegmentPersonalityProps> = ({
  labels,
  onComplete,
  blurRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const tagsRef = useRef<HTMLDivElement>(null);
  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);

  // 取第一个标签作为主要展示
  const mainLabel = labels[0] || '咖啡爱好者';

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
      if (!labelRef.current || !tagsRef.current) return;
      gsap.ticker.add(updateBlur);

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.ticker.remove(updateBlur);
          if (blurRef?.current) {
            blurRef.current.setAttribute('stdDeviation', '0, 0');
          }
          onComplete?.();
        },
      });

      // 左上角标签动画 - 快慢快模式（和 SegmentHeadline 一致）
      tl.set(labelRef.current, { x: '100%', opacity: 0 })
        .to(labelRef.current, {
          x: '2%',
          opacity: 1,
          duration: 0.5,
          ease: 'power3.out',
        })
        .to(labelRef.current, {
          x: '-2%',
          duration: 1.5,
          ease: 'none',
        })
        .to(labelRef.current, {
          x: '-120%',
          opacity: 0,
          duration: 0.5,
          ease: 'power3.in',
        });

      // 标签同步动画 - 和标签一起进出
      tl.set(tagsRef.current, { x: '100%', opacity: 0 }, 0)
        .to(
          tagsRef.current,
          {
            x: '2%',
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
          },
          0
        )
        .to(
          tagsRef.current,
          {
            x: '-2%',
            duration: 1.5,
            ease: 'none',
          },
          0.5
        )
        .to(
          tagsRef.current,
          {
            x: '-120%',
            opacity: 0,
            duration: 0.5,
            ease: 'power3.in',
          },
          2.0
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
          filter: 'url(#insight-motion-blur)',
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-[3rem] leading-tight font-bold tracking-tight">
          你是
        </span>
      </div>

      {/* 个性标签 - 跟随标签同步动画 */}
      <div
        ref={tagsRef}
        className="absolute top-32 left-0 flex flex-col gap-1 pl-4 text-white"
        style={{
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-[3rem] leading-tight font-bold tracking-tight">
          {mainLabel}
        </span>
        {labels.slice(1).map((label, index) => (
          <span
            key={index}
            className="text-[2rem] leading-tight font-bold tracking-tight text-white/70"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default SegmentPersonality;
