'use client';

import React, { useState, useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { ScreenProps } from '../types';

/**
 * 欢迎介绍屏幕 - 点击后开始动画，带动态模糊滑出效果
 */
const WelcomeScreen: React.FC<ScreenProps> = ({ onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
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

  // 处理开始按钮点击 - 触发退出动画
  const handleStart = () => {
    if (isExiting) return;
    setIsExiting(true);

    // 同时对标题和底部内容应用退出动画
    if (titleRef.current && bottomRef.current && blurRef.current) {
      activeElementRef.current = titleRef.current;
      gsap.ticker.add(updateBlur);

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.ticker.remove(updateBlur);
          if (blurRef.current) {
            blurRef.current.setAttribute('stdDeviation', '0, 0');
          }
          onComplete?.();
        },
      });

      // 标题和底部同时向左滑出
      tl.to([titleRef.current, bottomRef.current], {
        x: '-120%',
        opacity: 0,
        duration: 0.5,
        ease: 'power3.in',
        stagger: 0.05,
      });
    } else {
      onComplete?.();
    }
  };

  // 入场动画 - 只做淡入，不移动
  useGSAP(
    () => {
      if (!titleRef.current || !bottomRef.current) return;

      gsap.set([titleRef.current, bottomRef.current], { opacity: 0 });

      const tl = gsap.timeline();

      tl.to(titleRef.current, {
        opacity: 1,
        duration: 0.6,
        ease: 'power2.out',
      }).to(
        bottomRef.current,
        {
          opacity: 1,
          duration: 0.5,
          ease: 'power2.out',
        },
        '-=0.3'
      );
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden py-16"
    >
      {/* SVG 滤镜定义 - 用于运动模糊 */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter
            id="welcome-motion-blur"
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

      {/* 上方标题 */}
      <div className="flex flex-1 flex-col items-center justify-center">
        <div
          ref={titleRef}
          className="text-[4rem] font-bold tracking-tighter text-white"
          style={{
            filter: 'url(#welcome-motion-blur)',
            willChange: 'transform, opacity',
          }}
        >
          Replay&apos;25
        </div>
      </div>

      {/* 底部介绍文字和按钮 */}
      <div
        ref={bottomRef}
        className="flex flex-col items-center gap-4 px-8"
        style={{
          filter: 'url(#welcome-motion-blur)',
          willChange: 'transform, opacity',
        }}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-xl font-medium text-white/90">
            回顾这一年的咖啡
          </span>
          <span className="text-base leading-relaxed text-white/90">
            从你的记录中，回顾一下 2025 年
            <br />
            看看买了哪些好豆，喜好是什么。
          </span>
        </div>
        <button
          onClick={handleStart}
          className="mt-2 flex items-center gap-2 rounded-full bg-white/20 px-8 py-4 text-lg font-medium text-white backdrop-blur-sm transition-all hover:bg-white/30 active:scale-95"
        >
          前往年度回顾
        </button>
      </div>
    </div>
  );
};

export default WelcomeScreen;
