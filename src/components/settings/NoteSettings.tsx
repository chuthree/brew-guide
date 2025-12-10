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

interface NoteSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void;
}

const NoteSettings: React.FC<NoteSettingsProps> = ({
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
    id: 'note-settings',
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
    <SettingPage title="笔记设置" isVisible={isVisible} onClose={handleClose}>
      <SettingSection title="表单显示" className="-mt-4">
        <SettingRow
          label="显示总体评分"
          description="添加笔记时显示总体评分滑块"
        >
          <SettingToggle
            checked={settings.showOverallRatingInForm ?? true}
            onChange={checked =>
              handleChange('showOverallRatingInForm', checked)
            }
          />
        </SettingRow>
        <SettingRow
          label="显示风味评分"
          description="添加笔记时显示风味评分区域"
          isLast
        >
          <SettingToggle
            checked={settings.showFlavorRatingInForm ?? true}
            onChange={checked =>
              handleChange('showFlavorRatingInForm', checked)
            }
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="默认行为">
        {(settings.showFlavorRatingInForm ?? true) && (
          <SettingRow
            label="默认展开风味评分"
            description="添加笔记时自动展开风味评分滑块"
          >
            <SettingToggle
              checked={settings.defaultExpandRating ?? false}
              onChange={checked => handleChange('defaultExpandRating', checked)}
            />
          </SettingRow>
        )}

        <SettingRow
          label="默认展开变动记录"
          description="在列表中自动显示库存变动详情"
          isLast
        >
          <SettingToggle
            checked={settings.defaultExpandChangeLog ?? false}
            onChange={checked =>
              handleChange('defaultExpandChangeLog', checked)
            }
          />
        </SettingRow>
      </SettingSection>
    </SettingPage>
  );
};

export default NoteSettings;
