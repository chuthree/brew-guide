'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { ButtonGroup } from '@/components/ui/ButtonGroup';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
  SettingSlider,
} from './atomic';

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
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);

  // 使用 settingsStore 的 handleChange
  const handleChange = React.useCallback(
    async <K extends keyof SettingsOptions>(
      key: K,
      value: SettingsOptions[K]
    ) => {
      await updateSettings({ [key]: value } as any);
    },
    [updateSettings]
  );

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

      <SettingSection title="布局设置" className="mt-6">
        <SettingRow label="阶段信息布局反转">
          <SettingToggle
            checked={settings.layoutSettings?.stageInfoReversed || false}
            onChange={checked => {
              const newLayoutSettings = {
                ...settings.layoutSettings,
                stageInfoReversed: checked,
              };
              handleChange('layoutSettings', newLayoutSettings);
            }}
          />
        </SettingRow>
        <SettingRow label="控制区布局反转" isLast>
          <SettingToggle
            checked={settings.layoutSettings?.controlsReversed || false}
            onChange={checked => {
              const newLayoutSettings = {
                ...settings.layoutSettings,
                controlsReversed: checked,
              };
              handleChange('layoutSettings', newLayoutSettings);
            }}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="显示设置">
        <SettingRow label="始终显示计时器信息">
          <SettingToggle
            checked={settings.layoutSettings?.alwaysShowTimerInfo || false}
            onChange={checked => {
              const newLayoutSettings = {
                ...settings.layoutSettings,
                alwaysShowTimerInfo: checked,
              };
              handleChange('layoutSettings', newLayoutSettings);
            }}
          />
        </SettingRow>
        <SettingRow label="显示流速">
          <SettingToggle
            checked={settings.showFlowRate || false}
            onChange={checked => handleChange('showFlowRate', checked)}
          />
        </SettingRow>
        <SettingRow label="进度条高度" vertical>
          <SettingSlider
            min={4}
            max={20}
            step={4}
            value={settings.layoutSettings?.progressBarHeight || 12}
            onChange={val => {
              const newLayoutSettings = {
                ...settings.layoutSettings,
                progressBarHeight: val,
              };
              handleChange('layoutSettings', newLayoutSettings);
            }}
            minLabel="细"
            maxLabel="粗"
            showTicks
          />
        </SettingRow>
        <SettingRow label="数据显示字体大小" isLast>
          <div className="flex h-0 items-center">
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
        </SettingRow>
      </SettingSection>

      <SettingSection title="方案列表设置">
        <SettingRow label="显示阶段分隔线">
          <SettingToggle
            checked={settings.layoutSettings?.showStageDivider || false}
            onChange={checked => {
              const newLayoutSettings = {
                ...settings.layoutSettings,
                showStageDivider: checked,
              };
              handleChange('layoutSettings', newLayoutSettings);
            }}
          />
        </SettingRow>
        <SettingRow label="简洁模式" isLast>
          <SettingToggle
            checked={settings.layoutSettings?.compactMode || false}
            onChange={checked => {
              const newLayoutSettings = {
                ...settings.layoutSettings,
                compactMode: checked,
              };
              handleChange('layoutSettings', newLayoutSettings);
            }}
          />
        </SettingRow>
      </SettingSection>
    </SettingPage>
  );
};

export default TimerSettings;
