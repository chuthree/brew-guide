import React from 'react';

interface StageDividerProps {
  stageNumber: number; // 阶段编号
}

const StageDivider: React.FC<StageDividerProps> = ({ stageNumber }) => {
  return (
    <div className="relative my-6">
      {/* 分隔线 - 使用虚线样式 */}
      <div className="border-t border-dashed border-neutral-200/50 opacity-60 dark:border-neutral-800"></div>

      {/* 阶段标识 - 调整垂直对齐 */}
      <div className="absolute -top-px left-1/2 inline-flex -translate-x-1/2 translate-y-[-50%] transform items-center justify-center bg-neutral-50 px-3 dark:bg-neutral-900">
        <span className="text-[10px] leading-tight font-light text-neutral-600 opacity-70 dark:text-neutral-400">
          {stageNumber} 阶段
        </span>
      </div>
    </div>
  );
};

export default StageDivider;
