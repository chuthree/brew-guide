import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ButtonGroup } from '@/components/ui/ButtonGroup';
import { useSettingsStore } from '@/lib/stores/settingsStore';

// 布局设置接口
export interface LayoutSettings {
  stageInfoReversed?: boolean; // 是否反转阶段信息布局
  progressBarHeight?: number; // 进度条高度（像素）
  controlsReversed?: boolean; // 是否反转底部控制区布局
  alwaysShowTimerInfo?: boolean; // 是否始终显示计时器信息区域
  showStageDivider?: boolean; // 是否显示阶段分隔线
  compactMode?: boolean; // 是否启用简洁模式
  dataFontSize?: '2xl' | '3xl' | '4xl'; // 数据显示字体大小
  stepDisplayMode?: 'independent' | 'cumulative' | 'time'; // 步骤时间显示模式：独立、累计、时间
}

interface BrewingTimerSettingsProps {
  show: boolean;
  onClose: () => void;
  layoutSettings: LayoutSettings;
  showFlowRate: boolean;
  onLayoutChange: (settings: LayoutSettings) => void;
  onFlowRateSettingChange: (showFlowRate: boolean) => void;
}

const BrewingTimerSettings: React.FC<BrewingTimerSettingsProps> = ({
  show,
  onClose,
  layoutSettings,
  showFlowRate,
  onLayoutChange,
  onFlowRateSettingChange,
}) => {
  const [localLayoutSettings, setLocalLayoutSettings] =
    useState<LayoutSettings>(layoutSettings);
  const [localShowFlowRate, setLocalShowFlowRate] = useState(showFlowRate);

  // 监听布局设置变化
  useEffect(() => {
    setLocalLayoutSettings(layoutSettings);
  }, [layoutSettings]);

  // 监听流速显示设置变化
  useEffect(() => {
    setLocalShowFlowRate(showFlowRate);
  }, [showFlowRate]);

  // 处理布局设置变化
  const handleLayoutChange = useCallback(
    (newSettings: LayoutSettings) => {
      // 首先更新本地状态
      setLocalLayoutSettings(newSettings);

      // 调用父组件提供的回调
      onLayoutChange(newSettings);
    },
    [onLayoutChange]
  );

  // 处理流速显示设置变化
  const handleFlowRateSettingChange = useCallback(
    (showFlowRate: boolean) => {
      // 更新本地状态
      setLocalShowFlowRate(showFlowRate);

      // 调用父组件提供的回调
      onFlowRateSettingChange(showFlowRate);

      // 使用 settingsStore 保存设置
      useSettingsStore
        .getState()
        .updateSettings({ showFlowRate })
        .catch(error => {
          console.error('保存流速设置失败', error);
        });
    },
    [onFlowRateSettingChange]
  );

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute right-0 bottom-full left-0 transform-gpu bg-neutral-50 px-6 py-4 dark:bg-neutral-900"
          style={{
            willChange: 'transform, opacity',
            transform: 'translateZ(0)',
            zIndex: 40,
          }}
        >
          {/* 添加渐变阴影 */}
          <div className="pointer-events-none absolute -top-12 right-0 left-0 h-12 bg-linear-to-t from-neutral-50 to-transparent dark:from-neutral-900"></div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                计时器设置
              </h3>
              <button
                onClick={onClose}
                className="rounded-full p-1 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  阶段信息布局反转
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={localLayoutSettings?.stageInfoReversed || false}
                    onChange={e => {
                      const newSettings = {
                        ...localLayoutSettings,
                        stageInfoReversed: e.target.checked,
                      };
                      handleLayoutChange(newSettings);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  控制区布局反转
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={localLayoutSettings?.controlsReversed || false}
                    onChange={e => {
                      const newSettings = {
                        ...localLayoutSettings,
                        controlsReversed: e.target.checked,
                      };
                      handleLayoutChange(newSettings);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  始终显示计时器信息
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={localLayoutSettings?.alwaysShowTimerInfo || false}
                    onChange={e => {
                      const newSettings = {
                        ...localLayoutSettings,
                        alwaysShowTimerInfo: e.target.checked,
                      };
                      handleLayoutChange(newSettings);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  显示阶段分隔线
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={localLayoutSettings?.showStageDivider || false}
                    onChange={e => {
                      const newSettings = {
                        ...localLayoutSettings,
                        showStageDivider: e.target.checked,
                      };
                      handleLayoutChange(newSettings);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  显示流速
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={localShowFlowRate || false}
                    onChange={e => {
                      handleFlowRateSettingChange(e.target.checked);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  简洁模式
                </span>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={localLayoutSettings?.compactMode || false}
                    onChange={e => {
                      const newSettings = {
                        ...localLayoutSettings,
                        compactMode: e.target.checked,
                      };
                      handleLayoutChange(newSettings);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
                </label>
              </div>

              <div className="space-y-2">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  进度条高度：{localLayoutSettings?.progressBarHeight || 4}px
                </span>
                <input
                  type="range"
                  min="2"
                  max="12"
                  step="1"
                  value={localLayoutSettings?.progressBarHeight || 4}
                  onChange={e => {
                    const newSettings = {
                      ...localLayoutSettings,
                      progressBarHeight: parseInt(e.target.value),
                    };
                    handleLayoutChange(newSettings);
                  }}
                  className="h-1 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  数据显示字体大小
                </span>
                <ButtonGroup
                  value={localLayoutSettings?.dataFontSize || '2xl'}
                  options={[
                    { value: '2xl', label: '标准' },
                    { value: '3xl', label: '大' },
                    { value: '4xl', label: '特大' },
                  ]}
                  onChange={value => {
                    const newSettings = {
                      ...localLayoutSettings,
                      dataFontSize: value as '2xl' | '3xl' | '4xl',
                    };
                    handleLayoutChange(newSettings);
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  步骤时间显示
                </span>
                <ButtonGroup
                  value={localLayoutSettings?.stepDisplayMode || 'cumulative'}
                  options={[
                    { value: 'independent', label: '独立' },
                    { value: 'cumulative', label: '累计' },
                    { value: 'time', label: '时间' },
                  ]}
                  onChange={value => {
                    const newSettings = {
                      ...localLayoutSettings,
                      stepDisplayMode: value as 'independent' | 'cumulative' | 'time',
                    };
                    handleLayoutChange(newSettings);
                  }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BrewingTimerSettings;
