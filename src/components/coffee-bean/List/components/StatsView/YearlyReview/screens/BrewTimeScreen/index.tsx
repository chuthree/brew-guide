'use client';

import React, { useRef, useMemo } from 'react';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

interface BrewTimeScreenProps {
  notes: BrewingNote[];
  beans: CoffeeBean[];
  beanImages: string[];
  type: 'earliest' | 'latest';
  onComplete?: () => void;
}

// 动画时长常量（与 IntroScreen 保持一致的节奏）
const ENTER_DURATION = 0.5;
const HOLD_DURATION = 3.5; // 极慢微移阶段，总时长约 6s
const EXIT_DURATION = 0.5;

/**
 * 获取笔记中的图片，优先使用笔记图片，没有则用咖啡豆图片
 */
const getImagesFromNotes = (
  notes: BrewingNote[],
  beans: CoffeeBean[],
  beanImages: string[],
  count: number = 10
): string[] => {
  const images: string[] = [];

  // 优先提取有图片的笔记
  notes.forEach(note => {
    if (note.image && images.length < count) {
      images.push(note.image);
    }
  });

  // 如果笔记图片不足，从咖啡豆图片补充
  if (images.length < count) {
    const beansWithImages = beans.filter(bean => bean.image);
    beansWithImages.forEach(bean => {
      if (bean.image && images.length < count) {
        images.push(bean.image);
      }
    });
  }

  // 如果还不足，从 beanImages 补充
  if (images.length < count && beanImages.length > 0) {
    for (let i = 0; images.length < count; i++) {
      images.push(beanImages[i % beanImages.length]);
    }
  }

  // 确保至少有 count 张，不足则循环填充
  if (images.length > 0 && images.length < count) {
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(images[i % images.length]);
    }
    return result;
  }

  return images;
};

/**
 * 根据分界线（6点）计算最早或最晚的冲咖啡时间
 */
const getExtremeBrewTime = (
  notes: BrewingNote[],
  type: 'earliest' | 'latest'
): { hour: number; minute: number; note: BrewingNote | null } => {
  if (notes.length === 0) {
    return { hour: 0, minute: 0, note: null };
  }

  const thisYearNotes = notes.filter(note => {
    const date = new Date(note.timestamp);
    return date.getFullYear() === 2025;
  });

  if (thisYearNotes.length === 0) {
    return { hour: 0, minute: 0, note: null };
  }

  let extremeNote: BrewingNote | null = null;
  let extremeValue = type === 'earliest' ? Infinity : -Infinity;

  thisYearNotes.forEach(note => {
    const date = new Date(note.timestamp);
    const hour = date.getHours();
    const minute = date.getMinutes();

    let compareValue = hour * 60 + minute;
    if (hour < 6) {
      compareValue += 24 * 60;
    }

    if (type === 'earliest') {
      if (compareValue >= 6 * 60 && compareValue < extremeValue) {
        extremeValue = compareValue;
        extremeNote = note;
      }
    } else {
      if (compareValue > extremeValue) {
        extremeValue = compareValue;
        extremeNote = note;
      }
    }
  });

  if (extremeNote) {
    const date = new Date((extremeNote as BrewingNote).timestamp);
    return {
      hour: date.getHours(),
      minute: date.getMinutes(),
      note: extremeNote as BrewingNote,
    };
  }

  return { hour: 0, minute: 0, note: null };
};

/**
 * 格式化时间为 HH:MM
 */
const formatTime = (hour: number, minute: number): string => {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
};

// 图片尺寸常量
const IMAGE_SIZE = 'clamp(140px, 38vw, 180px)';
const IMAGE_GAP = 12;

/**
 * BrewTimeScreen - 展示最早/最晚冲咖啡时间
 * 两行图片 + 文字，快-慢-快动画，从右进左出，带运动模糊
 */
