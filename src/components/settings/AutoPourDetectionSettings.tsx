'use client';

import React from 'react';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { SettingSection, SettingRow, SettingToggle } from './atomic';

export default function AutoPourDetectionSettings() {
  const settings = useSettingsStore(state => state.settings);
  const updateAutoPourDetectionSettings = useSettingsStore(
    state => state.updateAutoPourDetectionSettings
  );

  const autoPourSettings = settings.autoPourDetection;

  const handleModeChange = (mode: 'off' | 'auto-start' | 'remind-only') => {
    updateAutoPourDetectionSettings({ mode });
  };

  const handleToggleEnabled = (enabled: boolean) => {
    updateAutoPourDetectionSettings({
      enabled,
      mode: enabled ? 'remind-only' : 'off',
    });
  };

  const handleToggleAutoStopCamera = (autoStopCamera: boolean) => {
    updateAutoPourDetectionSettings({ autoStopCamera });
  };

  const handleToggleDebugOverlay = (showDebugOverlay: boolean) => {
    updateAutoPourDetectionSettings({ showDebugOverlay });
  };

  const isEnabled = autoPourSettings?.enabled ?? false;
  const currentMode = autoPourSettings?.mode ?? 'off';

  return (
    <SettingSection title="自动注水检测">
      <div className="mb-3 rounded-lg border border-yellow-200/50 bg-yellow-50/50 p-3 text-sm text-yellow-800 dark:border-yellow-900/30 dark:bg-yellow-900/10 dark:text-yellow-200">
        <span className="font-medium">实验性功能</span>
        ：此功能正在测试中，可能不稳定。
        检测需要前置摄像头权限，所有处理在本地完成。
      </div>

      <SettingRow label="启用自动检测">
        <SettingToggle checked={isEnabled} onChange={handleToggleEnabled} />
      </SettingRow>

      {isEnabled && (
        <>
          <div className="mt-4 space-y-2">
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
              检测模式
            </label>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleModeChange('remind-only')}
                className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  currentMode === 'remind-only'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                }`}
              >
                <div className="font-medium">仅提醒</div>
                <div className="mt-1 text-xs opacity-70">
                  检测到注水时显示提示，点击后开始计时
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleModeChange('auto-start')}
                className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                  currentMode === 'auto-start'
                    ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/20 dark:text-blue-300'
                    : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                }`}
              >
                <div className="font-medium">自动开始</div>
                <div className="mt-1 text-xs opacity-70">
                  检测到注水时立即开始计时，2秒内可撤销
                </div>
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <SettingRow label="检测后自动关闭摄像头">
              <SettingToggle
                checked={autoPourSettings?.autoStopCamera ?? true}
                onChange={handleToggleAutoStopCamera}
              />
            </SettingRow>

            <SettingRow label="显示调试信息">
              <SettingToggle
                checked={autoPourSettings?.showDebugOverlay ?? false}
                onChange={handleToggleDebugOverlay}
              />
            </SettingRow>
          </div>

          <div className="mt-4 rounded-lg bg-neutral-100 p-3 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            <div className="mb-1 font-medium">使用说明：</div>
            <ol className="list-inside list-decimal space-y-1">
              <li>将手机平放，前置摄像头朝上</li>
              <li>确保光线充足，手部动作清晰可见</li>
              <li>开始注水后，系统会自动检测并响应</li>
              <li>如需撤销自动开始，请在2秒内点击撤销按钮</li>
            </ol>
          </div>
        </>
      )}
    </SettingSection>
  );
}
