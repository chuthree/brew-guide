'use client';

import React, { useState, useEffect } from 'react';
import {
  SettingsOptions,
  defaultSettings,
} from '@/components/settings/Settings';
import fontZoomUtils from '@/lib/utils/fontZoomUtils';

// 设置页面界面属性
interface OnboardingProps {
  onSettingsChange: (settings: SettingsOptions) => void;
  onComplete: () => void;
}

// 主组件
const Onboarding: React.FC<OnboardingProps> = ({
  onSettingsChange,
  onComplete,
}) => {
  // 设置选项
  const [settings, setSettings] = useState<SettingsOptions>(defaultSettings);
  // 检查字体缩放功能是否可用
  const [isFontZoomEnabled, setIsFontZoomEnabled] = useState(false);

  // 初始化
  useEffect(() => {
    // 检查字体缩放功能是否可用
    setIsFontZoomEnabled(fontZoomUtils.isAvailable());
  }, []);

  // 移除未使用的彩带特效函数

  // 处理设置变更
  const handleSettingChange = <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      return newSettings;
    });

    // 当改变字体缩放级别时立即应用
    if (key === 'textZoomLevel') {
      fontZoomUtils.set(value as number);
    }
  };

  // 处理完成按钮点击
  const handleComplete = async () => {
    try {
      // 动态导入 Storage
      const { Storage } = await import('@/lib/core/storage');
      // 保存用户设置
      await Storage.set('brewGuideSettings', JSON.stringify(settings));
      // 标记引导已完成
      await Storage.set('onboardingCompleted', 'true');

      // 应用字体缩放级别
      if (settings.textZoomLevel) {
        fontZoomUtils.set(settings.textZoomLevel);
      }

      // 通知上层组件设置已变更
      onSettingsChange(settings);
      // 调用完成回调
      onComplete();
    } catch (error) {
      console.error('完成引导设置时发生错误:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 半透明背景 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 设置内容卡片 */}
      <div className="pb-safe-bottom relative w-full rounded-t-2xl bg-neutral-50 dark:bg-neutral-900">
        {/* 内容容器 */}
        <div className="relative flex flex-col px-5 pt-4 pb-6">
          {/* 上方把手示意 */}
          <div className="mb-3 flex justify-center">
            <div className="h-1 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800"></div>
          </div>

          {/* 内容区域 */}
          <div className="relative">
            <div className="flex w-full flex-col">
              <div className="mb-6 text-center">
                <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200">
                  欢迎使用
                </h2>
                <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
                  设置偏好，获得更好的使用体验
                </p>
              </div>

              <div className="w-full space-y-4">
                {/* 字体缩放选项 - 仅在可用时显示 */}
                {isFontZoomEnabled && (
                  <div className="flex items-center justify-between rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        字体大小
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() =>
                          handleSettingChange(
                            'textZoomLevel',
                            Math.max(0.8, settings.textZoomLevel - 0.1)
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
                        disabled={settings.textZoomLevel <= 0.8}
                      >
                        <span className="text-base font-semibold">−</span>
                      </button>
                      <button
                        onClick={() =>
                          handleSettingChange('textZoomLevel', 1.0)
                        }
                        className="h-7 rounded-full bg-neutral-200 px-3 text-xs font-medium text-neutral-700 transition-colors dark:bg-neutral-700 dark:text-neutral-300"
                      >
                        {settings.textZoomLevel.toFixed(1)}×
                      </button>
                      <button
                        onClick={() =>
                          handleSettingChange(
                            'textZoomLevel',
                            Math.min(1.4, settings.textZoomLevel + 0.1)
                          )
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-200 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-200"
                        disabled={settings.textZoomLevel >= 1.4}
                      >
                        <span className="text-base font-semibold">+</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* 用户名输入 */}
                <div className="rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
                  <label className="mb-1 block text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    用户名
                  </label>
                  <input
                    type="text"
                    value={settings.username}
                    onChange={e =>
                      handleSettingChange('username', e.target.value)
                    }
                    placeholder="请输入您的用户名"
                    className="mt-1 w-full appearance-none rounded-lg bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:outline-hidden dark:bg-neutral-700 dark:text-neutral-200"
                  />
                  <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                    使用分享功能时，会显示您的用户名（选填）
                  </p>
                </div>
              </div>
              {/* 底部按钮 */}
              <div className="mt-8">
                <button
                  onClick={handleComplete}
                  className="w-full rounded-lg bg-neutral-800 px-4 py-3 font-medium text-neutral-100 transition-colors hover:bg-neutral-700 dark:bg-neutral-50 dark:text-neutral-900 dark:hover:bg-neutral-200"
                >
                  开始使用
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
