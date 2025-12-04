'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface SegmentExploreStatsProps {
  originCount: number;
  varietyCount: number;
  processCount: number;
  onComplete?: () => void;
  blurRef?: React.RefObject<SVGFEGaussianBlurElement | null>;
}

/**
 * 综合洞察 - 探索统计
 * 复用 SegmentHeadline 的设计：左上角文案快慢快 + 三行数字统计（带数字滚动动画）
 */
const SegmentExploreStats: React.FC<SegmentExploreStatsProps> = ({
  originCount,
  varietyCount,
  processCount,
  onComplete,
  blurRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  // 三个数字的 ref
  const num1Ref = useRef<HTMLSpanElement>(null);
  const num2Ref = useRef<HTMLSpanElement>(null);
  const num3Ref = useRef<HTMLSpanElement>(null);

  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);

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
      if (!labelRef.current || !statsRef.current) return;
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
          duration: 3.5,
          ease: 'none',
        })
        .to(labelRef.current, {
          x: '-120%',
          opacity: 0,
          duration: 0.5,
          ease: 'power3.in',
        });

      // 统计数字同步动画 - 和标签一起进出
      tl.set(statsRef.current, { x: '100%', opacity: 0 }, 0)
        .to(
          statsRef.current,
          {
            x: '2%',
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
          },
          0
        )
        .to(
          statsRef.current,
          {
            x: '-2%',
            duration: 2.5,
            ease: 'none',
          },
          0.5
        )
        .to(
          statsRef.current,
          {
            x: '-120%',
            opacity: 0,
            duration: 0.5,
            ease: 'power3.in',
          },
          4.0
        );

      // 数字滚动动画 - 使用 GSAP 的 innerText 动画
      // 配合 snap 确保显示整数，使用 power4.out 实现快到慢的效果
      if (num1Ref.current) {
        gsap.fromTo(
          num1Ref.current,
          { innerText: 0 },
          {
            innerText: originCount,
            duration: 1.2,
            ease: 'power4.out',
            snap: { innerText: 1 },
            delay: 0.3,
          }
        );
      }

      if (num2Ref.current) {
        gsap.fromTo(
          num2Ref.current,
          { innerText: 0 },
          {
            innerText: varietyCount,
            duration: 1.2,
            ease: 'power4.out',
            snap: { innerText: 1 },
            delay: 0.45,
          }
        );
      }

      if (num3Ref.current) {
        gsap.fromTo(
          num3Ref.current,
          { innerText: 0 },
          {
            innerText: processCount,
            duration: 1.2,
            ease: 'power4.out',
            snap: { innerText: 1 },
            delay: 0.6,
          }
        );
      }
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
        <span className="text-4xl leading-tight font-bold tracking-tight">
          今年你一共尝试了
        </span>
      </div>

      {/* 统计数字 - 跟随标签同步动画 */}
      <div
        ref={statsRef}
        className="absolute top-32 left-0 flex flex-col gap-1 pl-4 text-white"
        style={{
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-[3rem] leading-tight font-bold tracking-tight">
          <span ref={num1Ref} className="inline-block min-w-[2ch] tabular-nums">
            0
          </span>{' '}
          个产地
        </span>
        <span className="text-[3rem] leading-tight font-bold tracking-tight">
          <span ref={num2Ref} className="inline-block min-w-[2ch] tabular-nums">
            0
          </span>{' '}
          个品种
        </span>
        <span className="text-[3rem] leading-tight font-bold tracking-tight">
          <span ref={num3Ref} className="inline-block min-w-[2ch] tabular-nums">
            0
          </span>{' '}
          种处理法
        </span>
      </div>
    </div>
  );
};

export default SegmentExploreStats;
