'use client';

import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ScreenProps } from '../types';

interface EndingScreenProps extends ScreenProps {
  onReplay?: () => void;
  onGenerateReport?: () => void;
}

/**
 * 结束屏幕 - 过渡页面，提供重播和生成报告选项
 */
const EndingScreen: React.FC<EndingScreenProps> = ({
  onReplay,
  onGenerateReport,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const buttonsRef = useRef<HTMLDivElement>(null);
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
      buttonsRef.current &&
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
      tl.to([titleRef.current, contentRef.current, buttonsRef.current], {
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

  // 处理生成报告按钮点击
  const handleGenerateReport = () => {
    if (isExiting) return;
    onGenerateReport?.();
  };

  // 入场动画
  useGSAP(
    () => {
      if (!titleRef.current || !contentRef.current || !buttonsRef.current)
        return;

      gsap.set([titleRef.current, contentRef.current, buttonsRef.current], {
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
          buttonsRef.current,
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
      className="absolute inset-0 flex flex-col items-center overflow-hidden px-8"
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

      {/* 感谢标题 - 居中 */}
      <div
        ref={titleRef}
        className="absolute top-1/2 -translate-y-1/2 text-center text-2xl leading-tight font-bold tracking-tight text-white"
        style={{
          filter: 'url(#ending-motion-blur)',
          willChange: 'transform, opacity',
        }}
      >
        感谢你的支持!
      </div>

      {/* 隐藏的内容区域（保持动画引用） */}
      <div ref={contentRef} className="hidden" />

      {/* 按钮区域 - 底部 */}
      <div
        ref={buttonsRef}
        className="pb-safe absolute right-0 bottom-12 left-0 flex flex-col items-center gap-3"
        style={{
          willChange: 'transform, opacity',
        }}
      >
        {/* 生成报告按钮 - 主按钮 */}
        <button
          onClick={handleGenerateReport}
          className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-base font-medium text-neutral-800 active:scale-95"
        >
          生成年度报告
        </button>

        {/* 重播按钮 - 纯文字 */}
        <button
          onClick={handleReplay}
          className="text-sm text-white/60 active:scale-95"
        >
          重新播放
        </button>
      </div>
    </div>
  );
};

export default EndingScreen;
