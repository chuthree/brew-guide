'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { Expand, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface RatingItem {
  id: string;
  label: string;
  value: number;
}

interface RatingRadarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ratings: RatingItem[];
  overallRating?: number;
  beanName?: string;
  note?: string;
}

// 估算文字宽度（基于字体大小的实际测量值）
const estimateTextWidth = (text: string, fontSize: number): number => {
  let width = 0;
  for (const char of text) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      width += fontSize * 1.1; // 中文字符略宽
    } else if (/\s/.test(char)) {
      width += fontSize * 0.3; // 空格
    } else if (/[A-Z]/.test(char)) {
      width += fontSize * 0.7; // 大写字母
    } else if (/[a-z]/.test(char)) {
      width += fontSize * 0.55; // 小写字母
    } else if (/[0-9]/.test(char)) {
      width += fontSize * 0.6; // 数字
    } else {
      width += fontSize * 0.5; // 其他字符（括号等）
    }
  }
  return width;
};

// 获取实际的字体缩放比例
const useFontScale = (): number => {
  const [scale, setScale] = useState(1);
  const measureRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    // 创建一个隐藏的测量元素
    const measureEl = document.createElement('span');
    measureEl.style.cssText =
      'position:absolute;visibility:hidden;font-size:1rem;pointer-events:none;';
    measureEl.textContent = 'M';
    document.body.appendChild(measureEl);
    measureRef.current = measureEl;

    const updateScale = () => {
      if (measureRef.current) {
        const computedSize = parseFloat(
          getComputedStyle(measureRef.current).fontSize
        );
        // 基准是 16px (1rem)
        setScale(computedSize / 16);
      }
    };

    updateScale();

    // 监听字体大小变化（通过 resize 事件或 MutationObserver）
    window.addEventListener('resize', updateScale);

    // 监听 html 元素的 style 变化（动态字体大小调整）
    const observer = new MutationObserver(updateScale);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style', 'class'],
    });

    return () => {
      window.removeEventListener('resize', updateScale);
      observer.disconnect();
      if (measureRef.current) {
        document.body.removeChild(measureRef.current);
      }
    };
  }, []);

  return scale;
};

/**
 * 雷达图组件
 * 使用 SVG 绘制，支持任意数量的维度
 * viewBox 会根据标签内容和字体缩放动态调整大小
 */
