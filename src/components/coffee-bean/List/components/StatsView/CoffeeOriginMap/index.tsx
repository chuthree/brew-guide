'use client';

import React, {
  useMemo,
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
} from 'react';
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from 'framer-motion';
import DottedMap from 'dotted-map/without-countries';
import mapDataJson from './mapData.json';
import { findRegionsByNames, type CoffeeRegion } from './coffeeRegions';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapData = mapDataJson as any;

/**
 * 咖啡产区地图组件
 *
 * 使用 dotted-map 创建极简的点阵世界地图，
 * 用彩色点标注用户的咖啡豆产区
 * 支持缩放、平移和点击定位
 */

interface CoffeeOriginMapProps {
  /** 产区名称列表 */
  origins: string[];
  /** 产区数量统计（产区名 -> 咖啡豆数量） */
  originCounts?: Map<string, number>;
  /** 自定义类名 */
  className?: string;
}

// SVG 视图框配置 - 必须与 dotted-map 生成的一致
const SVG_WIDTH = 126;
const SVG_HEIGHT = 60;
const MAP_HEIGHT = 160;

// 缩放限制
const MIN_SCALE = 1;
const MAX_SCALE = 4;

// 根据数量获取点的大小
function getPinRadius(count: number, maxCount: number): number {
  if (maxCount <= 1) return 0.6;
  const ratio = count / maxCount;
  return 0.4 + ratio * 0.4;
}

interface RegionWithCoords extends CoffeeRegion {
  svgX: number;
  svgY: number;
  count: number;
}

