'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { Capacitor } from '@capacitor/core';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { deriveNavigationSettings } from '@/lib/navigation/navigationSettings';
import { getNotificationSettingsVisibility } from './notificationSettingsVisibility';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
} from './atomic';
import { canUseNativeCalendar } from '@/lib/calendarSync/nativeCalendar';
import { normalizeCalendarSyncSettings } from '@/lib/calendarSync/settings';

interface NotificationSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const navigationState = deriveNavigationSettings(settings.navigationSettings);
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

  // 检测是否为原生应用
  const isNativeApp = Capacitor.isNativePlatform();
  const {
    showBrewingNotificationSound,
    showCoffeeBeanNotifications,
    showGeneralNotificationSection,
  } = getNotificationSettingsVisibility({
    isNativeApp,
    visibleModules: navigationState.visibleTabs,
  });
  const calendarSyncSupported = canUseNativeCalendar();
  const calendarSync = normalizeCalendarSyncSettings(settings.calendarSync);

  const handleCalendarSyncChange = React.useCallback(
    (checked: boolean) => {
      handleChange('calendarSync', {
        ...calendarSync,
        enabled: checked,
      });
    },
    [calendarSync, handleChange]
  );

  // 控制动画状态
  const [isVisible, setIsVisible] = React.useState(false);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
    id: 'notification-settings',
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

  return (
    <SettingPage title="通知" isVisible={isVisible} onClose={handleClose}>
      {showGeneralNotificationSection && (
        <SettingSection title="通用" className="-mt-4">
          {showBrewingNotificationSound && (
            <SettingRow label="提示音" isLast={!isNativeApp}>
              <SettingToggle
                checked={settings.notificationSound}
                onChange={checked => handleChange('notificationSound', checked)}
              />
            </SettingRow>
          )}

          {isNativeApp && (
            <SettingRow label="震动反馈" isLast>
              <SettingToggle
                checked={settings.hapticFeedback}
                onChange={checked => handleChange('hapticFeedback', checked)}
              />
            </SettingRow>
          )}
        </SettingSection>
      )}

      {showCoffeeBeanNotifications && (
        <SettingSection title="咖啡豆">
          <SettingRow label="提醒弹窗" isLast={!calendarSyncSupported}>
            <SettingToggle
              checked={settings.showBeanReadyReminderPopup}
              onChange={checked =>
                handleChange('showBeanReadyReminderPopup', checked)
              }
            />
          </SettingRow>
          {calendarSyncSupported && (
            <SettingRow label="同步日历" isLast>
              <SettingToggle
                checked={calendarSync.enabled}
                onChange={handleCalendarSyncChange}
              />
            </SettingRow>
          )}
        </SettingSection>
      )}
    </SettingPage>
  );
};

export default NotificationSettings;
