import React from 'react';
import { motion } from 'framer-motion';
import { formatTime } from './utils';
import type { ExpandedStage } from './types';

/**
 * 进度条组件属性接口
 */
interface ProgressBarProps {
  currentTime: number;
  expandedStages: ExpandedStage[];
  progressBarHeight?: number;
  showStageDivider?: boolean;
}

/**
 * 进度条组件
 * 
 * 显示整个冲泡过程的进度和阶段分隔线
 */
const ProgressBar: React.FC<ProgressBarProps> = ({
  currentTime,
  expandedStages,
  progressBarHeight = 4,
  showStageDivider = true,
}) => {
  if (expandedStages.length === 0) return null;
  
  const totalTime = expandedStages[expandedStages.length - 1].endTime;
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
      className="relative mb-3"
    >
      {showStageDivider && expandedStages.map((stage) => {
        const percentage = (stage.endTime / totalTime) * 100;
        return (
          <div
            key={stage.endTime}
            className="absolute top-0 w-[2px] bg-neutral-50 dark:bg-neutral-900"
            style={{
              left: `${percentage}%`,
              height: `${progressBarHeight}px`,
              opacity: 0.8,
              transform: "translateZ(0)",
            }}
          />
        );
      })}

      <div
        className="w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800"
        style={{
          height: `${progressBarHeight}px`,
          contain: "paint layout",
          position: "relative",
        }}
      >
        {/* 阶段分隔线 */}
        {expandedStages.map((stage, index) => {
          // 跳过第一个阶段的开始线（最左侧）
          if (index === 0) return null;
          
          const percentage = (stage.startTime / totalTime) * 100;
          
          return (
            <div
              key={`divider-${stage.startTime}`}
              className="absolute top-0 bottom-0 z-10 w-[1.5px] bg-neutral-100 dark:bg-neutral-700"
              style={{
                left: `${percentage}%`,
                height: `${progressBarHeight}px`,
              }}
            />
          );
        })}
        
        {/* 等待阶段的斜纹背景 */}
        {expandedStages.map((stage) => {
          const startPercentage = (stage.startTime / totalTime) * 100;
          const width = ((stage.endTime - stage.startTime) / totalTime) * 100;

          return stage.type === "wait" ? (
            <div
              key={`waiting-${stage.endTime}`}
              className="absolute"
              style={{
                left: `${startPercentage}%`,
                width: `${width}%`,
                height: `${progressBarHeight}px`,
                background: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 4px,
                  rgba(0, 0, 0, 0.1) 4px,
                  rgba(0, 0, 0, 0.1) 8px
                )`,
                transform: "translateZ(0)",
              }}
            />
          ) : null;
        })}
        
        {/* 进度指示器 */}
        <motion.div
          className="h-full bg-neutral-800 dark:bg-neutral-100 transform-gpu"
          initial={{ width: 0 }}
          animate={{
            width: currentTime > 0 && expandedStages.length > 0
              ? `${(currentTime / (expandedStages[expandedStages.length - 1]?.endTime || 1)) * 100}%`
              : "0%"
          }}
          transition={{
            duration: 0.26,
            ease: [0.4, 0, 0.2, 1],
          }}
          style={{
            willChange: "width",
            transformOrigin: "left center",
            contain: "layout",
            backfaceVisibility: "hidden",
            position: "relative",
            zIndex: 5,
          }}
        />
      </div>

      <div className="relative mt-1 h-4 w-full">
        {/* 时间标记 */}
        {expandedStages.length > 0 && (
          <>
            {/* 当前阶段时间标记 */}
            {expandedStages.some(stage => 
              currentTime >= stage.startTime && currentTime <= stage.endTime
            ) && (
              <div
                className="absolute top-0 font-medium text-[9px] text-neutral-600 dark:text-neutral-300"
                style={{
                  left: `${(currentTime / totalTime) * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {formatTime(currentTime, true)}
              </div>
            )}
            
            {/* 最后阶段时间标记 */}
            <div
              key="final-time"
              className="absolute top-0 right-0 font-medium text-[9px] text-neutral-600 dark:text-neutral-300"
            >
              {formatTime(totalTime, true)}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};

export default ProgressBar; 