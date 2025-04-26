import React from 'react';
import { motion } from 'framer-motion';

/**
 * 计时器按钮组件属性接口
 */
interface TimerButtonsProps {
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  controlsReversed?: boolean;
  showFlowRate?: boolean; // 影响按钮尺寸
}

/**
 * 计时器控制按钮组件
 * 
 * 提供开始/暂停和重置按钮
 */
const TimerButtons: React.FC<TimerButtonsProps> = ({
  isRunning,
  onStart,
  onPause,
  onReset,
  controlsReversed = false,
  showFlowRate = false,
}) => {
  return (
    <div
      className={`flex items-center ${
        controlsReversed
          ? "flex-row-reverse space-x-4 space-x-reverse"
          : "flex-row space-x-4"
      }`}
    >
      {/* 开始/暂停按钮 */}
      <motion.button
        onClick={isRunning ? onPause : onStart}
        className={`${showFlowRate ? 'w-12 h-12' : 'w-14 h-14'} flex items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 transform-gpu`}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
        style={{
          willChange: "transform",
          transform: "translateZ(0)",
          contain: "layout",
          backfaceVisibility: "hidden",
        }}
      >
        {isRunning ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={`${showFlowRate ? 'w-5 h-5' : 'w-6 h-6'}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25v13.5m-7.5-13.5v13.5"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={`${showFlowRate ? 'w-5 h-5' : 'w-6 h-6'}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
            />
          </svg>
        )}
      </motion.button>

      {/* 重置按钮 */}
      <motion.button
        onClick={onReset}
        className={`${showFlowRate ? 'w-12 h-12' : 'w-14 h-14'} flex items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 transform-gpu`}
        whileTap={{ scale: 0.95 }}
        transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
        style={{
          willChange: "transform",
          transform: "translateZ(0)",
          contain: "layout",
          backfaceVisibility: "hidden",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          className={`${showFlowRate ? 'w-5 h-5' : 'w-6 h-6'}`}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
      </motion.button>
    </div>
  );
};

export default TimerButtons; 