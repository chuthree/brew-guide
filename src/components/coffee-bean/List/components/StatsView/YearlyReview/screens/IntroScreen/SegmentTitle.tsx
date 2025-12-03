'use client';

import React, { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface SegmentTitleProps {
  onComplete?: () => void;
  blurRef?: React.RefObject<SVGFEGaussianBlurElement | null>;
}

/**
 * Segment 0: Replay'25 标题 - 底部位置
 */
const SegmentTitle: React.FC<SegmentTitleProps> = ({ onComplete, blurRef }) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);

  const updateBlur = () => {
    if (!ref.current || !blurRef?.current) return;

    const transform = getComputedStyle(ref.current).transform;
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
      if (!ref.current) return;
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

      // 快速进入 -> 极慢微移（几乎静止） -> 加速退出
      tl.set(ref.current, { x: '100%', opacity: 0 })
        .to(ref.current, {
          x: '2%',
          opacity: 1,
          duration: 0.5,
          ease: 'power3.out',
        })
        .to(ref.current, {
          x: '-2%',
          duration: 1.2,
          ease: 'none',
        })
        .to(ref.current, {
          x: '-120%',
          opacity: 0,
          duration: 0.5,
          ease: 'power3.in',
        });
    },
    { scope: ref }
  );

  return (
    <div
      ref={ref}
      className="absolute bottom-[25%] text-[4.5rem] font-bold tracking-tighter text-white"
      style={{
        filter: 'url(#motion-blur)',
        willChange: 'transform, opacity',
      }}
    >
      Replay&apos;25
    </div>
  );
};

export default SegmentTitle;
