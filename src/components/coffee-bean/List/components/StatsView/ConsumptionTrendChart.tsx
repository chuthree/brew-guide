import React, { useMemo, useState, useRef } from 'react';
import { TrendDataPoint } from './useConsumptionTrend';
import { formatNumber } from './utils';

interface ConsumptionTrendChartProps {
  data: TrendDataPoint[];
  height?: number;
  className?: string;
  title?: string;
}

const ConsumptionTrendChart: React.FC<ConsumptionTrendChartProps> = ({
  data,
  height = 60,
  className = '',
  title = '消耗趋势',
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const maxValue = useMemo(() => {
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.value), 1);
  }, [data]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || data.length === 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const width = rect.width;

    // 计算索引，限制在 0 到 length - 1 之间
    const index = Math.floor((x / width) * data.length);
    const safeIndex = Math.max(0, Math.min(index, data.length - 1));

    setActiveIndex(safeIndex);
  };

  const handlePointerLeave = () => {
    setActiveIndex(null);
  };

  if (data.length === 0) return null;

  const barWidth = 100 / data.length;
  const gap = Math.min(barWidth * 0.3, 2); // 间距，最大2%
  const actualBarWidth = barWidth - gap;

  // 当前显示的数据点，如果没有激活则显示最后一个
  const displayData =
    activeIndex !== null ? data[activeIndex] : data[data.length - 1];
  const isHovering = activeIndex !== null;

  return (
    <div className={`w-full ${className}`}>
      {/* 标题和详情合并显示 */}
      <div className="mb-2 flex items-center text-xs font-medium text-neutral-500 dark:text-neutral-400">
        <span>{title}</span>
        {isHovering && (
          <span className="ml-1">
            · {displayData.date} · {formatNumber(displayData.value)}克
          </span>
        )}
      </div>

      <div
        ref={containerRef}
        style={{ height }}
        className="relative w-full touch-none select-none"
        onPointerDown={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="overflow-visible"
        >
          {data.map((point, index) => {
            const barHeight = (point.value / maxValue) * 100;
            // 最小高度 2%，保证有数据时能看到一点点
            const visualHeight = point.value > 0 ? Math.max(barHeight, 2) : 0;
            const x = index * barWidth + gap / 2;
            const y = 100 - visualHeight;
            const isActive = activeIndex === index;

            return (
              <g key={point.date}>
                <rect
                  x={`${x}%`}
                  y={`${y}%`}
                  width={`${actualBarWidth}%`}
                  height={`${visualHeight}%`}
                  rx="1"
                  className={`transition-all duration-200 ${
                    isActive
                      ? 'fill-neutral-800 dark:fill-neutral-200'
                      : 'fill-neutral-200 dark:fill-neutral-800'
                  }`}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-1 flex justify-between text-[10px] text-neutral-400">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
};

export default ConsumptionTrendChart;
