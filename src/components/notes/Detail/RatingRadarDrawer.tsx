'use client';

import React, { useMemo, useState, useEffect, useRef } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import SegmentedControl from '@/components/ui/SegmentedControl';
import Slider from '@/components/ui/Slider';
import { Expand, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettingsStore } from '@/lib/stores/settingsStore';

interface RatingItem {
  id: string;
  label: string;
  value: number;
}

interface CompareNote {
  id: string;
  timestamp: number;
  taste: Record<string, number>;
  method?: string;
}

interface RatingRadarDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  ratings: RatingItem[];
  overallRating?: number;
  beanName?: string;
  note?: string;
  currentNoteId?: string; // 当前笔记ID
  compareNotes?: CompareNote[]; // 可对比的笔记列表
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
  compareRatings?: Record<string, number>; // 对比笔记的评分
}> = ({ ratings, maxValue = 5, shape = 'polygon', compareRatings }) => {
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

      // 如果边长为0（连续点重合），直接连线不做圆角处理
      if (len1 < 0.01 || len2 < 0.01) {
        if (i === 0) {
          path.push(`M ${curr.x} ${curr.y}`);
        } else {
          path.push(`L ${curr.x} ${curr.y}`);
        }
        continue;
      }

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

  // 生成对比笔记的路径
  const comparePath = useMemo(() => {
    if (!compareRatings || points.length < 3) return '';

    // 根据当前评分维度生成对比笔记的点
    const comparePts = points.map(p => {
      const compareValue = compareRatings[p.id] ?? 0;
      const normalizedCompare = compareValue / maxValue;
      return {
        x: centerX + Math.cos(p.angle) * radius * normalizedCompare,
        y: centerY + Math.sin(p.angle) * radius * normalizedCompare,
      };
    });

    // 检查是否有有效数据
    const hasValidData = points.some(p => (compareRatings[p.id] ?? 0) > 0);
    if (!hasValidData) return '';

    return createRoundedPolygonPath(comparePts, 4);
  }, [points, compareRatings, maxValue, centerX, centerY, radius]);

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

      {/* 对比笔记区域 */}
      <AnimatePresence>
        {comparePath && (
          <motion.path
            d={comparePath}
            fill="currentColor"
            fillOpacity={0.05}
            stroke="currentColor"
            strokeWidth={1}
            strokeOpacity={0.15}
            strokeDasharray="4 3"
            className="text-neutral-600 dark:text-neutral-300"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, d: comparePath }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          />
        )}
      </AnimatePresence>

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
            className="fill-neutral-600 dark:fill-neutral-400"
          >
            {point.label}
            <tspan className="fill-neutral-800 dark:fill-neutral-200">
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
  currentNoteId,
  compareNotes = [],
}) => {
  // 使用 settingsStore 管理雷达图设置
  const { settings, updateSettings } = useSettingsStore();
  const scale = settings.radarChartScale ?? 1;
  const shape = settings.radarChartShape ?? 'polygon';
  const align = settings.radarChartAlign ?? 'center';
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [selectedCompareId, setSelectedCompareId] = useState<string | null>(
    null
  );
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // 过滤掉当前笔记，获取可对比的笔记
  const availableCompareNotes = useMemo(() => {
    return compareNotes
      .filter(n => n.id !== currentNoteId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [compareNotes, currentNoteId]);

  // 获取选中的对比笔记的评分
  const compareRatings = useMemo(() => {
    if (!selectedCompareId) return undefined;
    const n = availableCompareNotes.find(n => n.id === selectedCompareId);
    return n?.taste;
  }, [selectedCompareId, availableCompareNotes]);

  // 格式化日期
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // 长按处理
  const handleLongPressStart = () => {
    if (availableCompareNotes.length === 0) return;
    longPressTimer.current = setTimeout(() => {
      setIsComparing(true);
      setIsAdjusting(false);
    }, 500);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

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
      setIsComparing(false);
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
            <RadarChart
              ratings={ratings}
              maxValue={5}
              shape={shape}
              compareRatings={compareRatings}
            />
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
          {!isAdjusting && !isComparing ? (
            <motion.div
              key="normal"
              className="flex w-full gap-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <button
                className="flex h-11 w-11 flex-none touch-none items-center justify-center rounded-full bg-neutral-100 text-neutral-600 transition-transform select-none active:scale-95 dark:bg-neutral-800 dark:text-neutral-400"
                onClick={() => setIsAdjusting(true)}
                onPointerDown={handleLongPressStart}
                onPointerUp={handleLongPressEnd}
                onPointerLeave={handleLongPressEnd}
                onContextMenu={e => e.preventDefault()}
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
          ) : isComparing ? (
            <motion.div
              key="comparing"
              className="flex w-full flex-col gap-3"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              {/* 对比选择器 */}
              <div className="flex w-full gap-3">
                <SegmentedControl
                  options={[
                    { value: null, label: '无' },
                    ...availableCompareNotes.slice(0, 4).map(n => ({
                      value: n.id,
                      label: formatDate(n.timestamp),
                    })),
                  ]}
                  value={selectedCompareId}
                  onChange={setSelectedCompareId}
                  className="flex-1 overflow-x-auto"
                />
                <button
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-neutral-100 text-neutral-700 transition-transform active:scale-95 dark:bg-neutral-800 dark:text-neutral-300"
                  onClick={() => setIsComparing(false)}
                >
                  <Check size={20} />
                </button>
              </div>
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
                <Slider
                  value={scale}
                  min={0.5}
                  max={1.1}
                  onChange={handleScaleChange}
                  minLabel="小"
                  maxLabel="大"
                  className="flex-1"
                />
              </div>

              {/* 第二行：形状和对齐 */}
              <div className="flex w-full gap-3">
                {/* 形状切换 */}
                <SegmentedControl
                  options={[
                    { value: 'polygon' as const, label: '矩形' },
                    { value: 'circle' as const, label: '圆形' },
                  ]}
                  value={shape}
                  onChange={handleShapeChange}
                  className="flex-1"
                  equalWidth
                />

                {/* 对齐切换 */}
                <SegmentedControl
                  options={[
                    { value: 'left' as const, label: '左' },
                    { value: 'center' as const, label: '中' },
                  ]}
                  value={align}
                  onChange={handleAlignChange}
                  className="flex-1"
                  equalWidth
                />

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
