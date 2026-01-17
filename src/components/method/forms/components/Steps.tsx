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
      <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
        <div
          className="h-full bg-neutral-800 transition-all duration-300 ease-in-out dark:bg-neutral-200"
          style={{ width: `${progress}%` }}
        />
      </div>
    );
  };

  return (
    <div className="mt-3 mb-6 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="-m-3 cursor-pointer rounded-full p-3"
      >
        <ArrowLeft className="h-5 w-5 text-neutral-800 dark:text-neutral-200" />
      </button>
      <div className="w-full px-4">{renderProgressBar()}</div>
      <div className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
        {getCurrentStepIndex() + 1}/{steps.length}
      </div>
    </div>
  );
};

export default Steps;
