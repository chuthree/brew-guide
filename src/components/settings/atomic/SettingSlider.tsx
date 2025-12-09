import React from 'react';

interface SettingSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  minLabel?: string;
  maxLabel?: string;
  showTicks?: boolean; // 是否显示刻度点
  className?: string;
}

/**
 * 设置滑块组件 - 统一的滑块样式
 * 用于数值调节，符合 iOS 设计规范
 * 支持左右标签和刻度点显示
 */
const SettingSlider: React.FC<SettingSliderProps> = ({
  value,
  min,
  max,
  step,
  onChange,
  minLabel,
  maxLabel,
  showTicks = false,
  className = '',
}) => {
  // 计算刻度点位置
  const ticks = React.useMemo(() => {
    if (!showTicks) return [];
    const ticksArray = [];
    // 使用更精确的计算方式，避免浮点数误差
    const steps = Math.round((max - min) / step);

    // iOS 风格：考虑滑块按钮（thumb）的宽度
    // 标准 range input 的 thumb 宽度约为 20px
    // 需要计算可移动范围，而不是整个宽度
    const thumbWidth = 20; // thumb 宽度

    for (let i = 0; i <= steps; i++) {
      const tickValue = min + i * step;
      // 考虑 thumb 宽度的百分比位置
      // 第一个点在 thumb 半径处，最后一个点在 100% - thumb 半径处
      const percentage = (i / steps) * 100;
      ticksArray.push({ value: tickValue, percentage });
    }
    return ticksArray;
  }, [min, max, step, showTicks]);

  return (
    <div className={className}>
      {/* 滑块容器 */}
      <div className="flex items-center gap-3">
        {/* 左侧标签 */}
        {minLabel && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {minLabel}
          </span>
        )}
        {/* 滑块区域 */}
        <div className="relative flex-1">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={e => onChange(parseFloat(e.target.value))}
            className="range-thumb-center h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-600"
          />

          {/* 刻度点 - 对齐 thumb 中心位置 */}
          {showTicks && (
            <div className="pointer-events-none absolute right-0 bottom-0 left-0">
              {ticks.map((tick, index) => {
                // 计算考虑 thumb 宽度的实际位置
                // range input 的 thumb 默认约 20px，可移动范围会比轨道短
                const thumbOffset = 10; // thumb 半径的像素值
                const trackPadding = `${thumbOffset}px`;

                return (
                  <div
                    key={index}
                    className="absolute h-0.5 w-0.5 rounded-full bg-neutral-400/40 dark:bg-neutral-500/40"
                    style={{
                      left: `calc(${tick.percentage}% * (100% - ${thumbOffset * 2}px) / 100% + ${thumbOffset}px)`,
                      transform: 'translateX(-50%)',
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>{' '}
        {/* 右侧标签 */}
        {maxLabel && (
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            {maxLabel}
          </span>
        )}
      </div>
    </div>
  );
};

export default SettingSlider;
