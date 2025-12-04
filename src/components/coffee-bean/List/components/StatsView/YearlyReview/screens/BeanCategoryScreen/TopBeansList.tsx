'use client';

import React, { useRef, useMemo } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { CoffeeBean } from '@/types/app';

interface TopBeansListProps {
  beans: CoffeeBean[];
  onComplete?: () => void;
}

const TopBeansList: React.FC<TopBeansListProps> = ({ beans, onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const topBeans = useMemo(() => {
    const counts: Record<string, { count: number; image?: string }> = {};
    beans.forEach(bean => {
      // 统计产地 (Origin)
      if (bean.blendComponents && bean.blendComponents.length > 0) {
        bean.blendComponents.forEach(comp => {
          const origin = comp.origin;
          if (origin) {
            if (!counts[origin]) {
              counts[origin] = { count: 0, image: bean.image };
            }
            counts[origin].count += 1;
            // 如果当前产地还没有图片，且当前豆子有图片，则使用当前豆子的图片
            if (!counts[origin].image && bean.image) {
              counts[origin].image = bean.image;
            }
          }
        });
      }
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [beans]);

  useGSAP(
    () => {
      if (!containerRef.current || !listRef.current) return;

      const screenWidth = containerRef.current.clientWidth;
      const screenHeight = containerRef.current.clientHeight;
      const items = listRef.current.children;
      const imageContainers: Element[] = [];
      const textContents: Element[] = [];
      const ranks: Element[] = [];

      // 收集所有元素
      Array.from(items).forEach(item => {
        const img = item.querySelector('.bean-image-container');
        const text = item.querySelector('.bean-info');
        const rank = item.querySelector('.bean-rank');
        if (img) imageContainers.push(img);
        if (text) textContents.push(text);
        if (rank) ranks.push(rank);
      });

      const tl = gsap.timeline();

      // 初始状态
      gsap.set(titleRef.current, { x: screenWidth, opacity: 0 });
      imageContainers.forEach(img => {
        gsap.set(img, { y: screenHeight, opacity: 0 });
      });
      textContents.forEach(text => {
        gsap.set(text, { x: 50, opacity: 0 });
      });
      ranks.forEach(rank => {
        gsap.set(rank, { scale: 0, opacity: 0 });
      });

      // --- 动画序列 ---

      // 1. 标题快速滑入（快进 -> 慢停 -> 快出风格）
      tl.to(titleRef.current, {
        x: '2%',
        opacity: 1,
        duration: 0.4,
        ease: 'power3.out',
      })
        .to(titleRef.current, {
          x: '-2%',
          duration: 1.2,
          ease: 'none',
        })
        .to(titleRef.current, {
          x: 0,
          duration: 0.2,
          ease: 'power2.out',
        });

      // 2. 图片从下方滑入，从最后一个开始（倒序）
      const totalImages = imageContainers.length;
      imageContainers.forEach((img, index) => {
        const reverseIndex = totalImages - 1 - index; // 倒序：最后一个先出现
        tl.to(
          img,
          {
            y: 0, // yPercent: -50 保持不变，只改变 y
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
          },
          1.0 + reverseIndex * 0.06
        );
      });

      // 3. 文字淡入（也是倒序）
      textContents.forEach((text, index) => {
        const reverseIndex = totalImages - 1 - index;
        tl.to(
          text,
          {
            x: 0,
            opacity: 1,
            duration: 0.4,
            ease: 'power2.out',
          },
          1.2 + reverseIndex * 0.05
        );
      });

      // 4. 排名数字弹出（也是倒序）
      ranks.forEach((rank, index) => {
        const reverseIndex = totalImages - 1 - index;
        tl.to(
          rank,
          {
            scale: 1,
            opacity: 1,
            duration: 0.3,
            ease: 'back.out(1.5)',
          },
          1.3 + reverseIndex * 0.04
        );
      });
    },
    { scope: containerRef }
  );

  return (
    <div
      ref={containerRef}
      className="relative z-10 flex h-full w-full flex-col px-3 pt-12"
    >
      <h2
        ref={titleRef}
        className="mb-8 text-3xl font-bold text-white"
        style={{ willChange: 'transform, opacity' }}
      >
        你的咖啡豆
        <br />
        产地很多
      </h2>

      <div
        ref={listRef}
        className="no-scrollbar flex flex-1 flex-col space-y-3 overflow-y-auto pb-20"
      >
        {topBeans.map((bean, index) => (
          <div
            key={bean.name}
            className="relative flex h-6 w-full items-center"
            style={{ zIndex: 50 - index }}
          >
            {/* Rank - 固定宽度确保对齐 */}
            <div
              className="bean-rank mr-4 w-6 shrink-0 text-left text-lg font-bold text-white/80"
              style={{ willChange: 'transform, opacity' }}
            >
              {index + 1}
            </div>

            {/* Image Track - Fixed width to keep text aligned */}
            <div className="relative mr-2 h-full w-32 shrink-0">
              {/* Image - Absolute positioned for zig-zag effect */}
              <div
                className="bean-image-container absolute top-0 h-20 w-20 overflow-hidden rounded-full shadow"
                style={{
                  left: index % 2 === 0 ? '0' : 'auto',
                  right: index % 2 === 1 ? '0' : 'auto',
                  willChange: 'transform, opacity',
                }}
              >
                {bean.image ? (
                  <img
                    src={bean.image}
                    alt={bean.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-stone-700 text-xs text-white/40">
                    No Img
                  </div>
                )}
              </div>
            </div>

            {/* Name and Count */}
            <div
              className="bean-info ml-2 flex h-full min-w-0 flex-1 items-center justify-between self-center overflow-hidden text-white"
              style={{ willChange: 'transform, opacity' }}
            >
              <span className="mr-2 truncate text-base font-medium">
                {bean.name}
              </span>
              <span className="shrink-0 text-base font-bold opacity-80">
                {bean.count}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopBeansList;