const RadarChart: React.FC<{
  ratings: RatingItem[];
  maxValue?: number;
  shape?: 'polygon' | 'circle';
}> = ({ ratings, maxValue = 5, shape = 'polygon' }) => {
  const fontScale = useFontScale();

  // 基础尺寸，会根据字体缩放调整
  const baseFontSize = 12;
  const fontSize = baseFontSize * fontScale;
  const radarSize = 220; // 雷达图本身的尺寸
  const radius = radarSize / 2; // 雷达图半径
  const labelDistance = 14 * fontScale; // 标签到雷达图边缘的距离也随字体缩放

  // 计算每个维度的角度、坐标和标签信息
  const { points, viewBox } = useMemo(() => {
    const count = ratings.length;
    if (count === 0) return { points: [], viewBox: { x: 0, y: 0, w: 0, h: 0 } };

    // 先计算所有点的位置（以原点为中心）
    const rawPoints = ratings.map((rating, index) => {
      const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
      const normalizedValue = rating.value / maxValue;
      const labelText = `${rating.label} ${rating.value}`;
      const textWidth = estimateTextWidth(labelText, fontSize);

      // 计算标签位置（相对于原点）
      const labelX = Math.cos(angle) * (radius + labelDistance);
      const labelY = Math.sin(angle) * (radius + labelDistance);

      // 根据角度确定文本对齐方式和边界
      const isTop = Math.abs(angle + Math.PI / 2) < 0.1;
      const isBottom = Math.abs(angle - Math.PI / 2) < 0.1;
      const isLeft = angle > Math.PI / 2 || angle < -Math.PI / 2;

      let textBounds: {
        left: number;
        right: number;
        top: number;
        bottom: number;
      };

      if (isTop) {
        textBounds = {
          left: labelX - textWidth / 2,
          right: labelX + textWidth / 2,
          top: labelY - fontSize - 4,
          bottom: labelY,
        };
      } else if (isBottom) {
        textBounds = {
          left: labelX - textWidth / 2,
          right: labelX + textWidth / 2,
          top: labelY,
          bottom: labelY + fontSize + 4,
        };
      } else if (isLeft) {
        textBounds = {
          left: labelX - textWidth,
          right: labelX,
          top: labelY - fontSize / 2,
          bottom: labelY + fontSize / 2,
        };
      } else {
        textBounds = {
          left: labelX,
          right: labelX + textWidth,
          top: labelY - fontSize / 2,
          bottom: labelY + fontSize / 2,
        };
      }

      return {
        ...rating,
        angle,
        normalizedValue,
        labelX,
        labelY,
        textBounds,
        isTop,
        isBottom,
        isLeft,
      };
    });

    // 计算包含所有标签的边界框
    let minX = -radius;
    let maxX = radius;
    let minY = -radius;
    let maxY = radius;

    for (const p of rawPoints) {
      minX = Math.min(minX, p.textBounds.left);
      maxX = Math.max(maxX, p.textBounds.right);
      minY = Math.min(minY, p.textBounds.top);
      maxY = Math.max(maxY, p.textBounds.bottom);
    }

    const width = maxX - minX;
    const height = maxY - minY;

    // 计算中心点在 viewBox 中的位置
    const centerX = -minX;
    const centerY = -minY;

    // 转换所有坐标到 viewBox 坐标系
    const finalPoints = rawPoints.map(p => ({
      ...p,
      x: centerX + Math.cos(p.angle) * radius * p.normalizedValue,
      y: centerY + Math.sin(p.angle) * radius * p.normalizedValue,
      labelX: centerX + p.labelX,
      labelY: centerY + p.labelY,
      axisX: centerX + Math.cos(p.angle) * radius,
      axisY: centerY + Math.sin(p.angle) * radius,
    }));

    return {
      points: finalPoints,
      viewBox: { x: 0, y: 0, w: width, h: height, centerX, centerY },
    };
  }, [ratings, radius, maxValue, fontSize, labelDistance]);

  // 生成带圆角的多边形路径
  const createRoundedPolygonPath = (
    pts: { x: number; y: number }[],
    cornerRadius: number
  ) => {
    if (pts.length < 3) return '';

    const path: string[] = [];
    const n = pts.length;

    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];

      // 计算从前一个点到当前点的方向
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

      // 计算从当前点到下一个点的方向
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      // 限制圆角半径不超过边长的一半
      const r = Math.min(cornerRadius, len1 / 2, len2 / 2);

      // 计算圆角起点和终点
      const startX = curr.x - (dx1 / len1) * r;
      const startY = curr.y - (dy1 / len1) * r;
      const endX = curr.x + (dx2 / len2) * r;
      const endY = curr.y + (dy2 / len2) * r;

      if (i === 0) {
        path.push(`M ${startX} ${startY}`);
      } else {
        path.push(`L ${startX} ${startY}`);
      }

      // 使用二次贝塞尔曲线绘制圆角
      path.push(`Q ${curr.x} ${curr.y} ${endX} ${endY}`);
    }

    path.push('Z');
    return path.join(' ');
  };

  const { centerX, centerY } = viewBox as {
    centerX: number;
    centerY: number;
    w: number;
    h: number;
  };

  // 生成数据区域的路径（带圆角）
  const dataPath = useMemo(() => {
    if (points.length < 3) return '';
    const pts = points.map(p => ({ x: p.x, y: p.y }));
    return createRoundedPolygonPath(pts, 4);
  }, [points]);

  // 生成网格线（同心多边形或圆形）
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
  const gridPaths = useMemo(() => {
    if (points.length < 3) return [];

    if (shape === 'circle') {
      // 圆形网格：返回空数组，使用 circle 元素渲染
      return [];
    }

    return gridLevels.map(level => {
      const pts = points.map(p => ({
        x: centerX + Math.cos(p.angle) * radius * level,
        y: centerY + Math.sin(p.angle) * radius * level,
      }));
      return createRoundedPolygonPath(pts, 3 * level);
    });
  }, [points, centerX, centerY, radius, shape]);

  if (ratings.length < 3) {
    return null; // 少于 3 个维度时不渲染雷达图，由父组件决定展示方式
  }

  return (
    <svg viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} className="h-auto w-full">
      {/* 网格线 */}
      {shape === 'circle'
        ? gridLevels.map((level, index) => (
            <circle
              key={index}
              cx={centerX}
              cy={centerY}
              r={radius * level}
              fill="none"
              stroke="currentColor"
              strokeWidth={index === gridLevels.length - 1 ? 1 : 0.5}
              className="text-neutral-200 dark:text-neutral-700"
            />
          ))
        : gridPaths.map((path, index) => (
            <path
              key={index}
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth={index === gridPaths.length - 1 ? 1 : 0.5}
              className="text-neutral-200 dark:text-neutral-700"
            />
          ))}

      {/* 轴线 */}
      {points.map((point, index) => (
        <line
          key={index}
          x1={centerX}
          y1={centerY}
          x2={point.axisX}
          y2={point.axisY}
          stroke="currentColor"
          strokeWidth={0.5}
          className="text-neutral-200 dark:text-neutral-700"
        />
      ))}

      {/* 数据区域 */}
      <path
        d={dataPath}
        fill="currentColor"
        fillOpacity={0.15}
        stroke="currentColor"
        strokeWidth={1.5}
        className="text-neutral-700 dark:text-neutral-300"
      />

      {/* 标签 */}
      {points.map((point, index) => {
        let textAnchor: 'start' | 'middle' | 'end' = 'middle';
        let dy = 0;

        if (point.isTop) {
          dy = -4 * fontScale;
        } else if (point.isBottom) {
          dy = fontSize + 2 * fontScale;
        } else if (point.isLeft) {
          textAnchor = 'end';
          dy = fontSize * 0.35;
        } else {
          textAnchor = 'start';
          dy = fontSize * 0.35;
        }

        return (
          <text
            key={index}
            x={point.labelX}
            y={point.labelY}
            dy={dy}
            textAnchor={textAnchor}
            fontSize={fontSize}
            className="fill-neutral-500 dark:fill-neutral-400"
          >
            {point.label}
            <tspan className="fill-neutral-700 dark:fill-neutral-300">
              {' '}
              {point.value}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
};

/**
 * 自定义滑块组件
 * 支持胶囊形滑块和自定义颜色
 */
const RadarSlider: React.FC<{
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  className?: string;
}> = ({ value, min, max, onChange, className }) => {
  const ref = useRef<HTMLDivElement>(null);

  const handleMove = (clientX: number) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    const rawValue = min + percentage * (max - min);
    // 步进 0.05
    const step = 0.05;
    const steppedValue = Math.round(rawValue / step) * step;
    const finalValue = Math.max(min, Math.min(max, steppedValue));

    onChange(finalValue);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    handleMove(e.clientX);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons > 0) {
      handleMove(e.clientX);
    }
  };

  const percent = ((value - min) / (max - min)) * 100;

  return (
    <div
      ref={ref}
      className={`relative flex h-full cursor-pointer touch-none items-center select-none ${className}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    >
      {/* 刻度背景 - 放在底层 */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 justify-between px-0.5 opacity-20">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <div
            key={i}
            className="h-1 w-0.5 rounded-full bg-neutral-900 dark:bg-white"
          />
        ))}
      </div>

      {/* 轨道背景 */}
      <div className="absolute inset-x-0 h-1 rounded-full bg-neutral-200 dark:bg-neutral-700" />

      {/* 胶囊滑块 */}
      <div
        className="absolute top-1/2 h-3.5 w-5.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-xs dark:bg-neutral-300"
        style={{ left: `${percent}%` }}
      />
    </div>
  );
};

/**
 * 评分雷达图抽屉组件
 * 仅在 4 个及以上维度时使用，显示雷达图
 */
const RatingRadarDrawer: React.FC<RatingRadarDrawerProps> = ({
  isOpen,
  onClose,
  ratings,
  overallRating,
  beanName,
  note,
}) => {
  // 使用 settingsStore 管理雷达图设置
  const { settings, updateSettings } = useSettingsStore();
  const scale = settings.radarChartScale ?? 1;
  const shape = settings.radarChartShape ?? 'polygon';
  const align = settings.radarChartAlign ?? 'center';
  const [isAdjusting, setIsAdjusting] = useState(false);

  const handleScaleChange = (newScale: number) => {
    updateSettings({ radarChartScale: newScale });
  };

  const handleShapeChange = (newShape: 'polygon' | 'circle') => {
    updateSettings({ radarChartShape: newShape });
  };

  const handleAlignChange = (newAlign: 'left' | 'center') => {
    updateSettings({ radarChartAlign: newAlign });
  };

  useEffect(() => {
    if (!isOpen) {
      setIsAdjusting(false);
    }
  }, [isOpen]);

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="rating-radar-drawer"
    >
      <div className="flex flex-col">
        {/* 雷达图区域 - 支持缩放和对齐 */}
        <div
          className={`-mx-4 mb-2 flex w-[calc(100%+2rem)] overflow-hidden ${
            align === 'left' ? 'justify-start pl-4' : 'justify-center'
          }`}
        >
          <div
            className={`transition-all duration-300 ease-out ${
              align === 'left' ? 'origin-top-left' : 'origin-top'
            }`}
            style={{ width: `${scale * 100}%` }}
          >
            <RadarChart ratings={ratings} maxValue={5} shape={shape} />
          </div>
        </div>

        {/* 咖啡豆信息和笔记 */}
        <div className="mt-4 space-y-3 text-sm tracking-wide whitespace-pre-line">
          {beanName && (
            <p className="font-medium text-neutral-700 dark:text-neutral-300">
              <span>{beanName}</span>
              {overallRating !== undefined && overallRating > 0 && (
                <span className="text-neutral-500 dark:text-neutral-400">
                  ，总评 {overallRating}/5
                </span>
              )}
            </p>
          )}
          {note && (
            <p className="text-neutral-600 dark:text-neutral-400">{note}</p>
          )}
        </div>
      </div>

      <ActionDrawer.Actions className="mt-6">
        <AnimatePresence mode="popLayout" initial={false}>
          {!isAdjusting ? (
            <motion.div
              key="normal"
              className="flex w-full gap-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <button
                className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-transform active:scale-95 dark:bg-neutral-800 dark:text-neutral-400"
                onClick={() => setIsAdjusting(true)}
              >
                <Expand size={18} />
              </button>
              <ActionDrawer.SecondaryButton
                onClick={onClose}
                className="flex-1"
              >
                关闭
              </ActionDrawer.SecondaryButton>
            </motion.div>
          ) : (
            <motion.div
              key="adjusting"
              className="flex w-full flex-col gap-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {/* 第一行：大小调整 */}
              <div className="flex w-full gap-3">
                <div className="relative flex h-11 flex-1 items-center gap-3 rounded-full bg-neutral-100 px-4 dark:bg-neutral-800">
                  <span className="relative z-10 text-xs font-medium text-neutral-400">
                    小
                  </span>

                  <RadarSlider
                    value={scale}
                    min={0.5}
                    max={1.1}
                    onChange={handleScaleChange}
                    className="flex-1"
                  />

                  <span className="relative z-10 text-xs font-medium text-neutral-400">
                    大
                  </span>
                </div>
              </div>

              {/* 第二行：形状和对齐 */}
              <div className="flex w-full gap-3">
                {/* 形状切换 */}
                <div className="flex h-11 flex-1 items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
                  <button
                    className={`flex h-9 flex-1 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      shape === 'polygon'
                        ? 'bg-white text-neutral-700 shadow-sm dark:bg-neutral-700 dark:text-neutral-200'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                    onClick={() => handleShapeChange('polygon')}
                  >
                    矩形
                  </button>
                  <button
                    className={`flex h-9 flex-1 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      shape === 'circle'
                        ? 'bg-white text-neutral-700 shadow-sm dark:bg-neutral-700 dark:text-neutral-200'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                    onClick={() => handleShapeChange('circle')}
                  >
                    圆形
                  </button>
                </div>

                {/* 对齐切换 */}
                <div className="flex h-11 flex-1 items-center gap-1 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
                  <button
                    className={`flex h-9 flex-1 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      align === 'left'
                        ? 'bg-white text-neutral-700 shadow-sm dark:bg-neutral-700 dark:text-neutral-200'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                    onClick={() => handleAlignChange('left')}
                  >
                    左
                  </button>
                  <button
                    className={`flex h-9 flex-1 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                      align === 'center'
                        ? 'bg-white text-neutral-700 shadow-sm dark:bg-neutral-700 dark:text-neutral-200'
                        : 'text-neutral-500 dark:text-neutral-400'
                    }`}
                    onClick={() => handleAlignChange('center')}
                  >
                    中
                  </button>
                </div>

                <button
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-transform active:scale-95 dark:bg-neutral-800 dark:text-neutral-300"
                  onClick={() => setIsAdjusting(false)}
                >
                  <Check size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default RatingRadarDrawer;
