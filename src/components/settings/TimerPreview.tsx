'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { LayoutSettings } from '@/components/brewing/Timer/Settings';

interface TimerPreviewProps {
  settings: SettingsOptions;
}

// 基于实际配置的模拟计时器数据 - 使用三段式冲煮方案
const createSampleTimerData = (currentTime: number) => {
  const stages = createSampleExpandedStages();
  const stageLabels = [
    '焖蒸(绕圈注水)',
    '等待',
    '绕圈注水',
    '等待',
    '中心注水',
  ];

  let currentStageIndex = 0;
  let currentStage = stages[0];
  let nextStage = stages[1];

  // 找到当前阶段
  for (let i = 0; i < stages.length; i++) {
    if (currentTime >= stages[i].startTime && currentTime < stages[i].endTime) {
      currentStageIndex = i;
      currentStage = stages[i];
      nextStage = stages[i + 1] || stages[stages.length - 1];
      break;
    } else if (currentTime >= stages[i].endTime) {
      currentStageIndex = i;
      currentStage = stages[i];
      nextStage = stages[i + 1] || stages[stages.length - 1];
    }
  }

  return {
    currentTime,
    totalTime: 120, // V60 三段式总时长约2分钟
    currentStage: {
      type: currentStage.type as 'pour' | 'wait',
      label:
        stageLabels[currentStageIndex] || currentStage.type === 'pour'
          ? '绕圈注水'
          : '等待',
      endTime: currentStage.endTime,
      water: currentStage.water,
    },
    nextStage: {
      type: nextStage.type as 'pour' | 'wait',
      label:
        stageLabels[currentStageIndex + 1] ||
        (nextStage.type === 'pour' ? '绕圈注水' : '等待'),
      endTime: nextStage.endTime,
      water: nextStage.water,
    },
    flowRate: currentStage.type === 'pour' ? 2.8 : 0,
    isRunning: true,
  };
};

// 基于实际V60三段式方案的阶段数据
const createSampleExpandedStages = () => [
  { type: 'pour', startTime: 0, endTime: 25, water: '30g' }, // 焖蒸
  { type: 'wait', startTime: 25, endTime: 30, water: '30g' }, // 焖蒸等待
  { type: 'pour', startTime: 30, endTime: 50, water: '140g' }, // 第二段注水
  { type: 'wait', startTime: 50, endTime: 60, water: '140g' }, // 等待
  { type: 'pour', startTime: 60, endTime: 120, water: '225g' }, // 第三段注水
];

