'use client';

import React, { useMemo } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';

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

// 估算文字宽度（基于 12px 字体大小的实际测量值）
const estimateTextWidth = (text: string, fontSize: number = 12): number => {
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

/**
 * 雷达图组件
 * 使用 SVG 绘制，支持任意数量的维度
 * viewBox 会根据标签内容动态调整大小
 */
const RadarChart: React.FC<{
  ratings: RatingItem[];
  maxValue?: number;
}> = ({ ratings, maxValue = 5 }) => {
  const radarSize = 220; // 雷达图本身的尺寸（增大以更好利用空间）
  const radius = radarSize / 2; // 雷达图半径
  const labelDistance = 14; // 标签到雷达图边缘的距离
  const fontSize = 12;

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
  }, [ratings, radius, maxValue]);

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

  // 生成网格线（同心多边形，带圆角）
  const gridLevels = [0.2, 0.4, 0.6, 0.8, 1];
  const gridPaths = useMemo(() => {
    if (points.length < 3) return [];

    return gridLevels.map(level => {
      const pts = points.map(p => ({
        x: centerX + Math.cos(p.angle) * radius * level,
        y: centerY + Math.sin(p.angle) * radius * level,
      }));
      return createRoundedPolygonPath(pts, 3 * level);
    });
  }, [points, centerX, centerY, radius]);

  if (ratings.length < 3) {
    return null; // 少于 3 个维度时不渲染雷达图，由父组件决定展示方式
  }

  return (
    <svg viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} className="h-auto w-full">
      {/* 网格线 */}
      {gridPaths.map((path, index) => (
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
          dy = -4;
        } else if (point.isBottom) {
          dy = 14;
        } else if (point.isLeft) {
          textAnchor = 'end';
          dy = 4;
        } else {
          textAnchor = 'start';
          dy = 4;
        }

        return (
          <text
            key={index}
            x={point.labelX}
            y={point.labelY}
            dy={dy}
            textAnchor={textAnchor}
            className="fill-neutral-500 text-xs dark:fill-neutral-400"
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
  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="rating-radar-drawer"
    >
      <div className="flex flex-col">
        {/* 雷达图区域 */}
        <div className="-mx-4 mb-2 w-[calc(100%+2rem)]">
          <RadarChart ratings={ratings} maxValue={5} />
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
        <ActionDrawer.SecondaryButton onClick={onClose}>
          关闭
        </ActionDrawer.SecondaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default RatingRadarDrawer;
