import React from 'react';
import { motion } from 'framer-motion';

/**
 * 跳过按钮组件属性接口
 */
interface SkipButtonProps {
  show: boolean;
  onSkip: () => void;
}

/**
 * 跳过按钮组件
 * 
 * 用于跳过当前阶段
 */
const SkipButton: React.FC<SkipButtonProps> = ({ show, onSkip }) => {
  if (!show) return null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      onClick={onSkip}
      className="absolute right-6 -top-12 flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400 transform-gpu"
      style={{
        willChange: "transform, opacity",
        transform: "translateZ(0)",
        contain: "layout",
        backfaceVisibility: "hidden",
      }}
      whileTap={{ scale: 0.95 }}
    >
      <span>跳过当前阶段</span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-4 h-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z"
        />
      </svg>
    </motion.button>
  );
};

export default SkipButton; 