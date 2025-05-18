import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Storage } from "@/lib/core/storage";

// 布局设置接口
export interface LayoutSettings {
  stageInfoReversed?: boolean; // 是否反转阶段信息布局
  progressBarHeight?: number; // 进度条高度（像素）
  controlsReversed?: boolean; // 是否反转底部控制区布局
  alwaysShowTimerInfo?: boolean; // 是否始终显示计时器信息区域
  showStageDivider?: boolean; // 是否显示阶段分隔线
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
  const [localLayoutSettings, setLocalLayoutSettings] = useState<LayoutSettings>(layoutSettings);
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
  const handleLayoutChange = useCallback((newSettings: LayoutSettings) => {
    // 首先更新本地状态
    setLocalLayoutSettings(newSettings);
    
    // 调用父组件提供的回调
    onLayoutChange(newSettings);
  }, [onLayoutChange]);

  // 处理流速显示设置变化
  const handleFlowRateSettingChange = useCallback((showFlowRate: boolean) => {
    // 更新本地状态
    setLocalShowFlowRate(showFlowRate);
    
    // 调用父组件提供的回调
    onFlowRateSettingChange(showFlowRate);

    // 将更新保存到 Storage 以确保持久化
    const updateSettings = async () => {
      try {
        // 先获取当前设置
        const currentSettingsStr = await Storage.get('brewGuideSettings');
        if (currentSettingsStr) {
          const currentSettings = JSON.parse(currentSettingsStr);
          // 更新 showFlowRate 设置
          const newSettings = { ...currentSettings, showFlowRate };
          // 保存回存储
          await Storage.set('brewGuideSettings', JSON.stringify(newSettings));
          console.log('流速设置已保存', showFlowRate);
        }
      } catch (error) {
        console.error('保存流速设置失败', error);
      }
    };
    
    updateSettings();
  }, [onFlowRateSettingChange]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="absolute bottom-full left-0 right-0 px-6 py-4 bg-neutral-50 dark:bg-neutral-900 transform-gpu"
          style={{
            willChange: "transform, opacity",
            transform: "translateZ(0)",
            zIndex: 40,
          }}
        >
          {/* 添加渐变阴影 */}
          <div className="absolute -top-12 left-0 right-0 h-12 bg-linear-to-t from-neutral-50 dark:from-neutral-900 to-transparent pointer-events-none"></div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                计时器设置
              </h3>
              <button
                onClick={onClose}
                className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
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
                    onChange={(e) => {
                      const newSettings = {
                        ...localLayoutSettings,
                        stageInfoReversed: e.target.checked,
                      };
                      handleLayoutChange(newSettings);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
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
                    onChange={(e) => {
                      const newSettings = {
                        ...localLayoutSettings,
                        controlsReversed: e.target.checked,
                      };
                      handleLayoutChange(newSettings);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
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
                    onChange={(e) => {
                      const newSettings = {
                        ...localLayoutSettings,
                        alwaysShowTimerInfo: e.target.checked,
                      };
                      handleLayoutChange(newSettings);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
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
                    onChange={(e) => {
                      const newSettings = {
                        ...localLayoutSettings,
                        showStageDivider: e.target.checked,
                      };
                      handleLayoutChange(newSettings);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
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
                    onChange={(e) => {
                      handleFlowRateSettingChange(e.target.checked);
                    }}
                    className="peer sr-only"
                  />
                  <div className="peer h-5 w-9 rounded-full bg-neutral-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-neutral-600 peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500" />
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
                  onChange={(e) => {
                    const newSettings = {
                      ...localLayoutSettings,
                      progressBarHeight: parseInt(e.target.value),
                    };
                    handleLayoutChange(newSettings);
                  }}
                  className="w-full h-1 bg-neutral-200 rounded-full appearance-none cursor-pointer dark:bg-neutral-700"
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