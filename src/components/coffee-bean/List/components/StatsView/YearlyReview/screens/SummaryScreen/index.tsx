'use client';

import React, { useRef, useMemo, useState, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import type { CoffeeBean } from '@/types/app';
import { extractRoasterFromName } from '@/lib/utils/beanVarietyUtils';
import RoasterLogoManager from '@/lib/managers/RoasterLogoManager';

interface SummaryScreenProps {
  beans: CoffeeBean[];
  onComplete?: () => void;
}

/**
 * 第十屏：年度总结页
 * - 顶部: 2025
 * - 2x2 文案布局: 最爱烘焙商(1)、最爱产地(3)、最爱豆种(3)、最爱处理法(3)
 * - 底部: 四张图片从右边出现围绕中心旋转，烘焙商圆形，其他正方形
 */
const SummaryScreen: React.FC<SummaryScreenProps> = ({ beans, onComplete }) => {
  const [roasterLogo, setRoasterLogo] = useState<string | null>(null);

  // 统计数据
  const stats = useMemo(() => {
    // 烘焙商统计
    const roasterCount = new Map<string, { count: number; images: string[] }>();
    // 产地统计
    const originCount = new Map<string, { count: number; image?: string }>();
    // 品种统计
    const varietyCount = new Map<string, { count: number; image?: string }>();
    // 处理法统计
    const processCount = new Map<string, { count: number; image?: string }>();

    beans.forEach(bean => {
      // 烘焙商
      const roaster = extractRoasterFromName(bean.name);
      if (roaster !== '未知烘焙商') {
        if (!roasterCount.has(roaster)) {
          roasterCount.set(roaster, { count: 0, images: [] });
        }
        const data = roasterCount.get(roaster)!;
        data.count += 1;
        if (bean.image) {
          data.images.push(bean.image);
        }
      }

      // 产地、品种、处理法
      if (bean.blendComponents && bean.blendComponents.length > 0) {
        bean.blendComponents.forEach(comp => {
          // 产地
          if (comp.origin) {
            if (!originCount.has(comp.origin)) {
              originCount.set(comp.origin, { count: 0, image: bean.image });
            }
            originCount.get(comp.origin)!.count += 1;
          }
          // 品种
          if (comp.variety) {
            if (!varietyCount.has(comp.variety)) {
              varietyCount.set(comp.variety, { count: 0, image: bean.image });
            }
            varietyCount.get(comp.variety)!.count += 1;
          }
          // 处理法
          if (comp.process) {
            if (!processCount.has(comp.process)) {
              processCount.set(comp.process, { count: 0, image: bean.image });
            }
            processCount.get(comp.process)!.count += 1;
          }
        });
      }
    });

    // 获取最喜欢的烘焙商
    let topRoaster = { name: '未知', count: 0, images: [] as string[] };
    roasterCount.forEach((data, name) => {
      if (data.count > topRoaster.count) {
        topRoaster = { name, ...data };
      }
    });

    // 获取前三的产地
    const topOrigins = Array.from(originCount.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // 获取前三的品种
    const topVarieties = Array.from(varietyCount.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // 获取前三的处理法
    const topProcesses = Array.from(processCount.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    return {
      roaster: topRoaster,
      origins: topOrigins,
      varieties: topVarieties,
      processes: topProcesses,
    };
  }, [beans]);

  // 获取旋转展示的图片
  const rotatingImages = useMemo(() => {
    const images: Array<{
      src: string;
      isRoaster: boolean;
      label: string;
    }> = [];

    // 烘焙商图片（圆形）- 使用 logo 或第一张豆子图片
    if (roasterLogo) {
      images.push({
        src: roasterLogo,
        isRoaster: true,
        label: stats.roaster.name,
      });
    } else if (stats.roaster.images.length > 0) {
      images.push({
        src: stats.roaster.images[0],
        isRoaster: true,
        label: stats.roaster.name,
      });
    }

    // 产地图片（正方形）
    if (stats.origins[0]?.image) {
      images.push({
        src: stats.origins[0].image,
        isRoaster: false,
        label: stats.origins[0].name,
      });
    }

    // 品种图片（正方形）
    if (stats.varieties[0]?.image) {
      images.push({
        src: stats.varieties[0].image,
        isRoaster: false,
        label: stats.varieties[0].name,
      });
    }

    // 处理法图片（正方形）
    if (stats.processes[0]?.image) {
      images.push({
        src: stats.processes[0].image,
        isRoaster: false,
        label: stats.processes[0].name,
      });
    }

    // 确保至少有4张图，不够则用已有的填充
    while (images.length < 4 && images.length > 0) {
      images.push({ ...images[images.length % images.length] });
    }

    return images.slice(0, 4);
  }, [roasterLogo, stats]);

  // 加载烘焙商图标
  useEffect(() => {
    if (stats.roaster.name && stats.roaster.name !== '未知') {
      RoasterLogoManager.getLogoByRoaster(stats.roaster.name).then(logo => {
        setRoasterLogo(logo);
      });
    }
  }, [stats.roaster.name]);

  return (
    <div className="h-full w-full pt-24">
      <SummaryContent
        stats={stats}
        rotatingImages={rotatingImages}
        onComplete={onComplete}
      />
    </div>
  );
};

interface SummaryContentProps {
  stats: {
    roaster: { name: string; count: number };
    origins: Array<{ name: string; count: number }>;
    varieties: Array<{ name: string; count: number }>;
    processes: Array<{ name: string; count: number }>;
  };
  rotatingImages: Array<{ src: string; isRoaster: boolean; label: string }>;
  onComplete?: () => void;
}

const SummaryContent: React.FC<SummaryContentProps> = ({
  stats,
  rotatingImages,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const orbitContainerRef = useRef<HTMLDivElement>(null);
  const imageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const gridBlurRef = useRef<SVGFEGaussianBlurElement>(null);

  // 每个文案项的 ref
  const textItemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 运动模糊追踪
  const gridLastX = useRef<number>(0);
  const gridVelocity = useRef<number>(0);

  const updateGridBlur = () => {
    if (!gridRef.current || !gridBlurRef.current) return;

    const transform = getComputedStyle(gridRef.current).transform;
    if (transform === 'none') return;

    const matrix = new DOMMatrix(transform);
    const currentX = matrix.m41;
    const velocity = Math.abs(currentX - gridLastX.current);
    gridLastX.current = currentX;
    gridVelocity.current = gridVelocity.current * 0.7 + velocity * 0.3;
    const blurAmount = Math.min(gridVelocity.current * 0.6, 30);
    gridBlurRef.current.setAttribute('stdDeviation', `${blurAmount}, 0`);
  };

  useGSAP(
    () => {
      if (!containerRef.current || !yearRef.current || !gridRef.current) return;

      const containerWidth = containerRef.current.clientWidth;
      const containerHeight = containerRef.current.clientHeight;

      // 图片尺寸和轨道半径 - 适中大小产生重叠效果
      const IMAGE_SIZE = Math.min(containerWidth * 0.34, 130);
      const ORBIT_RADIUS = Math.min(containerWidth * 0.22, 85);

      // 中心点位置 (在下半部分，下移一点)
      const centerX = containerWidth / 2;
      const centerY = containerHeight * 0.72;

      const tl = gsap.timeline({
        onComplete: () => {
          // 清理 ticker
          gsap.ticker.remove(updateGridBlur);
          if (gridBlurRef.current) {
            gridBlurRef.current.setAttribute('stdDeviation', '0, 0');
          }
          onComplete?.();
        },
      });

      // ===== 第一部分: 年份动画 =====
      gsap.set(yearRef.current, { x: '100%', opacity: 0 });
      tl.to(yearRef.current, {
        x: '2%',
        opacity: 1,
        duration: 0.5,
        ease: 'power3.out',
      });

      // ===== 第二部分: 2x2 文案网格动画 =====
      gsap.set(gridRef.current, { x: '100%', opacity: 0 });
      gsap.ticker.add(updateGridBlur);

      // 快-慢-快 动画，停留在固定位置
      tl.to(
        gridRef.current,
        {
          x: '0%',
          opacity: 1,
          duration: 0.5,
          ease: 'power3.out',
        },
        0.2
      )
        .to(
          gridRef.current,
          {
            x: '0%',
            duration: 1.5,
            ease: 'none',
          },
          0.7
        )
        .to(
          gridRef.current,
          {
            x: '0%',
            duration: 0.3,
            ease: 'power2.out',
          },
          2.2
        );

      // ===== 第三部分: 图片从右边出现并旋转 =====
      if (rotatingImages.length > 0 && orbitContainerRef.current) {
        // 设置轨道容器位置
        gsap.set(orbitContainerRef.current, {
          left: centerX,
          top: centerY,
          xPercent: 0,
          yPercent: 0,
          rotation: 0,
        });

        // 设置图片初始位置（在轨道容器右边屏幕外）
        imageRefs.current.forEach((ref, index) => {
          if (!ref) return;
          const isRoaster = rotatingImages[index]?.isRoaster;
          const size = isRoaster ? IMAGE_SIZE * 1.2 : IMAGE_SIZE;
          ref.style.width = `${size}px`;
          ref.style.height = `${size}px`;

          // 初始位置：在右边屏幕外
          gsap.set(ref, {
            x: containerWidth,
            y: -size / 2,
            opacity: 0,
            rotation: 0,
          });
        });

        // 图片依次从右边滑入到圆周位置
        const entryStartTime = 0.8;
        imageRefs.current.forEach((ref, index) => {
          if (!ref) return;
          const isRoaster = rotatingImages[index]?.isRoaster;
          const size = isRoaster ? IMAGE_SIZE * 1.2 : IMAGE_SIZE;

          // 计算每个图片在圆周上的位置（均匀分布，从顶部开始）
          const angle =
            (index * Math.PI * 2) / rotatingImages.length - Math.PI / 2;
          const targetX = Math.cos(angle) * ORBIT_RADIUS - size / 2;
          const targetY = Math.sin(angle) * ORBIT_RADIUS - size / 2;

          // 入场到圆周位置
          tl.to(
            ref,
            {
              x: targetX,
              y: targetY,
              opacity: 1,
              duration: 0.5,
              ease: 'power3.out',
            },
            entryStartTime + index * 0.15
          );
        });

        // 开始整体旋转
        const rotateStartTime =
          entryStartTime + rotatingImages.length * 0.15 + 0.3;
        const orbitDuration = 15;

        // 整个轨道容器旋转一圈
        tl.to(
          orbitContainerRef.current,
          {
            rotation: 360,
            duration: orbitDuration,
            ease: 'none',
          },
          rotateStartTime
        );

        // 同时让每个图片反向旋转保持正向
        imageRefs.current.forEach(ref => {
          if (!ref) return;
          tl.to(
            ref,
            {
              rotation: -360,
              duration: orbitDuration,
              ease: 'none',
            },
            rotateStartTime
          );
        });

        // 退出动画 - 图片向左滑出
        const exitStartTime = rotateStartTime + orbitDuration - 0.3;
        imageRefs.current.forEach((ref, index) => {
          if (!ref) return;
          tl.to(
            ref,
            {
              x: -containerWidth,
              opacity: 0,
              duration: 0.5,
              ease: 'power3.in',
            },
            exitStartTime + index * 0.08
          );
        });
      }

      // 年份和网格退出
      const totalExitTime = 17;
      tl.to(
        yearRef.current,
        {
          x: '-120%',
          opacity: 0,
          duration: 0.5,
          ease: 'power3.in',
        },
        totalExitTime
      ).to(
        gridRef.current,
        {
          x: '-120%',
          opacity: 0,
          duration: 0.5,
          ease: 'power3.in',
        },
        totalExitTime
      );
    },
    {
      scope: containerRef,
      dependencies: [stats, rotatingImages],
    }
  );

  // 格式化列表文本 - 每个名称换行显示
  const formatListItems = (items: Array<{ name: string }>) => {
    return items.map(item => item.name);
  };

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden">
      {/* SVG 滤镜 */}
      <svg className="absolute h-0 w-0" aria-hidden="true">
        <defs>
          <filter
            id="summary-grid-blur"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur
              ref={gridBlurRef}
              in="SourceGraphic"
              stdDeviation="0, 0"
            />
          </filter>
        </defs>
      </svg>

      {/* 年份 */}
      <div
        ref={yearRef}
        className="absolute top-4 left-4"
        style={{ willChange: 'transform, opacity' }}
      >
        <span className="text-[3.5rem] leading-none font-bold tracking-tight text-white">
          2025
        </span>
      </div>

      {/* 2x2 文案网格 */}
      <div
        ref={gridRef}
        className="absolute top-24 right-0 left-0 px-4"
        style={{
          filter: 'url(#summary-grid-blur)',
          willChange: 'transform, opacity',
        }}
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          {/* 左上: 最爱烘焙商 */}
          <div
            ref={el => {
              textItemRefs.current[0] = el;
            }}
            className="flex flex-col"
          >
            <span className="text-sm font-medium text-white/80">
              最爱烘焙商
            </span>
            <span className="mt-1 text-xl leading-tight font-bold text-white">
              {stats.roaster.name}
            </span>
          </div>

          {/* 右上: 最爱产地 */}
          <div
            ref={el => {
              textItemRefs.current[1] = el;
            }}
            className="flex flex-col"
          >
            <span className="text-sm font-medium text-white/80">最爱产地</span>
            <div className="mt-1 flex flex-col">
              {formatListItems(stats.origins).map((name, i) => (
                <span
                  key={i}
                  className="text-lg leading-snug font-bold text-white"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* 左下: 最爱豆种 */}
          <div
            ref={el => {
              textItemRefs.current[2] = el;
            }}
            className="flex flex-col"
          >
            <span className="text-sm font-medium text-white/80">最爱豆种</span>
            <div className="mt-1 flex flex-col">
              {formatListItems(stats.varieties).map((name, i) => (
                <span
                  key={i}
                  className="text-lg leading-snug font-bold text-white"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* 右下: 最爱处理法 */}
          <div
            ref={el => {
              textItemRefs.current[3] = el;
            }}
            className="flex flex-col"
          >
            <span className="text-sm font-medium text-white/80">
              最爱处理法
            </span>
            <div className="mt-1 flex flex-col">
              {formatListItems(stats.processes).map((name, i) => (
                <span
                  key={i}
                  className="text-lg leading-snug font-bold text-white"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 旋转轨道容器 */}
      <div
        ref={orbitContainerRef}
        className="absolute"
        style={{
          willChange: 'transform',
          transformOrigin: 'center center',
        }}
      >
        {rotatingImages.map((img, index) => (
          <div
            key={index}
            ref={el => {
              imageRefs.current[index] = el;
            }}
            className={`absolute overflow-hidden shadow ${
              img.isRoaster ? 'rounded-full' : 'rounded'
            }`}
            style={{
              willChange: 'transform, opacity',
              zIndex: rotatingImages.length - index,
            }}
          >
            <img
              src={img.src}
              alt={img.label}
              loading="eager"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default SummaryScreen;
