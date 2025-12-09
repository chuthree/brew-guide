'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { ButtonGroup } from '@/components/ui/ButtonGroup';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { SettingPage } from './atomic';

import TimerPreview from './TimerPreview';

interface TimerSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const TimerSettings: React.FC<TimerSettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
  // 控制动画状态
  const [shouldRender, setShouldRender] = React.useState(true);
  const [isVisible, setIsVisible] = React.useState(false);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'timer-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  // UI 返回按钮点击处理
  const handleClose = () => {
    modalHistory.back();
  };

  // 处理显示/隐藏动画（入场动画）
  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  if (!shouldRender) return null;

  return (
    <SettingPage title="计时器设置" isVisible={isVisible} onClose={handleClose}>
      {/* 预览区域 */}
      <TimerPreview settings={settings} />
      {/* 设置内容 */}
      <div className="space-y-8 px-6">
        {/* 布局设置分组 */}
        <div className="space-y-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            布局设置
          </h3>

          {/* 阶段信息布局反转 */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              阶段信息布局反转
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.layoutSettings?.stageInfoReversed || false}
                onChange={e => {
                  const newLayoutSettings = {
                    ...settings.layoutSettings,
                    stageInfoReversed: e.target.checked,
                  };
                  handleChange('layoutSettings', newLayoutSettings);
                }}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
            </label>
          </div>

          {/* 控制区布局反转 */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              控制区布局反转
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.layoutSettings?.controlsReversed || false}
                onChange={e => {
                  const newLayoutSettings = {
                    ...settings.layoutSettings,
                    controlsReversed: e.target.checked,
                  };
                  handleChange('layoutSettings', newLayoutSettings);
                }}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
            </label>
          </div>
        </div>

        {/* 显示选项分组 */}
        <div className="space-y-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            显示设置
          </h3>

          {/* 始终显示计时器信息 */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              始终显示计时器信息
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.layoutSettings?.alwaysShowTimerInfo || false}
                onChange={e => {
                  const newLayoutSettings = {
                    ...settings.layoutSettings,
                    alwaysShowTimerInfo: e.target.checked,
                  };
                  handleChange('layoutSettings', newLayoutSettings);
                }}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
            </label>
          </div>

          {/* 显示流速 */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              显示流速
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.showFlowRate || false}
                onChange={e => handleChange('showFlowRate', e.target.checked)}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
            </label>
          </div>

          {/* 进度条高度 */}
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              进度条高度
            </div>
            <div className="text-sm text-neutral-400 dark:text-neutral-500">
              {settings.layoutSettings?.progressBarHeight || 4}px (默认 4px)
            </div>
          </div>
          <div className="mb-3 px-1">
            <input
              type="range"
              min="2"
              max="12"
              step="1"
              value={settings.layoutSettings?.progressBarHeight || 4}
              onChange={e => {
                const newLayoutSettings = {
                  ...settings.layoutSettings,
                  progressBarHeight: parseInt(e.target.value),
                };
                handleChange('layoutSettings', newLayoutSettings);
              }}
              className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-neutral-200 dark:bg-neutral-700"
            />
            <div className="mt-1 flex justify-between text-xs text-neutral-500">
              <span>细</span>
              <span>粗</span>
            </div>
          </div>

          {/* 数据显示字体大小 */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              数据显示字体大小
            </div>
            <ButtonGroup
              value={settings.layoutSettings?.dataFontSize || '2xl'}
              options={[
                { value: '2xl', label: '标准' },
                { value: '3xl', label: '大' },
                { value: '4xl', label: '特大' },
              ]}
              onChange={value => {
                const newLayoutSettings = {
                  ...settings.layoutSettings,
                  dataFontSize: value as '2xl' | '3xl' | '4xl',
                };
                handleChange('layoutSettings', newLayoutSettings);
              }}
            />
          </div>
        </div>

        {/* 外观定制分组 */}
        <div className="space-y-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            方案列表设置
          </h3>

          {/* 显示阶段分隔线 */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              显示阶段分隔线
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.layoutSettings?.showStageDivider || false}
                onChange={e => {
                  const newLayoutSettings = {
                    ...settings.layoutSettings,
                    showStageDivider: e.target.checked,
                  };
                  handleChange('layoutSettings', newLayoutSettings);
                }}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
            </label>
          </div>

          {/* 简洁模式 */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              简洁模式
            </div>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                checked={settings.layoutSettings?.compactMode || false}
                onChange={e => {
                  const newLayoutSettings = {
                    ...settings.layoutSettings,
                    compactMode: e.target.checked,
                  };
                  handleChange('layoutSettings', newLayoutSettings);
                }}
                className="peer sr-only"
              />
              <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
            </label>
          </div>
        </div>
      </div>
    </SettingPage>
  );
};

export default TimerSettings;