const formatTime = (seconds: number, showMs = false): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (showMs) {
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const TimerPreview: React.FC<TimerPreviewProps> = ({ settings }) => {
  // 静态的示例状态 - 显示第二段注水中的状态
  const currentTime = 35;
  const currentWater = 85;

  const timerData = createSampleTimerData(currentTime);
  const expandedStages = createSampleExpandedStages();

  // 设置默认值
  const layoutSettings: LayoutSettings = settings.layoutSettings || {};
  const showFlowRate = settings.showFlowRate ?? false;
  const stageInfoReversed = layoutSettings.stageInfoReversed ?? false;
  const controlsReversed = layoutSettings.controlsReversed ?? false;
  const alwaysShowTimerInfo = layoutSettings.alwaysShowTimerInfo ?? true;
  const showStageDivider = layoutSettings.showStageDivider ?? false;
  const progressBarHeight = layoutSettings.progressBarHeight ?? 4;

  // 获取字体大小类名 - 使用明确的类名以确保 Tailwind 包含这些样式
  const fontSizeClass =
    layoutSettings.dataFontSize === '3xl'
      ? 'text-3xl'
      : layoutSettings.dataFontSize === '4xl'
        ? 'text-4xl'
        : 'text-2xl';

  return (
    <div className="relative mb-8 min-h-12 overflow-hidden bg-neutral-50 dark:bg-neutral-900">
      {/* 预览标识 */}

      {/* 计时器界面预览 */}
      <div className="relative w-full">
        <div className="flex flex-col justify-end px-6 py-3">
          {/* 阶段信息和进度条区域 */}
          {alwaysShowTimerInfo && (
            <div className="space-y-3">
              {/* 当前阶段信息 */}
              <div
                className={`flex items-baseline border-l-2 border-neutral-800 pl-3 dark:border-neutral-100 ${
                  stageInfoReversed ? 'flex-row-reverse' : 'flex-row'
                } justify-between`}
              >
                <div className={stageInfoReversed ? 'text-right' : 'text-left'}>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    当前阶段
                  </div>
                  <div className="mt-1 text-sm font-medium tracking-wide">
                    {timerData.currentStage.label}
                  </div>
                </div>
                <div
                  className={`flex flex-row items-baseline ${
                    stageInfoReversed ? 'text-left' : 'text-right'
                  }`}
                >
                  <div className={stageInfoReversed ? 'mr-4' : 'mr-0'}>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      目标时间
                    </div>
                    <div className="mt-1 text-sm font-medium tracking-wide">
                      {formatTime(timerData.currentStage.endTime, true)}
                    </div>
                  </div>
                  <div className={`${showFlowRate ? 'min-w-20' : 'min-w-24'}`}>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      目标水量
                    </div>
                    <div
                      className={`mt-1 flex flex-col text-sm font-medium tracking-wide`}
                    >
                      <div
                        className={`flex items-baseline ${
                          stageInfoReversed ? 'justify-start' : 'justify-end'
                        }`}
                      >
                        <span>{currentWater}</span>
                        <span className="mx-0.5 text-neutral-300 dark:text-neutral-600">
                          /
                        </span>
                        <span>{timerData.currentStage.water}</span>
                      </div>
                    </div>
                  </div>
                  {showFlowRate && (
                    <div className="min-w-14">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        流速
                      </div>
                      <div className="mt-1 text-sm font-medium tracking-wide">
                        {timerData.flowRate.toFixed(1)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 下一阶段信息 */}
              <div
                className={`flex items-baseline border-l border-neutral-300 pl-3 dark:border-neutral-700 ${
                  stageInfoReversed ? 'flex-row-reverse' : 'flex-row'
                } justify-between`}
              >
                <div className={stageInfoReversed ? 'text-right' : 'text-left'}>
                  <div
                    className={`flex items-center ${
                      stageInfoReversed ? 'justify-end' : 'justify-start'
                    } gap-2 text-xs text-neutral-500 dark:text-neutral-400`}
                  >
                    <span>下一步</span>
                  </div>
                  <div className="mt-1">
                    <span className="text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                      {timerData.nextStage.label}
                    </span>
                  </div>
                </div>
                <div
                  className={`flex flex-row items-baseline ${
                    stageInfoReversed ? 'text-left' : 'text-right'
                  }`}
                >
                  <div className={stageInfoReversed ? 'mr-4' : 'mr-0'}>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      目标时间
                    </div>
                    <div className="mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400">
                      {formatTime(timerData.nextStage.endTime, true)}
                    </div>
                  </div>
                  <div className={`${showFlowRate ? 'min-w-20' : 'min-w-24'}`}>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      目标水量
                    </div>
                    <div
                      className={`mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400 ${
                        stageInfoReversed ? 'text-left' : 'text-right'
                      }`}
                    >
                      {timerData.nextStage.water}
                    </div>
                  </div>
                  {showFlowRate && (
                    <div className="min-w-14">
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        流速
                      </div>
                      <div
                        className={`mt-1 text-sm font-medium tracking-wide text-neutral-600 dark:text-neutral-400 ${
                          stageInfoReversed ? 'text-left' : 'text-right'
                        }`}
                      >
                        {timerData.nextStage.type === 'pour' ? '2.5' : '-'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 进度条 */}
              <div className="relative mb-3">
                {/* 阶段分隔线 */}
                {expandedStages.map((stage, index) => {
                  const totalTime =
                    expandedStages[expandedStages.length - 1].endTime;
                  const percentage = (stage.endTime / totalTime) * 100;
                  return showStageDivider ? (
                    <div
                      key={`divider-end-${stage.endTime}-${index}`}
                      className="absolute top-0 w-[2px] bg-neutral-50 dark:bg-neutral-900"
                      style={{
                        left: `${percentage}%`,
                        height: `${progressBarHeight}px`,
                        opacity: 0.8,
                      }}
                    />
                  ) : null;
                })}

                <div
                  className="w-full overflow-hidden bg-neutral-200/50 dark:bg-neutral-800"
                  style={{
                    height: `${progressBarHeight}px`,
                  }}
                >
                  {/* 阶段分隔线 */}
                  {expandedStages.map((stage, index) => {
                    if (index === 0) return null;

                    const totalTime =
                      expandedStages[expandedStages.length - 1].endTime;
                    const percentage = (stage.startTime / totalTime) * 100;

                    return (
                      <div
                        key={`divider-${stage.startTime}-${index}`}
                        className="absolute top-0 bottom-0 z-10 w-[1.5px] bg-neutral-100 dark:bg-neutral-900"
                        style={{
                          left: `${percentage}%`,
                          height: `${progressBarHeight}px`,
                        }}
                      />
                    );
                  })}

                  {/* 等待阶段的斜纹背景 */}
                  {expandedStages.map((stage, index) => {
                    const totalTime =
                      expandedStages[expandedStages.length - 1].endTime;
                    const startPercentage = (stage.startTime / totalTime) * 100;
                    const width =
                      ((stage.endTime - stage.startTime) / totalTime) * 100;

                    return stage.type === 'wait' ? (
                      <div
                        key={`waiting-${stage.endTime}-${index}`}
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
                        }}
                      />
                    ) : null;
                  })}

                  {/* 进度指示器 */}
                  <div
                    className="h-full bg-neutral-800 dark:bg-neutral-100"
                    style={{
                      width: `${(currentTime / timerData.totalTime) * 100}%`,
                    }}
                  />
                </div>

                {/* 时间标记 */}
                <div className="relative mt-1 h-3 w-full">
                  <div
                    className="absolute top-0 text-[9px] font-medium text-neutral-600 dark:text-neutral-300"
                    style={{
                      left: `${(timerData.currentStage.endTime / timerData.totalTime) * 100}%`,
                      transform: 'translateX(-100%)',
                    }}
                  >
                    {formatTime(timerData.currentStage.endTime, true)}
                  </div>

                  <div className="absolute top-0 right-0 text-[9px] font-medium text-neutral-600 dark:text-neutral-300">
                    {formatTime(timerData.totalTime, true)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 控制区域 */}
          <div
            className={`flex items-center ${
              controlsReversed ? 'flex-row-reverse' : 'flex-row'
            } min-w-0 justify-between gap-2`}
          >
            <div
              className={`grid grid-cols-[auto_auto_auto] ${
                showFlowRate ? 'gap-2 sm:gap-4' : 'gap-4 sm:gap-8'
              } min-w-0 flex-1 overflow-hidden`}
            >
              {/* 时间显示 */}
              <div
                className={`flex flex-col ${
                  controlsReversed ? 'items-end' : 'items-start'
                }`}
              >
                <span className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">
                  时间
                </span>
                <div
                  className={`timer-font min-w-[3ch] ${fontSizeClass} font-light tracking-widest text-neutral-800 dark:text-neutral-100 ${
                    controlsReversed ? 'text-right' : 'text-left'
                  }`}
                >
                  {formatTime(currentTime)}
                </div>
              </div>

              {/* 水量显示 */}
              <div
                className={`flex flex-col ${
                  controlsReversed ? 'items-end' : 'items-start'
                }`}
              >
                <span className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">
                  水量
                </span>
                <div
                  className={`timer-font min-w-[3ch] ${fontSizeClass} font-light tracking-widest text-neutral-800 dark:text-neutral-100 ${
                    controlsReversed ? 'text-right' : 'text-left'
                  }`}
                >
                  <span>{currentWater}</span>
                  <span className="ml-1 text-sm text-neutral-500 dark:text-neutral-400">
                    g
                  </span>
                </div>
              </div>

              {/* 流速显示 */}
              {showFlowRate && (
                <div
                  className={`flex flex-col ${
                    controlsReversed ? 'items-end' : 'items-start'
                  }`}
                >
                  <span className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">
                    流速
                  </span>
                  <div
                    className={`timer-font min-w-[2.5ch] ${fontSizeClass} font-light tracking-widest text-neutral-800 dark:text-neutral-100 ${
                      controlsReversed ? 'text-right' : 'text-left'
                    }`}
                  >
                    <span>{timerData.flowRate.toFixed(1)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 控制按钮 */}
            <div
              className={`flex flex-shrink-0 items-center ${
                controlsReversed
                  ? 'flex-row-reverse space-x-3 space-x-reverse'
                  : 'flex-row space-x-3'
              }`}
            >
              <button
                className={`${showFlowRate ? 'h-11 w-11 sm:h-12 sm:w-12' : 'h-12 w-12 sm:h-14 sm:w-14'} flex flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className={`${showFlowRate ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-5 w-5 sm:h-6 sm:w-6'}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 5.25v13.5m-7.5-13.5v13.5"
                  />
                </svg>
              </button>
              <button
                className={`${showFlowRate ? 'h-11 w-11 sm:h-12 sm:w-12' : 'h-12 w-12 sm:h-14 sm:w-14'} flex flex-shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className={`${showFlowRate ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-5 w-5 sm:h-6 sm:w-6'}`}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 上边缘渐变阴影 */}
      <div className="pointer-events-none absolute top-0 right-0 left-0 z-20 h-6 bg-gradient-to-b from-neutral-50 via-neutral-50/80 to-transparent dark:from-neutral-900 dark:via-neutral-900/80" />

      {/* 下边缘渐变阴影 */}
      <div className="pointer-events-none absolute right-0 bottom-0 left-0 z-20 h-6 bg-gradient-to-t from-neutral-50 via-neutral-50/80 to-transparent dark:from-neutral-900 dark:via-neutral-900/80" />
    </div>
  );
};

export default TimerPreview;
