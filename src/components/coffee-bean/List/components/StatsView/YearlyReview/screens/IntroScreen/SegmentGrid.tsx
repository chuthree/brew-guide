'use client';

import React, { useRef, useMemo } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { CoffeeBean } from '@/types/app';

interface SegmentGridProps {
  beans: CoffeeBean[];
  onComplete?: () => void;
  blurRef?: React.RefObject<SVGFEGaussianBlurElement | null>;
}

// 网格配置：3列4行
const COLS = 3;
const ROWS = 4;
const TOTAL_CELLS = COLS * ROWS;
const GAP = 4;

/**
 * Segment 4: 图片网格动画 - 3列4行，从右下到左上依次展开
 */
const SegmentGrid: React.FC<SegmentGridProps> = ({
  beans,
  onComplete,
  blurRef,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);

  // 计算今年购买的咖啡豆款数
  const beanCount = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return beans.filter(bean => {
      const beanYear = new Date(bean.timestamp).getFullYear();
      return beanYear === currentYear;
    }).length;
  }, [beans]);

  // 获取最多12张图片
  const gridImages = useMemo(() => {
    return beans
      .filter(bean => bean.image && bean.image.trim() !== '')
      .slice(0, TOTAL_CELLS)
      .map(bean => bean.image as string);
  }, [beans]);

  // 生成从右下到左上的顺序索引
  const getAnimationOrder = () => {
    const order: number[] = [];
    for (let row = ROWS - 1; row >= 0; row--) {
      for (let col = COLS - 1; col >= 0; col--) {
        order.push(row * COLS + col);
      }
    }
    return order;
  };

  // 计算每个格子的目标位置
  const getCellPosition = (index: number) => {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    return { x: col, y: row };
  };

  const updateBlur = () => {
    if (!textRef.current || !blurRef?.current) return;

    const transform = getComputedStyle(textRef.current).transform;
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
      if (!gridRef.current || !textRef.current) return;
      gsap.ticker.add(updateBlur);

      const animationOrder = getAnimationOrder();
      const totalImages = Math.min(gridImages.length, TOTAL_CELLS);

      const containerWidth = gridRef.current.clientWidth;
      const totalGapWidth = GAP * (COLS - 1);
      const cellWidth = (containerWidth - totalGapWidth) / COLS;

      const tl = gsap.timeline({
        onComplete: () => {
          gsap.ticker.remove(updateBlur);
          if (blurRef?.current) {
            blurRef.current.setAttribute('stdDeviation', '0, 0');
          }
          onComplete?.();
        },
      });

      // 底部文字动画 - 快慢快模式
      tl.set(textRef.current, { x: '100%', opacity: 0 }).to(textRef.current, {
        x: '2%',
        opacity: 1,
        duration: 0.5,
        ease: 'power3.out',
      });

      // 图片网格动画
      animationOrder.forEach((cellIndex, orderIndex) => {
        const imageIndex = orderIndex % totalImages;
        const ref = imageRefs.current[imageIndex];
        if (ref && orderIndex < totalImages) {
          const pos = getCellPosition(cellIndex);
          const targetY = pos.y * (cellWidth + GAP);
          const startX = containerWidth + 50 + orderIndex * 25;
          gsap.set(ref, {
            x: startX,
            y: targetY,
            opacity: 1,
          });
        }
      });

      animationOrder.forEach((cellIndex, orderIndex) => {
        const imageIndex = orderIndex % totalImages;
        const ref = imageRefs.current[imageIndex];
        if (ref && orderIndex < totalImages) {
          const pos = getCellPosition(cellIndex);
          const targetX = pos.x * (cellWidth + GAP);
          tl.to(
            ref,
            {
              x: targetX,
              duration: 0.5,
              ease: 'power2.out',
            },
            0.5
          );
        }
      });

      tl.to(
        textRef.current,
        {
          x: '-2%',
          duration: 2.5,
          ease: 'none',
        },
        0.5
      );

      // 退出动画
      tl.to(
        textRef.current,
        {
          x: '-120%',
          opacity: 0,
          duration: 0.5,
          ease: 'power3.in',
        },
        3.0
      );

      animationOrder.forEach((cellIndex, orderIndex) => {
        const imageIndex = orderIndex % totalImages;
        const ref = imageRefs.current[imageIndex];
        if (ref && orderIndex < totalImages) {
          const exitX = -containerWidth - 50 - orderIndex * 25;
          tl.to(
            ref,
            {
              x: exitX,
              duration: 0.5,
              ease: 'power2.in',
            },
            3.0
          );
        }
      });
    },
    { scope: containerRef }
  );

  const totalGap = GAP * (COLS - 1);
  const cellSize = `calc((100vw - 24px - ${totalGap}px) / ${COLS})`;

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* 图片网格容器 */}
      <div
        ref={gridRef}
        className="absolute top-3 right-3 left-3"
        style={{
          height: `calc(((100vw - 24px - ${totalGap}px) / ${COLS} + ${GAP}px) * ${ROWS} - ${GAP}px)`,
        }}
      >
        {gridImages.map((image, index) => (
          <div
            key={index}
            ref={el => {
              imageRefs.current[index] = el;
            }}
            className="absolute overflow-hidden rounded-sm"
            style={{
              width: cellSize,
              height: cellSize,
              willChange: 'transform',
            }}
          >
            <img
              src={image}
              alt="咖啡豆"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      {/* 底部文字 */}
      <div
        ref={textRef}
        className="absolute bottom-18 left-0 flex flex-col pl-4 text-white"
        style={{
          filter: 'url(#motion-blur)',
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-[2rem] leading-tight font-bold tracking-tight">
          总共有 {beanCount} 款
        </span>
      </div>
    </div>
  );
};

export default SegmentGrid;
