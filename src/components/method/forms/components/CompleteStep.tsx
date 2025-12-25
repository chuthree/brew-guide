import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

// 添加动画变体
const pageVariants = {
  initial: {
    opacity: 0,
  },
  in: {
    opacity: 1,
  },
  out: {
    opacity: 0,
  },
};

const pageTransition = {
  duration: 0.26,
};

interface CompleteStepProps {
  methodName: string;
  coffee: string;
  water: string;
  ratio: string;
  totalTime: number;
  isEdit: boolean;
  formatTime: (seconds: number) => string;
  isEspressoMachine?: boolean; // 是否是意式机
  formattedEspressoWater?: string; // 格式化后的意式水量
}

const CompleteStep: React.FC<CompleteStepProps> = ({
  methodName,
  coffee,
  water,
  ratio,
  totalTime,
  isEdit,
  formatTime,
  isEspressoMachine = false,
  formattedEspressoWater,
}) => {
  return (
    <motion.div
      key="complete-step"
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      className="relative flex flex-col items-center justify-center space-y-8 pt-10 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
        <Check className="h-8 w-8 text-neutral-800 dark:text-neutral-200" />
      </div>
      <div className="space-y-2">
        <h3 className="text-xl font-medium text-neutral-800 dark:text-neutral-200">
          {isEdit ? '方案编辑完成' : '方案创建完成'}
        </h3>
        <p className="text-neutral-600 dark:text-neutral-400">
          你的咖啡冲煮方案已经准备就绪
        </p>
      </div>
      <div className="w-full space-y-4 px-4">
        <div className="flex items-center justify-between border-b border-neutral-200/50 py-2 dark:border-neutral-700">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            方案名称
          </span>
          <span className="text-sm font-medium">{methodName}</span>
        </div>
        <div className="flex items-center justify-between border-b border-neutral-200/50 py-2 dark:border-neutral-700">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            咖啡粉量
          </span>
          <span className="text-sm font-medium">{coffee}</span>
        </div>
        <div className="flex items-center justify-between border-b border-neutral-200/50 py-2 dark:border-neutral-700">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            水量
          </span>
          {isEspressoMachine && formattedEspressoWater ? (
            <div className="text-right">
              <span className="text-sm font-medium">
                {formattedEspressoWater}
              </span>
            </div>
          ) : (
            <span className="text-sm font-medium">{water}</span>
          )}
        </div>
        <div className="flex items-center justify-between border-b border-neutral-200/50 py-2 dark:border-neutral-700">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            粉水比
          </span>
          <span className="text-sm font-medium">{ratio}</span>
        </div>
        <div className="flex items-center justify-between border-b border-neutral-200/50 py-2 dark:border-neutral-700">
          <span className="text-sm text-neutral-500 dark:text-neutral-400">
            总时间
          </span>
          <span className="text-sm font-medium">{formatTime(totalTime)}</span>
        </div>
      </div>
      {/* 底部渐变阴影 - 提示有更多内容 */}
      <div className="pointer-events-none sticky right-0 bottom-0 left-0 h-12 w-full bg-linear-to-t from-neutral-50 to-transparent dark:from-neutral-900"></div>
    </motion.div>
  );
};

export default CompleteStep;