const CoffeeOriginMap: React.FC<CoffeeOriginMapProps> = memo(
  ({ origins, originCounts, className = '' }) => {
    // 使用 framer-motion 的 motion values 实现流畅的动画
    const scale = useMotionValue(1);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // 状态
    const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
    const [isTransformed, setIsTransformed] = useState(false);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const isDragging = useRef(false);
    const lastPointer = useRef<{ x: number; y: number } | null>(null);
    const lastPinchDistance = useRef<number | null>(null);
    const lastPinchCenter = useRef<{ x: number; y: number } | null>(null);

    // 存储回调函数的 refs（用于事件监听器）
    const scaleRef = useRef(scale);
    const xRef = useRef(x);
    const yRef = useRef(y);
    scaleRef.current = scale;
    xRef.current = x;
    yRef.current = y;

    // 监听变化更新状态
    useEffect(() => {
      const unsubscribeScale = scale.on('change', v => {
        setIsTransformed(
          v > 1.01 || Math.abs(x.get()) > 1 || Math.abs(y.get()) > 1
        );
      });
      const unsubscribeX = x.on('change', () => {
        setIsTransformed(
          scale.get() > 1.01 || Math.abs(x.get()) > 1 || Math.abs(y.get()) > 1
        );
      });
      const unsubscribeY = y.on('change', () => {
        setIsTransformed(
          scale.get() > 1.01 || Math.abs(x.get()) > 1 || Math.abs(y.get()) > 1
        );
      });
      return () => {
        unsubscribeScale();
        unsubscribeX();
        unsubscribeY();
      };
    }, [scale, x, y]);

    // 查找产区并使用 dotted-map 获取正确的 SVG 坐标
    const regionsWithCoords = useMemo((): RegionWithCoords[] => {
      const foundRegions = findRegionsByNames(origins);
      if (foundRegions.length === 0) return [];

      // 创建 map 实例并添加所有 pins
      const tempMap = new DottedMap({ map: mapData });
      foundRegions.forEach(region => {
        tempMap.addPin({
          lat: region.lat,
          lng: region.lng,
          data: { name: region.name },
          svgOptions: { color: 'transparent', radius: 0.01 }, // 占位，实际渲染用自定义的
        });
      });

      // 获取所有点，过滤出我们添加的 pins（有 data.name 属性的）
      const allPoints = tempMap.getPoints();
      const pinPoints = allPoints.filter(
        (p: { data?: { name?: string } }) => p.data?.name
      );

      // 构建 name -> 坐标 的映射
      const coordsMap = new Map<string, { x: number; y: number }>();
      pinPoints.forEach(p => {
        if (p.data?.name) {
          coordsMap.set(p.data.name, { x: p.x, y: p.y });
        }
      });

      return foundRegions.map(region => {
        const count = originCounts?.get(region.name) || 1;
        const coords = coordsMap.get(region.name) || { x: 0, y: 0 };
        return {
          ...region,
          svgX: coords.x,
          svgY: coords.y,
          count,
        };
      });
    }, [origins, originCounts]);

    // 计算最大数量
    const maxCount = useMemo(() => {
      if (!originCounts || originCounts.size === 0) return 1;
      return Math.max(...Array.from(originCounts.values()));
    }, [originCounts]);

    // 生成基础 SVG 地图
    const baseSvgContent = useMemo(() => {
      const map = new DottedMap({ map: mapData });
      const svgString = map.getSVG({
        radius: 0.22,
        color: 'currentColor',
        shape: 'circle',
        backgroundColor: 'transparent',
      });
      const match = svgString.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
      return match ? match[1] : '';
    }, []);

    // 限制平移范围
    const constrainTranslation = useCallback(
      (newX: number, newY: number, currentScale: number) => {
        const container = containerRef.current;
        if (!container) return { x: newX, y: newY };

        const containerWidth = container.clientWidth;
        const containerHeight = MAP_HEIGHT;

        // 计算允许的最大偏移
        const maxOffsetX = (containerWidth * (currentScale - 1)) / 2;
        const maxOffsetY = (containerHeight * (currentScale - 1)) / 2;

        return {
          x: Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)),
          y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)),
        };
      },
      []
    );

    // 重置视图
    const resetView = useCallback(() => {
      animate(scale, 1, { type: 'spring', stiffness: 300, damping: 30 });
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 30 });
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 30 });
      setSelectedRegion(null);
    }, [scale, x, y]);

    // 聚焦到产区
    const focusOnRegion = useCallback(
      (region: RegionWithCoords) => {
        const container = containerRef.current;
        if (!container) return;

        const containerWidth = container.clientWidth;
        const containerHeight = MAP_HEIGHT;

        const targetScale = 2.5;

        // 计算产区在容器中的相对位置 (0-1)
        const relX = region.svgX / SVG_WIDTH;
        const relY = region.svgY / SVG_HEIGHT;

        // 计算需要的偏移使产区居中
        const targetX = (0.5 - relX) * containerWidth * targetScale;
        const targetY = (0.5 - relY) * containerHeight * targetScale;

        // 应用约束
        const constrained = constrainTranslation(targetX, targetY, targetScale);

        animate(scale, targetScale, {
          type: 'spring',
          stiffness: 300,
          damping: 30,
        });
        animate(x, constrained.x, {
          type: 'spring',
          stiffness: 300,
          damping: 30,
        });
        animate(y, constrained.y, {
          type: 'spring',
          stiffness: 300,
          damping: 30,
        });
        setSelectedRegion(region.name);
      },
      [scale, x, y, constrainTranslation]
    );

    // 指针/触摸开始
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return; // 触摸事件单独处理
      e.preventDefault();
      isDragging.current = true;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, []);

    // 指针移动
    const handlePointerMove = useCallback(
      (e: React.PointerEvent) => {
        if (e.pointerType === 'touch') return;
        if (!isDragging.current || !lastPointer.current) return;

        const deltaX = e.clientX - lastPointer.current.x;
        const deltaY = e.clientY - lastPointer.current.y;

        const currentScale = scale.get();
        const newX = x.get() + deltaX;
        const newY = y.get() + deltaY;

        const constrained = constrainTranslation(newX, newY, currentScale);
        x.set(constrained.x);
        y.set(constrained.y);

        lastPointer.current = { x: e.clientX, y: e.clientY };
      },
      [scale, x, y, constrainTranslation]
    );

    // 指针结束
    const handlePointerUp = useCallback((e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return;
      isDragging.current = false;
      lastPointer.current = null;
    }, []);

    // 获取两点之间的距离
    const getDistance = useCallback((touch1: Touch, touch2: Touch) => {
      return Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
    }, []);

    // 获取两点的中心
    const getCenter = useCallback((touch1: Touch, touch2: Touch) => {
      return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
      };
    }, []);

    // 使用 useEffect 添加非 passive 的触摸和滚轮事件监听器
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          isDragging.current = true;
          lastPointer.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        } else if (e.touches.length === 2) {
          isDragging.current = false;
          lastPinchDistance.current = getDistance(e.touches[0], e.touches[1]);
          lastPinchCenter.current = getCenter(e.touches[0], e.touches[1]);
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        // 阻止默认行为（页面滚动）
        e.preventDefault();
        e.stopPropagation();

        const currentScale = scaleRef.current.get();
        const currentX = xRef.current.get();
        const currentY = yRef.current.get();

        if (
          e.touches.length === 1 &&
          isDragging.current &&
          lastPointer.current
        ) {
          // 单指拖动
          const deltaX = e.touches[0].clientX - lastPointer.current.x;
          const deltaY = e.touches[0].clientY - lastPointer.current.y;

          const newX = currentX + deltaX;
          const newY = currentY + deltaY;

          const containerWidth = container.clientWidth;
          const containerHeight = MAP_HEIGHT;
          const maxOffsetX = (containerWidth * (currentScale - 1)) / 2;
          const maxOffsetY = (containerHeight * (currentScale - 1)) / 2;

          xRef.current.set(Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)));
          yRef.current.set(Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)));

          lastPointer.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        } else if (
          e.touches.length === 2 &&
          lastPinchDistance.current &&
          lastPinchCenter.current
        ) {
          // 双指缩放
          const newDistance = getDistance(e.touches[0], e.touches[1]);
          const newCenter = getCenter(e.touches[0], e.touches[1]);

          // 计算缩放变化
          const scaleChange = newDistance / lastPinchDistance.current;
          const newScale = Math.min(
            MAX_SCALE,
            Math.max(MIN_SCALE, currentScale * scaleChange)
          );

          // 计算平移变化（跟随中心点）
          const centerDeltaX = newCenter.x - lastPinchCenter.current.x;
          const centerDeltaY = newCenter.y - lastPinchCenter.current.y;

          const newX = currentX + centerDeltaX;
          const newY = currentY + centerDeltaY;

          scaleRef.current.set(newScale);

          const containerWidth = container.clientWidth;
          const containerHeight = MAP_HEIGHT;
          const maxOffsetX = (containerWidth * (newScale - 1)) / 2;
          const maxOffsetY = (containerHeight * (newScale - 1)) / 2;

          xRef.current.set(Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)));
          yRef.current.set(Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)));

          lastPinchDistance.current = newDistance;
          lastPinchCenter.current = newCenter;
        }
      };

      const handleTouchEnd = () => {
        isDragging.current = false;
        lastPointer.current = null;
        lastPinchDistance.current = null;
        lastPinchCenter.current = null;
      };

      // 滚轮缩放
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();

        const rect = container.getBoundingClientRect();
        const pointerX = e.clientX - rect.left;
        const pointerY = e.clientY - rect.top;

        const currentScale = scaleRef.current.get();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.min(
          MAX_SCALE,
          Math.max(MIN_SCALE, currentScale * delta)
        );

        // 以鼠标位置为中心缩放
        const scaleRatio = newScale / currentScale;
        const currentX = xRef.current.get();
        const currentY = yRef.current.get();

        const containerCenterX = rect.width / 2;
        const containerCenterY = MAP_HEIGHT / 2;

        const newX =
          currentX - (pointerX - containerCenterX) * (scaleRatio - 1);
        const newY =
          currentY - (pointerY - containerCenterY) * (scaleRatio - 1);

        scaleRef.current.set(newScale);

        const containerWidth = container.clientWidth;
        const containerHeight = MAP_HEIGHT;
        const maxOffsetX = (containerWidth * (newScale - 1)) / 2;
        const maxOffsetY = (containerHeight * (newScale - 1)) / 2;

        xRef.current.set(Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)));
        yRef.current.set(Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)));
      };

      // 添加非 passive 的事件监听器
      container.addEventListener('touchstart', handleTouchStart, {
        passive: false,
      });
      container.addEventListener('touchmove', handleTouchMove, {
        passive: false,
      });
      container.addEventListener('touchend', handleTouchEnd, { passive: true });
      container.addEventListener('touchcancel', handleTouchEnd, {
        passive: true,
      });
      container.addEventListener('wheel', handleWheel, { passive: false });

      return () => {
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
        container.removeEventListener('touchcancel', handleTouchEnd);
        container.removeEventListener('wheel', handleWheel);
      };
    }, [getDistance, getCenter]);

    // 使用 transform 合成
    const transform = useTransform(
      [x, y, scale],
      ([latestX, latestY, latestScale]) => {
        return `translate(${latestX}px, ${latestY}px) scale(${latestScale})`;
      }
    );

    // 如果没有产区数据，不显示地图
    if (regionsWithCoords.length === 0) {
      return null;
    }

    return (
      <div className={`coffee-origin-map -mx-3 -mt-3 ${className}`}>
        {/* 地图容器 */}
        <div
          ref={containerRef}
          className="relative overflow-hidden rounded-sm select-none"
          style={{ height: `${MAP_HEIGHT}px`, touchAction: 'none' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* SVG 地图 */}
          <motion.div
            className="flex h-full w-full cursor-grab items-center justify-center active:cursor-grabbing"
            style={{ transform }}
          >
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="h-full w-full text-neutral-400/60 dark:text-neutral-600"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* 基础地图点阵 */}
              <g dangerouslySetInnerHTML={{ __html: baseSvgContent }} />

              {/* 产区标记点 */}
              {regionsWithCoords.map(region => {
                const radius = getPinRadius(region.count, maxCount);
                const isSelected = selectedRegion === region.name;

                return (
                  <g key={region.name}>
                    {/* 选中时的光晕效果 */}
                    {isSelected && (
                      <circle
                        cx={region.svgX}
                        cy={region.svgY}
                        r={radius * 2.5}
                        className="fill-neutral-500/20 dark:fill-neutral-400/20"
                      />
                    )}
                    {/* 主标记点 */}
                    <circle
                      cx={region.svgX}
                      cy={region.svgY}
                      r={radius}
                      className={`${isSelected ? 'fill-neutral-600 dark:fill-neutral-200' : 'fill-neutral-500 dark:fill-neutral-400'}`}
                    />
                  </g>
                );
              })}
            </svg>
          </motion.div>

          {/* 重置按钮 */}
          <AnimatePresence>
            {isTransformed && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={e => {
                  e.stopPropagation();
                  resetView();
                }}
                className="absolute top-2 right-2 rounded-full bg-neutral-200/50 px-2 py-1 text-xs font-medium whitespace-nowrap text-neutral-800 transition-colors dark:bg-neutral-600/50 dark:text-neutral-200"
              >
                重置
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* 产区标签滚动列表 */}
        <div className="relative mt-2">
          {/* 左侧渐变阴影 */}
          <div className="pointer-events-none absolute top-0 left-0 z-10 h-full w-4">
            <div className="h-full w-full bg-linear-to-r from-neutral-100 to-transparent dark:hidden" />
            <div className="hidden h-full w-full bg-linear-to-r from-[#1D1D1D] to-transparent dark:block" />
          </div>
          {/* 右侧渐变阴影 */}
          <div className="pointer-events-none absolute top-0 right-0 z-10 h-full w-4">
            <div className="h-full w-full bg-linear-to-l from-neutral-100 to-transparent dark:hidden" />
            <div className="hidden h-full w-full bg-linear-to-l from-[#1D1D1D] to-transparent dark:block" />
          </div>
          <div
            className="overflow-x-auto"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>
            <div className="hide-scrollbar flex gap-x-1.5 px-3">
              {regionsWithCoords.map(region => {
                const isSelected = selectedRegion === region.name;
                return (
                  <motion.button
                    key={region.name}
                    onClick={() => {
                      if (isSelected) {
                        resetView();
                      } else {
                        focusOnRegion(region);
                      }
                    }}
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                      isSelected
                        ? 'bg-neutral-300/50 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-100'
                        : 'bg-neutral-200/50 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span>{region.name}</span>
                    <span>{region.count}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

CoffeeOriginMap.displayName = 'CoffeeOriginMap';

export default CoffeeOriginMap;
