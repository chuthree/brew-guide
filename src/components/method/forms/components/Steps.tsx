import React from 'react';
import { ArrowLeft } from 'lucide-react';

// 定义步骤类型
export type Step = 'name' | 'params' | 'stages' | 'complete';

interface StepsProps {
  steps: { id: Step; label: string }[];
  currentStep: Step;
  onBack: () => void;
}

const Steps: React.FC<StepsProps> = ({ steps, currentStep, onBack }) => {
  // 获取当前步骤索引
  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep);
  };

  // 渲染进度条
  const renderProgressBar = () => {
    const currentIndex = getCurrentStepIndex();
    const progress = ((currentIndex + 1) / steps.length) * 100;

    return (
      <div className="w-full h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-neutral-800 dark:bg-neutral-200 transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  };

  return (
    <div className="flex items-center justify-between mt-3 mb-6">
      <button
        type="button"
        onClick={onBack}
        className="rounded-full"
      >
        <ArrowLeft className="w-5 h-5 text-neutral-800 dark:text-neutral-200" />
      </button>
      <div className="w-full px-4">
        {renderProgressBar()}
      </div>
      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {getCurrentStepIndex() + 1}/{steps.length}
      </div>
    </div>
  );
};

export default Steps; 