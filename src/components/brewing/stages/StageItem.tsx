import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Method } from '@/lib/core/config';
import ActionMenu from '@/components/coffee-bean/ui/action-menu';
import { Step } from '@/lib/hooks/useBrewingState';

interface StageItemProps {
  step: Step & {
    customParams?: Record<string, string | number | boolean>;
    icon?: string;
    isPinned?: boolean;
    isDivider?: boolean;
    dividerText?: string;
    onToggleCollapse?: (isCollapsed: boolean) => void;
    time?: number;
    pourTime?: number;
    valveStatus?: string;
  };
  index: number;
  onClick: () => void;
  activeTab: string;
  selectedMethod: Method | null;
  currentStage: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  isPinned?: boolean;
  actionMenuStates?: Record<string, boolean>;
  setActionMenuStates?: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  showFlowRate?: boolean;
  allSteps?: Step[];
  stepDisplayMode?: 'independent' | 'cumulative' | 'time';
}

// 辅助函数：格式化时间
const formatTime = (seconds: number, compact: boolean = false) => {
  const positiveSeconds = Math.max(0, seconds);
  const mins = Math.floor(positiveSeconds / 60);
  const secs = positiveSeconds % 60;

  if (compact) {
    return mins > 0
      ? `${mins}'${secs.toString().padStart(2, '0')}"`
      : `${secs}"`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// 辅助函数：格式化时间范围 (用于 time 模式)
const formatTimeRange = (startSeconds: number, endSeconds: number) => {
  const formatSingle = (seconds: number) => {
    const positiveSeconds = Math.max(0, seconds);
    const mins = Math.floor(positiveSeconds / 60);
    const secs = positiveSeconds % 60;
    return `${mins}′${secs.toString().padStart(2, '0')}″`;
  };
  return `${formatSingle(startSeconds)} - ${formatSingle(endSeconds)}`;
};

// 辅助函数：计算流速
const calculateFlowRate = (waterAmount: string, time: string | number) => {
  if (!waterAmount || !time) return 0;
  const water = parseInt(waterAmount);
  const seconds = typeof time === 'string' ? parseInt(time) : time;
  if (seconds <= 0) return 0;
  return water / seconds;
};

// 改进的流速计算函数：考虑前后阶段的水量差值
const calculateImprovedFlowRate = (step: Step, allSteps: Step[]) => {
  if (!step || !step.items || !step.note || step.type !== 'pour') return 0;

  const currentWater = parseInt(step.items[0]);
  const currentTime =
    typeof step.note === 'string' ? parseInt(step.note) : step.note;

  if (!currentTime || currentTime <= 0) return 0;

  if (step.originalIndex !== undefined) {
    const sameStageSteps = allSteps.filter(
      s => s.originalIndex === step.originalIndex && s.type === 'pour'
    );
    const stepIndex = sameStageSteps.findIndex(s => s === step);

    if (stepIndex === 0) {
      const prevOriginalIndex = step.originalIndex - 1;
      const prevStageSteps = allSteps.filter(
        s => s.originalIndex === prevOriginalIndex && s.type === 'pour'
      );
      let prevWater = 0;
      if (prevStageSteps.length > 0) {
        const prevStep = prevStageSteps[prevStageSteps.length - 1];
        prevWater = prevStep.items ? parseInt(prevStep.items[0]) : 0;
      }
      const waterDiff = currentWater - prevWater;
      return waterDiff / currentTime;
    } else if (stepIndex > 0) {
      const prevStep = sameStageSteps[stepIndex - 1];
      const prevWater = prevStep.items ? parseInt(prevStep.items[0]) : 0;
      const waterDiff = currentWater - prevWater;
      return waterDiff / currentTime;
    }
  }

  return currentWater / currentTime;
};

// StageItem组件 - 使用 React.memo 优化性能
const StageItem: React.FC<StageItemProps> = React.memo(
  ({
    step,
    index,
    onClick,
    activeTab,
    selectedMethod,
    currentStage,
    onEdit,
    onDelete,
    onShare,
    isPinned: _isPinned,
    actionMenuStates: _actionMenuStates,
    setActionMenuStates: _setActionMenuStates,
    showFlowRate = false,
    allSteps = [],
    stepDisplayMode = 'cumulative',
  }) => {
    const [isCommonSectionCollapsed, setIsCommonSectionCollapsed] =
      useState(false);

    useEffect(() => {
      if (step.isDivider && step.onToggleCollapse) {
        step.onToggleCollapse(isCommonSectionCollapsed);
      }
    }, [isCommonSectionCollapsed, step]);

    const isWaitingStage = step.type === 'wait';
    const isBypassStep = step.pourType === 'bypass';
    const isCurrentStage = activeTab === '注水' && index === currentStage;

    const textStyle = useMemo(() => {
      return 'text-neutral-600 dark:text-neutral-400';
    }, []);

    const titleStyle = useMemo(() => {
      return 'text-neutral-800 dark:text-neutral-100';
    }, []);

    const opacityStyle = useMemo(() => {
      if (activeTab === '注水' && !isCurrentStage && index > currentStage) {
        return 'opacity-50';
      }
      return '';
    }, [activeTab, isCurrentStage, index, currentStage]);

    const handleClick = (e: React.MouseEvent) => {
      if (step.isDivider) {
        e.stopPropagation();
        setIsCommonSectionCollapsed(!isCommonSectionCollapsed);
        return;
      }
      onClick();
    };

    const actionMenuItems = useMemo(() => {
      const items = [];
      if (onEdit) {
        items.push({ id: 'edit', label: '编辑', onClick: onEdit });
      }
      if (onDelete) {
        items.push({
          id: 'delete',
          label: step.isCommonMethod ? '隐藏' : '删除',
          onClick: onDelete,
        });
      }
      if (onShare) {
        items.push({ id: 'share', label: '分享', onClick: onShare });
      }
      return items;
    }, [onEdit, onDelete, onShare, step.isCommonMethod]);

    const renderStageContent = () => {
      if (step.isDivider) {
        return (
          <div
            className="relative mb-4 flex cursor-pointer items-center"
            onClick={handleClick}
          >
            <div className="grow border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
            <button className="mx-3 flex items-center justify-center text-[10px] font-medium text-neutral-600 dark:text-neutral-400">
              {step.dividerText || ''}
              <svg
                className={`ml-1 h-3 w-3 transition-transform duration-200 ${isCommonSectionCollapsed ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 9L12 15L18 9"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="grow border-t border-neutral-200/50 dark:border-neutral-800/50"></div>
          </div>
        );
      }

      // 时间模式下隐藏等待步骤
      if (
        stepDisplayMode === 'time' &&
        isWaitingStage &&
        activeTab === '注水'
      ) {
        return null;
      }

      return (
        <div
          className={`group relative border-l ${isWaitingStage ? 'border-dashed' : ''} border-neutral-200/50 pl-6 dark:border-neutral-800/50 ${textStyle} ${opacityStyle}`}
        >
          {isCurrentStage && (
            <motion.div
              className={`absolute top-0 -left-px h-full w-px ${isWaitingStage ? 'bg-neutral-600 dark:bg-neutral-400' : 'bg-neutral-800 dark:bg-white'}`}
              initial={{ scaleY: 0, transformOrigin: 'top' }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.26 }}
            />
          )}
          <div
            className={activeTab !== '注水' ? 'cursor-pointer' : ''}
            onClick={handleClick}
          >
            <>
              <div className="flex items-center justify-between">
                <div className="flex min-w-0 items-baseline gap-3 overflow-hidden">
                  {step.icon && (
                    <span className="mr-1 text-xs">{step.icon}</span>
                  )}
                  <h3
                    className={`truncate text-xs font-medium tracking-wider ${titleStyle}`}
                  >
                    {step.title}
                  </h3>
                  {activeTab === '注水' &&
                    selectedMethod &&
                    step.originalIndex !== undefined &&
                    step.items && (
                      <div className="flex shrink-0 items-baseline gap-3 text-xs font-medium text-neutral-800 dark:text-neutral-100">
                        {!isBypassStep &&
                          !(stepDisplayMode === 'time' && isWaitingStage) &&
                          (step.endTime !== undefined ||
                            step.note ||
                            step.time !== undefined) && (
                            <>
                              <span>
                                {(() => {
                                  if (stepDisplayMode === 'time') {
                                    if (
                                      step.startTime !== undefined &&
                                      step.endTime !== undefined
                                    ) {
                                      return formatTimeRange(
                                        step.startTime,
                                        step.endTime
                                      );
                                    }
                                    return step.endTime !== undefined
                                      ? formatTime(step.endTime, true)
                                      : '';
                                  } else if (
                                    stepDisplayMode === 'independent'
                                  ) {
                                    if (step.note) {
                                      const duration = parseInt(
                                        String(step.note)
                                      );
                                      return formatTime(duration, true);
                                    }
                                    if (
                                      step.startTime !== undefined &&
                                      step.endTime !== undefined
                                    ) {
                                      return formatTime(
                                        step.endTime - step.startTime,
                                        true
                                      );
                                    }
                                    return step.time !== undefined
                                      ? formatTime(step.time, true)
                                      : '';
                                  } else {
                                    return step.endTime !== undefined
                                      ? formatTime(step.endTime, true)
                                      : step.note
                                        ? formatTime(
                                            parseInt(String(step.note)),
                                            true
                                          )
                                        : step.time !== undefined
                                          ? formatTime(step.time, true)
                                          : '';
                                  }
                                })()}
                              </span>
                              {!isWaitingStage && <span>·</span>}
                            </>
                          )}
                        {!isWaitingStage && <span>{step.items[0]}</span>}
                        {showFlowRate && step.type === 'pour' && step.note && (
                          <>
                            <span>·</span>
                            <span>
                              {allSteps.length > 0
                                ? calculateImprovedFlowRate(
                                    step,
                                    allSteps
                                  ).toFixed(1)
                                : calculateFlowRate(
                                    step.items[0],
                                    step.note
                                  ).toFixed(1)}
                              g/s
                            </span>
                          </>
                        )}
                      </div>
                    )}
                </div>
                {step.description && (
                  <p className={`truncate text-xs font-medium ${textStyle}`}>
                    {step.description}
                  </p>
                )}
                {step.detail && (
                  <p className={`truncate text-xs font-medium ${textStyle}`}>
                    {step.detail}
                  </p>
                )}
                {(onEdit || onDelete || onShare) && (
                  <div className="ml-2 flex shrink-0 items-baseline">
                    <ActionMenu
                      items={actionMenuItems}
                      showAnimation={false}
                      onStop={e => e.stopPropagation()}
                    />
                  </div>
                )}
              </div>
              <div className="mt-2">
                {activeTab === '注水' && step.items ? (
                  <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    {step.items[1]}
                  </p>
                ) : step.items ? (
                  <ul className="space-y-1">
                    {step.items.map((item: string, i: number) => (
                      <li
                        key={i}
                        className={`text-xs font-medium ${textStyle}`}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </>
          </div>
        </div>
      );
    };

    return (
      <div className="group relative" onClick={handleClick}>
        {renderStageContent()}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.step === nextProps.step &&
      prevProps.index === nextProps.index &&
      prevProps.activeTab === nextProps.activeTab &&
      prevProps.currentStage === nextProps.currentStage &&
      prevProps.selectedMethod === nextProps.selectedMethod &&
      prevProps.showFlowRate === nextProps.showFlowRate &&
      prevProps.stepDisplayMode === nextProps.stepDisplayMode &&
      prevProps.onEdit === nextProps.onEdit &&
      prevProps.onDelete === nextProps.onDelete &&
      prevProps.onShare === nextProps.onShare
    );
  }
);

StageItem.displayName = 'StageItem';

export default StageItem;