const BrewTimeScreen: React.FC<BrewTimeScreenProps> = ({
  notes,
  beans,
  beanImages,
  type,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const topRowRef = useRef<HTMLDivElement>(null);
  const bottomRowRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  // 运动模糊追踪 - 只追踪文字元素（图片不加模糊以保证性能）
  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);

  // 获取极端时间
  const { hour, minute } = useMemo(
    () => getExtremeBrewTime(notes, type),
    [notes, type]
  );

  // 获取要展示的图片（10张，上下各5张）
  const images = useMemo(
    () => getImagesFromNotes(notes, beans, beanImages, 10),
    [notes, beans, beanImages]
  );

  // 上排5张，下排5张
  const topImages = images.slice(0, 5);
  const bottomImages = images.slice(5, 10);

  // 更新运动模糊 - 只处理文字（图片不加模糊以保证性能）
  const updateBlur = () => {
    if (!textRef.current || !blurRef.current) return;

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
      if (!containerRef.current) return;

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

      // 初始位置：全部在右侧屏幕外
      gsap.set(topRowRef.current, { x: '100%', opacity: 0 });
      gsap.set(bottomRowRef.current, { x: '130%', opacity: 0 });
      gsap.set(textRef.current, { x: '100%', opacity: 0 });

      // === 阶段1: 快速进入 (ENTER_DURATION) - 错落入场 ===
      // 上排先进入
      tl.to(
        topRowRef.current,
        {
          x: '5%',
          opacity: 1,
          duration: ENTER_DURATION,
          ease: 'power3.out',
        },
        0
      )
        // 下排稍微延迟进入，增加错落感
        .to(
          bottomRowRef.current,
          {
            x: '15%',
            opacity: 1,
            duration: ENTER_DURATION,
            ease: 'power3.out',
          },
          0.08
        )
        // 文字在图片入场快完成时开始出现
        .to(
          textRef.current,
          {
            x: '2%',
            opacity: 1,
            duration: ENTER_DURATION * 0.8,
            ease: 'power3.out',
          },
          ENTER_DURATION * 0.4
        )

        // === 阶段2: 极慢微移 (HOLD_DURATION) - 让图片更多地往左滑动 ===
        // 增加位移范围，让左边能看到更多内容
        .to(
          topRowRef.current,
          {
            x: '-25%',
            duration: HOLD_DURATION,
            ease: 'none',
          },
          ENTER_DURATION
        )
        .to(
          bottomRowRef.current,
          {
            x: '-15%',
            duration: HOLD_DURATION,
            ease: 'none',
          },
          ENTER_DURATION
        )
        .to(
          textRef.current,
          {
            x: '-2%',
            duration: HOLD_DURATION,
            ease: 'none',
          },
          ENTER_DURATION
        )

        // === 阶段3: 快速退出 (EXIT_DURATION) ===
        .to(
          topRowRef.current,
          {
            x: '-120%',
            opacity: 0,
            duration: EXIT_DURATION,
            ease: 'power3.in',
          },
          ENTER_DURATION + HOLD_DURATION
        )
        .to(
          bottomRowRef.current,
          {
            x: '-100%',
            opacity: 0,
            duration: EXIT_DURATION,
            ease: 'power3.in',
          },
          ENTER_DURATION + HOLD_DURATION + 0.05
        )
        .to(
          textRef.current,
          {
            x: '-120%',
            opacity: 0,
            duration: EXIT_DURATION,
            ease: 'power3.in',
          },
          ENTER_DURATION + HOLD_DURATION
        );
    },
    { scope: containerRef, dependencies: [images, type] }
  );

  const labelText =
    type === 'earliest' ? '今年你最早冲咖啡' : '今年你最晚冲咖啡';

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* SVG 滤镜定义 - 仅用于文字运动模糊 */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter
            id={`motion-blur-time-${type}`}
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

      {/* 图片区域 - 两行布局，距离顶部有间距 */}
      <div
        className="absolute inset-x-0 top-8 flex flex-col"
        style={{ gap: `${IMAGE_GAP}px` }}
      >
        {/* 上排 - 5张正方形图片 */}
        <div
          ref={topRowRef}
          className="flex"
          style={{
            gap: `${IMAGE_GAP}px`,
            willChange: 'transform, opacity',
          }}
        >
          {topImages.map((image, index) => (
            <div
              key={`top-${index}`}
              className="relative shrink-0 overflow-hidden rounded shadow ring-1 ring-white/20"
              style={{
                width: IMAGE_SIZE,
                height: IMAGE_SIZE,
              }}
            >
              <img
                src={image}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
          ))}
        </div>

        {/* 下排 - 5张正方形图片 */}
        <div
          ref={bottomRowRef}
          className="flex"
          style={{
            gap: `${IMAGE_GAP}px`,
            willChange: 'transform, opacity',
          }}
        >
          {bottomImages.map((image, index) => (
            <div
              key={`bottom-${index}`}
              className="relative shrink-0 overflow-hidden rounded shadow ring-1 ring-white/20"
              style={{
                width: IMAGE_SIZE,
                height: IMAGE_SIZE,
              }}
            >
              <img
                src={image}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 文字 - 紧贴图片下方，带运动模糊 */}
      <div
        ref={textRef}
        className="absolute inset-x-0 flex flex-col pl-4"
        style={{
          top: `calc(${IMAGE_SIZE} * 2 + ${IMAGE_GAP}px * 2 + 32px + 16px)`, // 两行图片高度 + 间距 + top-8 + 文字间距
          filter: `url(#motion-blur-time-${type})`,
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-lg font-medium text-white/80">{labelText}</span>
        <span
          className="font-bold tracking-tight text-white"
          style={{
            fontSize: 'clamp(56px, 16vw, 88px)',
            lineHeight: 1,
            textShadow: '0 4px 30px rgba(0,0,0,0.3)',
          }}
        >
          {formatTime(hour, minute)}
        </span>
      </div>
    </div>
  );
};

export default BrewTimeScreen;
