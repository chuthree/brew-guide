'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Drawer } from 'vaul';
import { motion, AnimatePresence } from 'framer-motion';
import { GrainGradient } from '@paper-design/shaders-react';
import { X } from 'lucide-react';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { Storage } from '@/lib/core/storage';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';

// 注册 GSAP React 插件
gsap.registerPlugin(useGSAP);

interface YearlyReviewDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// 预设 10 个屏幕的进度条
const TOTAL_SCREENS = 10;

// 介绍页主题 - 清新的薄荷青绿
const WELCOME_THEME = {
  colors: ['#00B894', '#55EFC4', '#00CEC9', '#81ECEC'] as [
    string,
    string,
    string,
    string,
  ],
  accent: '#00B894',
};

// 预览结束页主题 - 优雅的靛蓝紫色系，沉稳有质感
const PREVIEW_END_THEME = {
  colors: ['#6366F1', '#818CF8', '#4F46E5', '#A5B4FC'] as [
    string,
    string,
    string,
    string,
  ],
  accent: '#6366F1',
};

// 每个屏幕的主题渐变配置 - 水果风味色系，鲜艳活泼
const SCREEN_THEMES = [
  {
    // 🍓 莓果 - 甜蜜的草莓红开场
    colors: ['#FF6B8A', '#FF8FA3', '#FF4D6D', '#FFB3C1'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#FF6B8A',
  },
  {
    // 🍊 柑橘 - 阳光活力的橘子色
    colors: ['#FF9F43', '#FFB86C', '#FF7F50', '#FFD699'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#FF9F43',
  },
  {
    // 🍋 柠檬 - 清新明亮的黄色调
    colors: ['#FFD93D', '#FFE66D', '#FFC107', '#FFF176'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#FFD93D',
  },
  {
    // 🥝 奇异果 - 清新的绿色
    colors: ['#7CB342', '#9CCC65', '#8BC34A', '#C5E1A5'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#7CB342',
  },
  {
    // 🫐 蓝莓 - 神秘梦幻的蓝紫
    colors: ['#6C5CE7', '#A29BFE', '#7C73E6', '#B8B5FF'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#6C5CE7',
  },
  {
    // 🍑 水蜜桃 - 温柔甜美的桃粉
    colors: ['#FFAB91', '#FFCCBC', '#FF8A65', '#FFE0B2'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#FFAB91',
  },
  {
    // 🍉 西瓜 - 夏日清爽的红绿撞色
    colors: ['#FF5252', '#FF8A80', '#FF1744', '#90CAF9'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#FF5252',
  },
  {
    // 🍇 葡萄 - 优雅的紫罗兰
    colors: ['#9C27B0', '#BA68C8', '#AB47BC', '#E1BEE7'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#9C27B0',
  },
  {
    // 🌴 热带水果 - 芒果凤梨的热情
    colors: ['#FF6F00', '#FFB300', '#FFA000', '#FFE082'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#FF6F00',
  },
  {
    // 🍒 樱桃 - 甜蜜收尾的深红
    colors: ['#E91E63', '#F48FB1', '#EC407A', '#F8BBD9'] as [
      string,
      string,
      string,
      string,
    ],
    accent: '#E91E63',
  },
];

// 颜色类型
type ColorTuple = [string, string, string, string];

/**
 * 颜色插值函数 - 将 hex 转为 rgb 并线性插值
 */
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
};

const rgbToHex = (r: number, g: number, b: number): string => {
  return (
    '#' +
    [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('')
  );
};

const lerpColor = (color1: string, color2: string, t: number): string => {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  return rgbToHex(
    rgb1[0] + (rgb2[0] - rgb1[0]) * t,
    rgb1[1] + (rgb2[1] - rgb1[1]) * t,
    rgb1[2] + (rgb2[2] - rgb1[2]) * t
  );
};

/**
 * 颜色过渡 Hook - 平滑插值颜色数组
 */
const useColorTransition = (
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
 * 欢迎介绍屏幕 - 点击后开始动画，带动态模糊滑出效果
 */
const WelcomeScreen: React.FC<{ onStart: () => void }> = ({ onStart }) => {
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
          onStart();
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
      onStart();
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

import type { CoffeeBean } from '@/types/app';

/**
 * 第一屏：开场动画（Apple Music Replay 风格）
 * 分段展示，每段独立滑入滑出，不同位置
 */
const IntroScreen: React.FC<{
  beanImages: string[];
  totalWeight: number;
  beans: CoffeeBean[];
  onComplete?: () => void;
}> = ({ beanImages, totalWeight, beans, onComplete }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const blurRef = useRef<SVGFEGaussianBlurElement>(null);

  // 当前显示的段落索引（0, 1, 1.5, 2）
  const [currentSegment, setCurrentSegment] = useState<number>(0);

  // 用于追踪上一帧位置，计算速度
  const lastXRef = useRef<number>(0);
  const velocityRef = useRef<number>(0);
  const activeElementRef = useRef<HTMLDivElement | null>(null);

  // 速度追踪器
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

  // 段落 0: Replay'25 - 底部位置
  const Segment0 = () => {
    const ref = useRef<HTMLDivElement>(null);

    useGSAP(
      () => {
        if (!ref.current) return;
        activeElementRef.current = ref.current;
        gsap.ticker.add(updateBlur);

        const tl = gsap.timeline({
          onComplete: () => {
            gsap.ticker.remove(updateBlur);
            if (blurRef.current) {
              blurRef.current.setAttribute('stdDeviation', '0, 0');
            }
            setCurrentSegment(1);
          },
        });

        // 快速进入 -> 极慢微移（几乎静止） -> 加速退出
        tl.set(ref.current, { x: '100%', opacity: 0 })
          .to(ref.current, {
            x: '2%', // 进入到稍微偏右的位置
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
          })
          .to(ref.current, {
            x: '-2%', // 极慢地微移一小段距离
            duration: 1.2,
            ease: 'none', // 线性匀速，非常慢
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

  // 段落 1: 主标题两行 - 顶部位置
  const Segment1 = () => {
    const ref = useRef<HTMLDivElement>(null);

    useGSAP(
      () => {
        if (!ref.current) return;
        activeElementRef.current = ref.current;
        gsap.ticker.add(updateBlur);

        const tl = gsap.timeline({
          onComplete: () => {
            gsap.ticker.remove(updateBlur);
            if (blurRef.current) {
              blurRef.current.setAttribute('stdDeviation', '0, 0');
            }
            // 如果有咖啡豆图片，跳转到图片段落；否则跳转到结尾段落
            setCurrentSegment(1.5);
          },
        });

        // 快速进入 -> 极慢微移（几乎静止） -> 加速退出
        tl.set(ref.current, { x: '100%', opacity: 0 })
          .to(ref.current, {
            x: '2%', // 进入到稍微偏右的位置
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
          })
          .to(ref.current, {
            x: '-2%', // 极慢地微移一小段距离
            duration: 1.5,
            ease: 'none', // 线性匀速，非常慢
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
        className="absolute inset-x-0 top-12 flex flex-col pl-4"
        style={{
          filter: 'url(#motion-blur)',
          willChange: 'transform, opacity',
        }}
      >
        <span className="text-[3rem] leading-tight font-bold tracking-tight text-white">
          这一年你陆续
        </span>
        <span className="text-[3rem] leading-tight font-bold tracking-tight text-white">
          喝了各种咖啡
        </span>
      </div>
    );
  };

  // 段落 1.5: 咖啡豆图片展示 - 每张图片依次从右向左滑过
  const SegmentImages = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

    // 间距配置
    const GAP = 8; // 图片间距 px
    const PADDING = 32; // 上下留白 px

    // 根据容器高度和图片数量计算图片大小
    const getLayoutInfo = () => {
      const containerHeight = containerRef.current?.clientHeight || 600;
      const availableHeight = containerHeight - PADDING * 2; // 可用高度
      const totalGaps = (beanImages.length - 1) * GAP;
      const imageSize = Math.floor(
        (availableHeight - totalGaps) / beanImages.length
      );
      return { imageSize: Math.min(imageSize, 150), containerHeight }; // 最大不超过 150px
    };

    const getImageStyle = (index: number, imageSize: number) => {
      // 从下往上排列
      const bottom = PADDING + index * (imageSize + GAP);

      return {
        left: '50%',
        bottom: `${bottom}px`,
        transform: 'translateX(-50%)',
        width: `${imageSize}px`,
        height: `${imageSize}px`,
        zIndex: index,
      };
    };

    const [imageSize, setImageSize] = useState(120);

    useEffect(() => {
      if (containerRef.current) {
        const { imageSize } = getLayoutInfo();
        setImageSize(imageSize);
      }
    }, [beanImages.length]);

    useGSAP(
      () => {
        if (!containerRef.current || beanImages.length === 0) {
          setCurrentSegment(2);
          return;
        }

        const { imageSize } = getLayoutInfo();
        setImageSize(imageSize);

        const tl = gsap.timeline({
          onComplete: () => {
            setCurrentSegment(2);
          },
        });

        // 每张图片采用和文字一样的"快慢快"动画节奏
        const containerWidth = containerRef.current.clientWidth;
        const staggerDelay = 0.05; // 每张图片的延迟

        imageRefs.current.forEach((ref, index) => {
          if (!ref) return;

          // 初始位置在屏幕右侧外
          gsap.set(ref, {
            x: containerWidth,
            opacity: 0,
          });

          // 快速进入 -> 极慢微移 -> 加速退出（和文字动画一致）
          tl.to(
            ref,
            {
              x: 20, // 进入到稍微偏右的位置
              opacity: 1,
              duration: 0.3,
              ease: 'power3.out',
            },
            index * staggerDelay
          )
            .to(
              ref,
              {
                x: -20, // 极慢地微移一小段距离
                duration: 0.5,
                ease: 'none',
              },
              0.3 + index * staggerDelay
            )
            .to(
              ref,
              {
                x: -containerWidth,
                opacity: 0,
                duration: 0.3,
                ease: 'power3.in',
              },
              0.8 + index * staggerDelay
            );
        });
      },
      { scope: containerRef, dependencies: [beanImages] }
    );

    return (
      <div ref={containerRef} className="absolute inset-0 overflow-hidden">
        {beanImages.map((image, index) => {
          const style = getImageStyle(index, imageSize);
          return (
            <div
              key={index}
              ref={el => {
                imageRefs.current[index] = el;
              }}
              className="absolute overflow-hidden rounded shadow ring-1 ring-white/20"
              style={{
                ...style,
                willChange: 'transform',
              }}
            >
              <img
                src={image}
                alt="咖啡豆"
                className="h-full w-full object-cover"
              />
            </div>
          );
        })}
      </div>
    );
  };

  // 段落 2: 让我们来回顾一下吧 - 居中位置（缓慢移动后退出）
  const Segment2 = () => {
    const ref = useRef<HTMLDivElement>(null);

    useGSAP(
      () => {
        if (!ref.current) return;
        activeElementRef.current = ref.current;
        gsap.ticker.add(updateBlur);

        const tl = gsap.timeline({
          onComplete: () => {
            gsap.ticker.remove(updateBlur);
            if (blurRef.current) {
              blurRef.current.setAttribute('stdDeviation', '0, 0');
            }
          },
        });

        // 快速进入 -> 极慢微移（几乎静止） -> 加速退出
        tl.set(ref.current, { x: '100%', opacity: 0 })
          .to(ref.current, {
            x: '2%', // 进入到稍微偏右的位置
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
          })
          .to(ref.current, {
            x: '-2%', // 极慢地微移一小段距离
            duration: 1.5,
            ease: 'none', // 线性匀速，非常慢
          })
          .to(ref.current, {
            x: '-120%',
            opacity: 0,
            duration: 0.5,
            ease: 'power3.in',
            onComplete: () => {
              setCurrentSegment(3);
            },
          });
      },
      { scope: ref }
    );

    return (
      <div
        ref={ref}
        className="absolute inset-x-0 flex justify-end pr-4 text-[2rem] font-bold tracking-tight text-white"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          filter: 'url(#motion-blur)',
          willChange: 'transform, opacity',
        }}
      >
        一起来回顾下吧
      </div>
    );
  };

  // 段落 3: 今年一共买了 NNNNNg 豆子 - 左上角标签 + 超大文字同步动画
  const Segment3 = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const labelRef = useRef<HTMLDivElement>(null);
    const bigTextRef = useRef<HTMLDivElement>(null);

    // 格式化重量数字
    const formattedWeight = Math.round(totalWeight).toLocaleString();

    useGSAP(
      () => {
        if (!labelRef.current || !bigTextRef.current) return;
        activeElementRef.current = labelRef.current;
        gsap.ticker.add(updateBlur);

        // 使用同一个 timeline 让两个元素同步动画
        const tl = gsap.timeline({
          onComplete: () => {
            gsap.ticker.remove(updateBlur);
            if (blurRef.current) {
              blurRef.current.setAttribute('stdDeviation', '0, 0');
            }
          },
        });

        // 左上角标签动画 - 快慢快模式
        tl.set(labelRef.current, { x: '100%', opacity: 0 })
          .to(labelRef.current, {
            x: '2%',
            opacity: 1,
            duration: 0.5,
            ease: 'power3.out',
          })
          .to(labelRef.current, {
            x: '-2%',
            duration: 1.5,
            ease: 'none',
          })
          .to(labelRef.current, {
            x: '-120%',
            opacity: 0,
            duration: 0.5,
            ease: 'power3.in',
            onComplete: () => {
              setCurrentSegment(4);
            },
          });

        // 超大文字动画 - 从屏幕右侧边缘匀速滚动到完全离开左侧
        // 独立的 timeline，但同时开始
        gsap.fromTo(
          bigTextRef.current,
          { x: '100%', opacity: 1 }, // 从屏幕右侧边缘开始
          {
            x: '-100%', // 滚动到完全离开屏幕左侧
            opacity: 1,
            duration: 2.5, // 总时长和标签一致
            ease: 'none', // 完全匀速
          }
        );
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
            filter: 'url(#motion-blur)',
            willChange: 'transform, opacity',
          }}
        >
          <span className="text-[3rem] leading-tight font-bold tracking-tight">
            今年你一共买了
          </span>
          <span className="text-[3rem] leading-tight font-bold tracking-tight">
            {formattedWeight}g 咖啡豆
          </span>
        </div>

        {/* 超大重量文字 - 从右到左匀速滚动 */}
        <div
          ref={bigTextRef}
          className="absolute flex items-center whitespace-nowrap"
          style={{
            top: '50%',
            left: '0',
            transform: 'translateY(-50%)',
            willChange: 'transform',
          }}
        >
          <span
            className="font-bold tracking-tighter text-white"
            style={{
              fontSize: 'clamp(200px, 55vw, 320px)',
              lineHeight: 0.85,
              textShadow: '0 4px 30px rgba(0,0,0,0.3)',
            }}
          >
            {formattedWeight}g
          </span>
        </div>
      </div>
    );
  };

  // 段落 4: 图片网格动画 - 3列4行，从右下到左上依次展开
  const Segment4 = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const imageRefs = useRef<(HTMLDivElement | null)[]>([]);

    // 网格配置：3列4行
    const COLS = 3;
    const ROWS = 4;
    const TOTAL_CELLS = COLS * ROWS; // 12个格子
    const GAP = 4; // 间距 4px

    // 计算今年购买的咖啡豆款数
    const beanCount = useMemo(() => {
      const currentYear = new Date().getFullYear();
      return beans.filter(bean => {
        const beanYear = new Date(bean.timestamp).getFullYear();
        return beanYear === currentYear;
      }).length;
    }, []);

    // 获取最多12张图片
    const gridImages = useMemo(() => {
      const images = beans
        .filter(bean => bean.image && bean.image.trim() !== '')
        .slice(0, TOTAL_CELLS)
        .map(bean => bean.image as string);
      return images;
    }, []);

    // 生成从右下到左上的顺序索引
    // 例如 3x4 网格：
    // 10 11 12
    //  7  8  9
    //  4  5  6
    //  1  2  3
    // 从右下(12)开始，到左上(10)结束
    const getAnimationOrder = () => {
      const order: number[] = [];
      // 从最后一行开始，每行从右到左
      for (let row = ROWS - 1; row >= 0; row--) {
        for (let col = COLS - 1; col >= 0; col--) {
          order.push(row * COLS + col);
        }
      }
      return order;
    };

    // 计算每个格子的目标位置（使用 calc 表达式处理间距）
    const getCellPosition = (index: number) => {
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      // 使用 calc 来计算包含间距的位置
      return {
        x: col, // 列索引
        y: row, // 行索引
      };
    };

    // 生成带间距的位置样式
    const getPositionStyle = (col: number, row: number) => {
      const totalGap = GAP * (COLS - 1);
      const cellWidth = `calc((100vw - 24px - ${totalGap}px) / ${COLS})`;
      return {
        x: `calc(${col} * (${cellWidth} + ${GAP}px))`,
        y: `calc(${row} * (${cellWidth} + ${GAP}px))`,
      };
    };

    useGSAP(
      () => {
        if (!gridRef.current || !textRef.current) return;
        activeElementRef.current = textRef.current;
        gsap.ticker.add(updateBlur);

        const animationOrder = getAnimationOrder();
        const totalImages = Math.min(gridImages.length, TOTAL_CELLS);

        // 计算实际像素尺寸
        const containerWidth = gridRef.current.clientWidth;
        const totalGapWidth = GAP * (COLS - 1);
        const cellWidth = (containerWidth - totalGapWidth) / COLS;

        // 主时间线
        const tl = gsap.timeline({
          onComplete: () => {
            gsap.ticker.remove(updateBlur);
            if (blurRef.current) {
              blurRef.current.setAttribute('stdDeviation', '0, 0');
            }
            // 动画完成后跳转到下一屏
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

        // 图片网格动画 - 所有图片同时从右侧滑入
        // 初始化：Y 轴在目标位置，X 轴根据顺序越靠后越远（形成视觉上的顺序感）
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

        // 所有图片同时开始滑入
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
              0.5 // 所有图片同时开始，与文字入场同步
            );
          }
        });

        // 文字继续微移
        tl.to(
          textRef.current,
          {
            x: '-2%',
            duration: 1.5,
            ease: 'none',
          },
          0.5
        );

        // 退出动画 - 在 2 秒时开始（0.5入场 + 1.5微移）
        // 文字退出
        tl.to(
          textRef.current,
          {
            x: '-120%',
            opacity: 0,
            duration: 0.5,
            ease: 'power3.in',
          },
          2.0
        );

        // 所有图片同时向左滑出，距离不同形成顺序感
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
              2.0 // 与文字同时开始退出
            );
          }
        });
      },
      { scope: containerRef }
    );

    // 计算格子尺寸（正方形），考虑间距
    const totalGap = GAP * (COLS - 1); // 总间距
    const cellSize = `calc((100vw - 24px - ${totalGap}px) / ${COLS})`; // 减去左右边距和间距

    return (
      <div ref={containerRef} className="absolute inset-0 overflow-hidden">
        {/* 图片网格容器 */}
        <div
          ref={gridRef}
          className="absolute top-3 right-3 left-3"
          style={{
            height: `calc(((100vw - 24px - ${totalGap}px) / ${COLS} + ${GAP}px) * ${ROWS} - ${GAP}px)`, // 保持正方形比例，考虑间距
          }}
        >
          {/* 网格单元格 */}
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
            全部有 {beanCount} 款
          </span>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
    >
      {/* SVG 滤镜定义 - 用于运动模糊 */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter id="motion-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur
              ref={blurRef}
              in="SourceGraphic"
              stdDeviation="0, 0"
            />
          </filter>
        </defs>
      </svg>

      {/* 根据当前段落显示对应内容 */}
      {currentSegment === 0 && <Segment0 />}
      {currentSegment === 1 && <Segment1 />}
      {currentSegment === 1.5 && <SegmentImages />}
      {currentSegment === 2 && <Segment2 />}
      {currentSegment === 3 && <Segment3 />}
      {currentSegment === 4 && <Segment4 />}
    </div>
  );
};

/**
 * 屏幕内容组件 - 带过渡动画
 */
const ScreenContent: React.FC<{
  screenIndex: number;
  direction: number;
  hasStarted: boolean;
  isPreviewEnd: boolean;
  onStart: () => void;
  onPreviewEnd: () => void;
  onReplay: () => void;
  beanImages: string[];
  totalWeight: number;
  beans: CoffeeBean[];
}> = ({
  screenIndex,
  direction,
  hasStarted,
  isPreviewEnd,
  onStart,
  onPreviewEnd,
  onReplay,
  beanImages,
  totalWeight,
  beans,
}) => {
  // 滑动变体动画
  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 100 : -100,
      opacity: 0,
      scale: 0.95,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -100 : 100,
      opacity: 0,
      scale: 0.95,
    }),
  };

  // 根据屏幕索引渲染不同内容
  const renderContent = () => {
    // 如果预览结束，显示结束页面
    if (isPreviewEnd) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center px-8">
          <motion.div
            className="flex flex-col items-center gap-4 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="text-2xl font-bold text-white">
              感谢你的支持！
            </span>
            <span className="text-base leading-relaxed text-white/80">
              这只是预览版，完整版将在今年晚些推出～
            </span>
            <button
              onClick={onReplay}
              className="mt-4 flex items-center gap-2 rounded-full bg-white/20 px-6 py-3 text-base font-medium text-white backdrop-blur-sm transition-all hover:bg-white/30 active:scale-95"
            >
              重播
            </button>
          </motion.div>
        </div>
      );
    }

    // 如果还没开始，显示欢迎屏幕
    if (!hasStarted && screenIndex === 0) {
      return <WelcomeScreen onStart={onStart} />;
    }

    switch (screenIndex) {
      case 0:
        return (
          <IntroScreen
            beanImages={beanImages}
            totalWeight={totalWeight}
            beans={beans}
            onComplete={onPreviewEnd}
          />
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      className="absolute inset-0"
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        x: { type: 'spring', stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 },
      }}
    >
      {renderContent()}
    </motion.div>
  );
};

/**
 * 年度回顾抽屉组件
 * 类似 Instagram/Spotify 年度回顾的 Stories 风格设计
 */
const YearlyReviewDrawer: React.FC<YearlyReviewDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  // 当前进度（0-9，对应 10 个屏幕）
  const [currentScreen, setCurrentScreen] = useState(0);
  // 滑动方向：1 = 向右/下一个，-1 = 向左/上一个
  const [direction, setDirection] = useState(0);
  // 是否已经开始播放动画
  const [hasStarted, setHasStarted] = useState(false);
  // 预览版是否结束
  const [isPreviewEnd, setIsPreviewEnd] = useState(false);
  // 用户名
  const [username, setUsername] = useState('COFFEE');

  // 获取咖啡豆数据
  const beans = useCoffeeBeanStore(state => state.beans);

  // 提取有图片的咖啡豆图片列表（最多取 5 张）
  const beanImages = useMemo(() => {
    return beans
      .filter(bean => bean.image && bean.image.trim() !== '')
      .slice(0, 5)
      .map(bean => bean.image as string);
  }, [beans]);

  // 计算今年购买的咖啡豆总重量（克）
  const totalWeight = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return beans
      .filter(bean => {
        // 根据时间戳判断是否是今年的咖啡豆
        const beanYear = new Date(bean.timestamp).getFullYear();
        return beanYear === currentYear;
      })
      .reduce((total, bean) => {
        // 解析容量字段，提取数字部分
        if (bean.capacity) {
          const match = bean.capacity.match(/(\d+(?:\.\d+)?)/);
          if (match) {
            return total + parseFloat(match[1]);
          }
        }
        return total;
      }, 0);
  }, [beans]);

  // 生成稳定的唯一 ID
  const [autoId] = useState(
    () =>
      `yearly-review-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  // 集成历史栈管理，支持返回键关闭
  useModalHistory({
    id: autoId,
    isOpen,
    onClose,
  });

  // 处理打开状态变化
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // 获取用户名
  useEffect(() => {
    const loadUsername = async () => {
      try {
        const settingsStr = await Storage.get('brewGuideSettings');
        if (settingsStr) {
          const settings = JSON.parse(settingsStr);
          const name = settings.username?.trim();
          if (name) {
            setUsername(name);
          }
        }
      } catch (e) {
        console.error('获取用户名失败', e);
      }
    };
    if (isOpen) {
      loadUsername();
    }
  }, [isOpen]);

  // 重置进度当抽屉关闭后重新打开
  React.useEffect(() => {
    if (isOpen) {
      setCurrentScreen(0);
      setDirection(0);
      setHasStarted(false);
      setIsPreviewEnd(false);
    }
  }, [isOpen]);

  // 开始播放动画
  const handleStart = () => {
    setHasStarted(true);
  };

  // 预览结束
  const handlePreviewEnd = () => {
    setIsPreviewEnd(true);
  };

  // 重播
  const handleReplay = () => {
    setIsPreviewEnd(false);
    setHasStarted(false);
    setCurrentScreen(0);
    setDirection(0);
  };

  // 根据状态选择主题颜色
  const currentTheme = isPreviewEnd
    ? PREVIEW_END_THEME
    : hasStarted
      ? SCREEN_THEMES[currentScreen]
      : WELCOME_THEME;

  // 使用颜色过渡 Hook 实现平滑切换
  const transitionedColors = useColorTransition(currentTheme.colors, 800);

  return (
    <>
      {/* 预加载 GrainGradient shader - 隐藏但保持挂载 */}
      <div
        className="pointer-events-none fixed"
        style={{
          width: 1,
          height: 1,
          opacity: 0,
          zIndex: -9999,
        }}
        aria-hidden="true"
      >
        <GrainGradient
          colors={WELCOME_THEME.colors}
          colorBack={WELCOME_THEME.colors[2]}
          shape="wave"
          speed={0}
          style={{ width: 1, height: 1 }}
        />
      </div>

      <Drawer.Root
        open={isOpen}
        onOpenChange={handleOpenChange}
        repositionInputs={false}
      >
        <Drawer.Portal>
          {/* 背景遮罩 */}
          <Drawer.Overlay
            className="fixed! inset-0 z-50 bg-black/50"
            style={{ position: 'fixed' }}
          />

          {/* 抽屉内容 - 固定高度，几乎占满屏幕 */}
          <Drawer.Content
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-w-[500px] flex-col rounded-t-3xl outline-none"
            style={{
              height: 'calc(100dvh - 24px)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
            aria-describedby={undefined}
          >
            {/* 无障碍标题 - 视觉隐藏 */}
            <Drawer.Title className="sr-only">年度回顾</Drawer.Title>

            {/* GrainGradient 背景 - 横向拉丝波浪效果 */}
            <div
              className="absolute inset-0 overflow-hidden rounded-t-3xl"
              style={{
                backgroundColor: transitionedColors[0],
                background: `linear-gradient(135deg, ${transitionedColors[0]} 0%, ${transitionedColors[2]} 50%, ${transitionedColors[1]} 100%)`,
              }}
            >
              <GrainGradient
                colors={transitionedColors}
                colorBack={transitionedColors[2]}
                shape="wave"
                speed={0.8}
                softness={0.8}
                intensity={0.5}
                noise={0.08}
                scale={2}
                rotation={90}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                }}
              />
              {/* 底部渐变遮罩 */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4"
                style={{
                  background: `linear-gradient(0deg, ${transitionedColors[2]}cc 0%, transparent 100%)`,
                }}
              />
            </div>

            {/* 主内容区域 */}
            <div className="relative flex h-full flex-col pt-4">
              {/* 关闭按钮 - 右上角固定 */}
              <div className="relative z-10 flex justify-end px-4">
                <motion.button
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-black/30 text-white/70 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X size={18} />
                </motion.button>
              </div>

              {/* 进度条区域 - 仅在开始后且未结束时显示，带淡入动画 */}
              <AnimatePresence>
                {hasStarted && !isPreviewEnd && (
                  <motion.div
                    className="relative z-10 mt-3 flex gap-1 px-4"
                    initial={{ opacity: 0, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                  >
                    {Array.from({ length: TOTAL_SCREENS }).map((_, index) => (
                      <div
                        key={index}
                        className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/40"
                      >
                        {/* 已完成的进度条 - 直接显示满 */}
                        {index < currentScreen && (
                          <div className="h-full w-full bg-white/90" />
                        )}
                        {/* 当前进度条 - 带动画 */}
                        {index === currentScreen && (
                          <motion.div
                            key={`progress-${currentScreen}`}
                            className="h-full bg-white/90"
                            initial={{ width: '0%' }}
                            animate={{ width: '100%' }}
                            transition={{
                              duration: 5,
                              ease: 'linear',
                            }}
                          />
                        )}
                        {/* 未完成的进度条 - 不显示 */}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 标识区域 - 仅在开始后且未结束时显示，带淡入动画 */}
              <AnimatePresence>
                {hasStarted && !isPreviewEnd && (
                  <motion.div
                    className="relative z-10 mt-1 flex items-center justify-between px-4 text-lg font-medium text-neutral-100"
                    initial={{ opacity: 0, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
                  >
                    <span className="-ml-[0.05em] tracking-tight">
                      Replay&apos;25
                    </span>
                    <span className="-mr-[0.05em] tracking-tight">
                      @{username}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 内容区域 - 带切换动画 */}
              <div className="relative flex-1 overflow-hidden">
                <AnimatePresence mode="wait" custom={direction}>
                  <ScreenContent
                    key={
                      isPreviewEnd
                        ? 'preview-end'
                        : hasStarted
                          ? currentScreen
                          : 'welcome'
                    }
                    screenIndex={currentScreen}
                    direction={direction}
                    hasStarted={hasStarted}
                    isPreviewEnd={isPreviewEnd}
                    onStart={handleStart}
                    onPreviewEnd={handlePreviewEnd}
                    onReplay={handleReplay}
                    beanImages={beanImages}
                    totalWeight={totalWeight}
                    beans={beans}
                  />
                </AnimatePresence>
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
};

export default YearlyReviewDrawer;
