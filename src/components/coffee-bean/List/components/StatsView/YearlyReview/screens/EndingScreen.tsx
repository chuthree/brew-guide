'use client';

import React, { useState, useRef } from 'react';
import { RotateCcw } from 'lucide-react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ScreenProps } from '../types';

interface EndingScreenProps extends ScreenProps {
  onReplay?: () => void;
}

/**
 * 结束屏幕 - 感谢页面，带重播按钮
 */
const EndingScreen: React.FC<EndingScreenProps> = ({ onReplay }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);
  const [isExiting, setIsExiting] = useState(false);

  // 用于追踪上一帧位置，计算速度
  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const activeElementRef = useRef<HTMLDivElement | null>(null);

  // 速度追踪器 - 更新模糊效果
  const updateBlur = () => {
    if (!activeElementRef.current || !blurRef.current) return;

    const transform = getComputedStyle(activeElementRef.current).transform;
    if (transform === 'none') return;

    const matrix = new DOMMatrix(transform);
    const currentX = matrix.m41;

    const velocity = Math.abs(currentX - lastXRef.current);
    lastXRef.current = currentX;

    velocityRef.current = velocityRef.current * 0.7 + velocity * 0.3;
    const blurAmount = Math.min(velocityRef.current * 0.6, 30);
    blurRef.current.setAttribute('stdDeviation', `${blurAmount}, 0`);
  };

  // 处理重播按钮点击
  const handleReplay = () => {
    if (isExiting) return;
    setIsExiting(true);

    if (
      titleRef.current &&
      contentRef.current &&
      buttonRef.current &&
      blurRef.current
    ) {
      activeElementRef.current = titleRef.current;
      gsap.ticker.add(updateBlur);

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.ticker.remove(updateBlur);
          if (blurRef.current) {
            blurRef.current.setAttribute('stdDeviation', '0, 0');
          }
          onReplay?.();
        },
      });

      // 所有元素同时向左滑出
      tl.to([titleRef.current, contentRef.current, buttonRef.current], {
        x: '-120%',
        opacity: 0,
        duration: 0.5,
        ease: 'power3.in',
        stagger: 0.05,
      });
    } else {
      onReplay?.();
    }
  };

  // 入场动画
  useGSAP(
    () => {
      if (!titleRef.current || !contentRef.current || !buttonRef.current)
        return;

      gsap.set([titleRef.current, contentRef.current, buttonRef.current], {
        opacity: 0,
        y: 20,
      });

      const tl = gsap.timeline();

      tl.to(titleRef.current, {
        opacity: 1,
        y: 0,
        duration: 0.4,
        ease: 'power2.out',
      })
        .to(
          contentRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: 'power2.out',
          },
          '-=0.2'
        )
        .to(
          buttonRef.current,
          {
            opacity: 1,
            y: 0,
            duration: 0.35,
            ease: 'power2.out',
          },
          '-=0.2'
        );
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-8"
    >
      {/* SVG 滤镜定义 - 用于运动模糊 */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter
            id="ending-motion-blur"
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

      {/* 感谢标题 */}
      <div
        ref={titleRef}
        className="mb-6 text-center text-xl leading-tight font-bold tracking-tight text-white"
        style={{
          filter: 'url(#ending-motion-blur)',
          willChange: 'transform, opacity',
        }}
      >
        感谢你的支持!
      </div>

      {/* 说明内容 */}
      <div
        ref={contentRef}
        className="mb-10 flex flex-col items-center gap-4 text-center"
        style={{
          filter: 'url(#ending-motion-blur)',
          willChange: 'transform, opacity',
        }}
      >
        <p className="text-base leading-relaxed text-white">
          这只是预览版，完整版将在今年晚些推出～
        </p>
      </div>

      {/* 重播按钮 */}
      <button
        ref={buttonRef}
        onClick={handleReplay}
        className="flex items-center gap-2 rounded-full bg-white/20 px-8 py-4 text-lg font-medium text-white backdrop-blur-sm hover:bg-white/30 active:scale-95"
        style={{
          willChange: 'transform, opacity',
        }}
      >
        <RotateCcw size={20} />
        重新播放
      </button>
    </div>
  );
};

export default EndingScreen;
