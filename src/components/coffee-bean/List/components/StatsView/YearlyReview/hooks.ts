'use client';

import { useState, useEffect, useRef } from 'react';
import type { ColorTuple } from './types';
import { lerpColor } from './constants';

/**
 * 颜色过渡 Hook - 平滑插值颜色数组
 */
export const useColorTransition = (
  targetColors: ColorTuple,
  duration: number = 800
): ColorTuple => {
  const [currentColors, setCurrentColors] = useState<ColorTuple>(targetColors);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const fromColorsRef = useRef<ColorTuple>(targetColors);

  useEffect(() => {
    // 如果颜色相同，不需要动画
    if (targetColors.every((c, i) => c === currentColors[i])) return;

    fromColorsRef.current = currentColors;
    startTimeRef.current = performance.now();

    const animate = (now: number) => {
      const elapsed = now - (startTimeRef.current || now);
      const progress = Math.min(elapsed / duration, 1);

      // 使用 easeOutCubic 缓动
      const eased = 1 - Math.pow(1 - progress, 3);

      const interpolated = targetColors.map((target, i) =>
        lerpColor(fromColorsRef.current[i], target, eased)
      ) as ColorTuple;

      setCurrentColors(interpolated);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [targetColors, duration]);

  return currentColors;
};

/**
 * 运动模糊 Hook - 管理模糊滤镜效果
 */
export const useMotionBlur = (
  blurRef: React.RefObject<SVGFEGaussianBlurElement | null>,
  activeElementRef: React.MutableRefObject<HTMLElement | null>
) => {
  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);

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

  const resetBlur = () => {
    if (blurRef.current) {
      blurRef.current.setAttribute('stdDeviation', '0, 0');
    }
  };

  return { updateBlur, resetBlur };
};
