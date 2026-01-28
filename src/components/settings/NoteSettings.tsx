'use client';

import React from 'react';

import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
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
    <SettingPage title="笔记" isVisible={isVisible} onClose={handleClose}>
      <SettingSection title="列表" className="-mt-4">
        <SettingRow label="评分维度入口" isLast>
          <SettingToggle
            checked={settings.showRatingDimensionsEntry ?? false}
            onChange={checked =>
              handleChange('showRatingDimensionsEntry', checked)
            }
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="详情">
        <SettingRow label="价格" isLast>
          <SettingToggle
            checked={settings.showUnitPriceInNote ?? false}
            onChange={checked => handleChange('showUnitPriceInNote', checked)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="表单">
        <SettingRow label="总体评分">
          <SettingToggle
            checked={settings.showOverallRatingInForm ?? true}
            onChange={checked =>
              handleChange('showOverallRatingInForm', checked)
            }
          />
        </SettingRow>
        <SettingRow
          label="风味评分"
          isLast={!(settings.showFlavorRatingInForm ?? true)}
        >
          <SettingToggle
            checked={settings.showFlavorRatingInForm ?? true}
            onChange={checked =>
              handleChange('showFlavorRatingInForm', checked)
            }
          />
        </SettingRow>
        {(settings.showFlavorRatingInForm ?? true) && (
          <>
            <SettingRow label="初始值跟随总评" isSubSetting>
              <SettingToggle
                checked={settings.flavorRatingFollowOverall ?? false}
                onChange={checked =>
                  handleChange('flavorRatingFollowOverall', checked)
                }
              />
            </SettingRow>
            <SettingRow label="半分制" isSubSetting isLast>
              <SettingToggle
                checked={settings.flavorRatingHalfStep ?? false}
                onChange={checked =>
                  handleChange('flavorRatingHalfStep', checked)
                }
              />
            </SettingRow>
          </>
        )}
      </SettingSection>

      <SettingSection title="默认行为">
        {(settings.showFlavorRatingInForm ?? true) && (
          <SettingRow label="展开风味评分">
            <SettingToggle
              checked={settings.defaultExpandRating ?? false}
              onChange={checked => handleChange('defaultExpandRating', checked)}
            />
          </SettingRow>
        )}

        <SettingRow label="展开变动记录" isLast>
          <SettingToggle
            checked={settings.defaultExpandChangeLog ?? false}
            onChange={checked =>
              handleChange('defaultExpandChangeLog', checked)
            }
          />
        </SettingRow>
      </SettingSection>

      <SettingSection title="记录">
        <SettingRow label="容量调整记录" isLast>
          <SettingToggle
            checked={settings.showCapacityAdjustmentRecords ?? true}
            onChange={checked =>
              handleChange('showCapacityAdjustmentRecords', checked)
            }
          />
        </SettingRow>
      </SettingSection>
    </SettingPage>
  );
};

export default NoteSettings;
