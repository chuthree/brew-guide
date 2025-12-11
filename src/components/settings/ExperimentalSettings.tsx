'use client';

import React from 'react';

import { SettingsOptions } from './Settings';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
} from './atomic';

interface ExperimentalSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void;
}

const ExperimentalSettings: React.FC<ExperimentalSettingsProps> = ({
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
    id: 'experimental-settings',
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
    <SettingPage title="实验性功能" isVisible={isVisible} onClose={handleClose}>
      <SettingSection
        title="咖啡豆"
        footer="手动添加咖啡豆时，使用全屏且简洁的表单。"
      >
        <SettingRow label="沉浸式添加" isLast>
          <SettingToggle
            checked={settings.immersiveAdd || false}
            onChange={checked => handleChange('immersiveAdd', checked)}
          />
        </SettingRow>
      </SettingSection>
      <SettingSection
        title="笔记"
        footer="分享单个笔记时，将笔记转换为简洁的图片与文案，优化视觉效果以适配社交平台分享。"
      >
        <SettingRow label="图文分享" isLast>
          <SettingToggle
            checked={settings.artisticSharingEnabled ?? false}
            onChange={checked =>
              handleChange('artisticSharingEnabled', checked)
            }
          />
        </SettingRow>
      </SettingSection>
    </SettingPage>
  );
};

export default ExperimentalSettings;
