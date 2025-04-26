import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from './utils';
import type { ExpandedStage } from './types';

/**
 * 计算目标流速
 */
const calculateTargetFlowRate = (stage: ExpandedStage, _allStages: ExpandedStage[]): number => {
  if (!stage || stage.type !== 'pour' || !stage.water) return 0;
  
  // 提取水量数字
  const waterStr = stage.water;
  const waterNum = parseInt(waterStr, 10);
  
  if (isNaN(waterNum)) return 0;
  
  // 计算注水时间（秒）
  const pourTime = stage.pourTime || (stage.endTime - stage.startTime);
  
  // 计算流速（g/s）
  const flowRate = waterNum / pourTime;
  
  // 返回流速，默认转换为g/s
  return flowRate;
};

/**
 * 阶段信息组件属性接口
 */
interface StageInfoProps {
  currentStage: ExpandedStage | null;
  nextStage: ExpandedStage | null;
  currentWaterAmount: number;
  allStages: ExpandedStage[];
  flowRate: number;
  stageInfoReversed?: boolean;
  showFlowRate?: boolean;
}

/**
 * 阶段信息组件
 * 
 * 显示当前阶段和下一阶段的信息
 */
const StageInfo: React.FC<StageInfoProps> = ({
  currentStage,
  nextStage,
  currentWaterAmount,
  allStages,
  flowRate,
  stageInfoReversed = false,
  showFlowRate = false,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-3"
      style={{
        willChange: "transform, opacity",
        backfaceVisibility: "hidden",
      }}
    >
      {/* 当前阶段信息 */}
      <div
        className={`flex items-baseline border-l-2 border-neutral-800 pl-3 dark:border-neutral-100 ${
          stageInfoReversed
            ? "flex-row-reverse"
            : "flex-row"
        } justify-between`}
      >
        <div
          className={`${
            stageInfoReversed
              ? "text-right"
              : "text-left"
          }`}
        >
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            当前阶段
          </div>
          <motion.div
            key={currentStage?.startTime || 'none'}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26 }}
            className="mt-1 text-sm font-medium tracking-wide"
            style={{
              willChange: "transform, opacity",
              backfaceVisibility: "hidden",
            }}
          >
            {currentStage
              ? currentStage.type === "pour"
                ? currentStage.label
                : `等待`
              : "完成冲煮"}
          </motion.div>
        </div>
        <div
          className={`flex items-baseline flex-row ${
            stageInfoReversed
              ? "text-left"
              : "text-right"
          }`}
        >
          <div
            className={
              stageInfoReversed ? "mr-4" : "mr-0"
            }
          >
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              目标时间
            </div>
            <motion.div
              key={`time-${currentStage?.startTime || 'none'}`}
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.26 }}
              className="mt-1 text-sm font-medium tracking-wide"
            >
              {currentStage
                ? formatTime(currentStage.endTime, true)
                : "-"}
            </motion.div>
          </div>
          <div className={`${showFlowRate ? 'min-w-20' : 'min-w-24'}`}>
            <div className="text-xs text-neutral-500 dark:text-neutral-400">
              目标水量
            </div>
            <motion.div
              key={`water-${currentStage?.startTime || 'none'}`}
              initial={{ opacity: 0.8 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.26 }}
              className="mt-1 flex flex-col text-sm font-medium tracking-wide"
            >
              {currentStage?.water ? (
                <div
                  className={`flex items-baseline ${
                    stageInfoReversed
                      ? "justify-start"
                      : "justify-end"
                  }`}
                >
                  <span>{currentWaterAmount}</span>
                  <span className="mx-0.5 text-neutral-300 dark:text-neutral-600">
                    /
                  </span>
                  <span>{currentStage.water}</span>
                </div>
              ) : (
                "-"
              )}
            </motion.div>
          </div>
          {showFlowRate && (
            <div className="min-w-14">
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                流速
              </div>
              <motion.div
                key={`flow-rate-${currentStage?.startTime || 'none'}`}
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.26 }}
                className="mt-1 text-sm font-medium tracking-wide"
              >
                {currentStage?.type === "pour" ? (
                  <span>{flowRate.toFixed(1)}</span>
                ) : (
                  "-"
                )}
              </motion.div>
            </div>
          )}
        </div>
      </div>

      {/* 下一阶段信息 */}
      <AnimatePresence mode="wait">
        {nextStage && (
          <motion.div
            key={`next-${nextStage.startTime}`}
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.26 }}
            className={`flex items-baseline border-l m border-neutral-300 pl-3 dark:border-neutral-700 ${
              stageInfoReversed
                ? "flex-row-reverse"
                : "flex-row"
            } justify-between transform-gpu`}
            style={{
              willChange: "transform, opacity, height",
              backfaceVisibility: "hidden",
            }}
          >
            <div
              className={`${
                stageInfoReversed
                  ? "text-right"
                  : "text-left"
              }`}
            >
              <div
                className={`flex items-center ${
                  stageInfoReversed
                    ? "justify-end"
                    : "justify-start"
                } gap-2 text-xs text-neutral-500 dark:text-neutral-400`}
              >
                <span>下一步</span>
              </div>
              <motion.div
                initial={{
                  opacity: 0,
                  x: stageInfoReversed ? 10 : -10,
                }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.26, delay: 0.1 }}
                className="mt-1"
              >
                <span className="text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                  {nextStage.type === "pour"
                    ? nextStage.label
                    : `等待`}
                </span>
              </motion.div>
            </div>
            <motion.div
              initial={{
                opacity: 0,
                x: stageInfoReversed ? -10 : 10,
              }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.26, delay: 0.2 }}
              className={`flex items-baseline flex-row ${
                stageInfoReversed
                  ? "text-left"
                  : "text-right "
              }`}
            >
              <div
                className={
                  stageInfoReversed ? "mr-4" : "mr-0"
                }
              >
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  目标时间
                </div>
                <div className="mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                  {formatTime(nextStage.endTime, true)}
                </div>
              </div>
              <div className={`${showFlowRate ? 'min-w-20' : 'min-w-24'}`}>
                <div className="text-xs text-neutral-500 dark:text-neutral-400">
                  目标水量
                </div>
                <div
                  className={`mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400 ${
                    stageInfoReversed
                      ? "text-left"
                      : "text-right"
                  }`}
                >
                  {nextStage.water}
                </div>
              </div>
              {showFlowRate && (
                <div className="min-w-14">
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    流速
                  </div>
                  <div
                    className={`mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400 ${
                      stageInfoReversed
                        ? "text-left"
                        : "text-right"
                    }`}
                  >
                    {nextStage.type === "pour" ? (
                      <span>{calculateTargetFlowRate(nextStage, allStages).toFixed(1)}</span>
                    ) : (
                      "-"
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StageInfo; 