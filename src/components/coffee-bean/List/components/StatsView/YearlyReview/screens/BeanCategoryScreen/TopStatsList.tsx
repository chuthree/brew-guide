'use client';

import React, { useRef, useMemo } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import type { CoffeeBean } from '@/types/app';

type StatType = 'origin' | 'variety' | 'process';

interface TopStatsListProps {
  beans: CoffeeBean[];
  type: StatType;
  onComplete?: () => void;
}

const TITLES: Record<StatType, string> = {
  origin: '今年最爱产地',
  variety: '今年最爱品种',
  process: '今年最爱处理法',
};

const TopStatsList: React.FC<TopStatsListProps> = ({
  beans,
  type,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const topItems = useMemo(() => {
    const counts: Record<string, { count: number; image?: string }> = {};
    beans.forEach(bean => {
      if (bean.blendComponents && bean.blendComponents.length > 0) {
        bean.blendComponents.forEach(comp => {
          const value = comp[type];
          if (value) {
            if (!counts[value]) {
              counts[value] = { count: 0, image: bean.image };
            }
            counts[value].count += 1;
            if (!counts[value].image && bean.image) {
              counts[value].image = bean.image;
            }
          }
        });
      }
    });

    return Object.entries(counts)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [beans, type]);

  useGSAP(
    () => {
      if (!containerRef.current || !listRef.current) return;

      const screenWidth = containerRef.current.clientWidth;
      const screenHeight = containerRef.current.clientHeight;
      const items = listRef.current.children;
      const imageContainers: Element[] = [];
      const textContents: Element[] = [];
      const ranks: Element[] = [];

      Array.from(items).forEach(item => {
        const img = item.querySelector('.bean-image-container');
        const text = item.querySelector('.bean-info');
        const rank = item.querySelector('.bean-rank');
        if (img) imageContainers.push(img);
        if (text) textContents.push(text);
        if (rank) ranks.push(rank);
      });

      const tl = gsap.timeline({
        onComplete: () => {
          onComplete?.();
        },
      });

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

      // --- 入场动画 ---

      // 1. 标题快速滑入
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

      // 2. 图片从下方滑入（倒序）
      const totalImages = imageContainers.length;
      imageContainers.forEach((img, index) => {
        const reverseIndex = totalImages - 1 - index;
        tl.to(
          img,
          {
            y: 0,
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
          },
          1.0 + reverseIndex * 0.06
        );
      });

      // 3. 文字淡入（倒序）
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

      // 4. 排名数字弹出（倒序）
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

      // --- 停留时间 ---
      tl.to({}, { duration: 2.8 });

      // --- 退出动画 ---
      const exitStartTime = tl.duration();

      // 1. 排名数字缩小消失（正序，从上到下）
      ranks.forEach((rank, index) => {
        tl.to(
          rank,
          {
            scale: 0,
            opacity: 0,
            duration: 0.2,
            ease: 'power2.in',
          },
          exitStartTime + index * 0.03
        );
      });

      // 2. 文字滑出
      textContents.forEach((text, index) => {
        tl.to(
          text,
          {
            x: -50,
            opacity: 0,
            duration: 0.3,
            ease: 'power2.in',
          },
          exitStartTime + index * 0.03
        );
      });

      // 3. 图片滑出到上方（正序，从上到下）
      imageContainers.forEach((img, index) => {
        tl.to(
          img,
          {
            y: -screenHeight,
            opacity: 0,
            duration: 0.4,
            ease: 'power3.in',
          },
          exitStartTime + 0.1 + index * 0.04
        );
      });

      // 4. 标题滑出
      tl.to(
        titleRef.current,
        {
          x: -screenWidth,
          opacity: 0,
          duration: 0.4,
          ease: 'power3.in',
        },
        exitStartTime + 0.2
      );
    },
    { scope: containerRef }
  );

  const title = TITLES[type];

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
        {title}
      </h2>

      <div
        ref={listRef}
        className="no-scrollbar flex flex-1 flex-col space-y-3 pb-20"
      >
        {topItems.map((item, index) => (
          <div
            key={item.name}
            className="relative flex h-6 w-full items-center"
            style={{ zIndex: 50 - index }}
          >
            {/* Rank */}
            <div
              className="bean-rank mr-4 w-6 shrink-0 text-left text-lg font-bold text-white"
              style={{ willChange: 'transform, opacity' }}
            >
              {index + 1}
            </div>

            {/* Image Track */}
            <div className="relative mr-2 h-full w-32 shrink-0">
              <div
                className="bean-image-container absolute top-0 h-20 w-20 overflow-hidden rounded-full shadow"
                style={{
                  left: index % 2 === 0 ? '0' : 'auto',
                  right: index % 2 === 1 ? '0' : 'auto',
                  willChange: 'transform, opacity',
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-stone-700 text-xs text-white">
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
              <span className="mr-2 truncate text-base font-bold">
                {item.name}
              </span>
              <span className="shrink-0 text-base font-bold">{item.count}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopStatsList;
