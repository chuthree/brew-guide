import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatTime } from './utils';

/**
 * 计时器显示组件的属性接口
 */
interface TimerDisplayProps {
  // 计时相关
  currentTime: number;
  countdownTime: number | null;
  currentWaterAmount: number;
  flowRate: number;
  // 布局相关
  controlsReversed?: boolean;
  showFlowRate?: boolean;
}

/**
 * 计时器显示组件
 * 
 * 负责呈现计时器的时间、水量和流速显示
 */
const TimerDisplay: React.FC<TimerDisplayProps> = ({
  currentTime,
  countdownTime,
  currentWaterAmount,
  flowRate,
  controlsReversed = false,
  showFlowRate = false,
}) => {
  return (
    <div
      className={`grid ${
        controlsReversed
          ? `grid-cols-[auto_auto_auto] ${showFlowRate ? 'gap-4' : 'gap-8'}`
          : `grid-cols-[auto_auto_auto] ${showFlowRate ? 'gap-4' : 'gap-8'}`
      }`}
    >
      {/* 时间显示 */}
      <div
        className={`flex flex-col ${
          controlsReversed ? "items-end" : "items-start"
        }`}
      >
        <span className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
          时间
        </span>
        <div className="relative text-2xl font-light tracking-widest text-neutral-800 sm:text-3xl dark:text-neutral-100">
          <AnimatePresence mode="wait">
            {countdownTime !== null ? (
              <motion.div
                key="countdown"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.26 }}
                className={`timer-font min-w-[4ch] ${
                  controlsReversed
                    ? "text-right"
                    : "text-left"
                } transform-gpu`}
                style={{
                  willChange: "transform, opacity",
                  transform: "translateZ(0)",
                  contain: "content",
                  backfaceVisibility: "hidden",
                }}
              >
                {`0:${countdownTime.toString().padStart(2, "0")}`}
              </motion.div>
            ) : (
              <motion.div
                key="timer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.26 }}
                className={`timer-font min-w-[4ch] ${
                  controlsReversed
                    ? "text-right"
                    : "text-left"
                } transform-gpu`}
                style={{
                  willChange: "transform, opacity",
                  transform: "translateZ(0)",
                  contain: "content",
                  backfaceVisibility: "hidden",
                }}
              >
                {formatTime(currentTime)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 水量显示 */}
      <div
        className={`flex flex-col ${
          controlsReversed ? "items-end" : "items-start"
        }`}
      >
        <span className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
          水量
        </span>
        <div className="text-2xl font-light tracking-widest text-neutral-800 sm:text-3xl dark:text-neutral-100">
          <motion.div
            className={`timer-font min-w-[4ch] ${
              controlsReversed ? "text-right" : "text-left"
            } transform-gpu`}
            animate={{
              opacity: [null, 1],
              scale: currentWaterAmount > 0 ? [1.02, 1] : 1,
            }}
            transition={{
              duration: 0.15,
              ease: [0.4, 0, 0.2, 1],
            }}
            style={{
              willChange: "transform, opacity",
              transform: "translateZ(0)",
              contain: "content",
              backfaceVisibility: "hidden",
            }}
          >
            <span>{currentWaterAmount}</span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-1">
              g
            </span>
          </motion.div>
        </div>
      </div>

      {/* 流速显示（可选） */}
      {showFlowRate && (
        <div
          className={`flex flex-col ${
            controlsReversed ? "items-end" : "items-start"
          }`}
        >
          <span className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
            流速
          </span>
          <div className="text-2xl font-light tracking-widest text-neutral-800 sm:text-3xl dark:text-neutral-100">
            <motion.div
              className={`timer-font min-w-[3ch] ${
                controlsReversed ? "text-right" : "text-left"
              } transform-gpu`}
              animate={{
                opacity: [null, 1],
                scale: flowRate > 0 ? [1.02, 1] : 1,
              }}
              transition={{
                duration: 0.15,
                ease: [0.4, 0, 0.2, 1],
              }}
              style={{
                willChange: "transform, opacity",
                transform: "translateZ(0)",
                contain: "content",
                backfaceVisibility: "hidden",
              }}
            >
              <span>{flowRate.toFixed(1)}</span>
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TimerDisplay; 