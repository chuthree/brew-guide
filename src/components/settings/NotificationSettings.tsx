'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import hapticsUtils from '@/lib/ui/haptics';
import { showToast } from '@/components/common/feedback/LightToast';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
} from './atomic';

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
  const isAndroid = Capacitor.getPlatform() === 'android';

  // 格式化时间显示
  const formatTimeDisplay = (time: string) => {
    const [hour, minute] = time.split(':').map(Number);
    const period = hour >= 12 ? '下午' : '上午';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${period} ${displayHour}:${minute.toString().padStart(2, '0')}`;
  };

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

  // 调度每日提醒
  const scheduleDailyNotification = async (time: string): Promise<boolean> => {
    try {
      const [hour, minute] = time.split(':').map(Number);

      // 先取消旧的提醒 (ID: 1001)
      await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });

      // 计算下次触发时间
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hour, minute, 0, 0);

      // 如果今天的时间已经过了，安排到明天
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      // Android 和 iOS 使用不同的调度配置
      if (isAndroid) {
        // Android: 使用 smallIcon 并确保设置正确
        await LocalNotifications.schedule({
          notifications: [
            {
              title: '今天冲了吗？',
              body: '来杯咖啡提提神吧！☕️',
              id: 1001,
              schedule: {
                at: scheduledTime,
                every: 'day',
                allowWhileIdle: true,
              },
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor: '#737373',
              autoCancel: true,
            },
          ],
        });
      } else {
        // iOS: 标准配置
        await LocalNotifications.schedule({
          notifications: [
            {
              title: '今天冲了吗？',
              body: '来杯咖啡提提神吧！☕️',
              id: 1001,
              schedule: {
                at: scheduledTime,
                every: 'day',
                allowWhileIdle: true,
              },
            },
          ],
        });
      }

      console.log('已调度每日提醒:', scheduledTime.toLocaleString());
      return true;
    } catch (error) {
      console.error('调度通知失败:', error);
      return false;
    }
  };

  // 处理每日提醒开关
  const handleDailyReminderChange = async (checked: boolean) => {
    if (checked) {
      try {
        // 请求权限
        const permission = await LocalNotifications.requestPermissions();
        if (permission.display === 'granted') {
          // 调度通知
          const success = await scheduleDailyNotification(
            settings.dailyReminderTime
          );
          if (success) {
            handleChange('dailyReminder', true);
            showToast({
              type: 'success',
              title: `已设置每日 ${formatTimeDisplay(settings.dailyReminderTime)} 提醒`,
              duration: 2500,
            });
            if (settings.hapticFeedback) {
              hapticsUtils.light();
            }
          } else {
            showToast({
              type: 'error',
              title: '设置提醒失败，请重试',
              duration: 2000,
            });
          }
        } else {
          // 提示权限被拒绝
          showToast({
            type: 'error',
            title: '需要通知权限才能开启提醒',
            duration: 2000,
          });
        }
      } catch (error) {
        console.error('请求通知权限失败:', error);
        showToast({
          type: 'error',
          title: '开启提醒失败',
          duration: 2000,
        });
      }
    } else {
      handleChange('dailyReminder', false);
      // 取消通知
      try {
        await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
        showToast({
          type: 'success',
          title: '已关闭每日提醒',
          duration: 2000,
        });
        if (settings.hapticFeedback) {
          hapticsUtils.light();
        }
      } catch (error) {
        console.error('取消通知失败:', error);
      }
    }
  };

  // 处理时间变化
  const handleTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = e.target.value;
    handleChange('dailyReminderTime', time);
    if (settings.dailyReminder) {
      const success = await scheduleDailyNotification(time);
      if (success) {
        showToast({
          type: 'success',
          title: `提醒时间已更新为 ${formatTimeDisplay(time)}`,
          duration: 2500,
        });
      }
    }
    if (settings.hapticFeedback) {
      hapticsUtils.light();
    }
  };

  if (!shouldRender) return null;

  return (
    <SettingPage title="通知" isVisible={isVisible} onClose={handleClose}>
      {/* 通用设置 */}
      <SettingSection title="通用" className="-mt-4">
        <SettingRow label="提示音">
          <SettingToggle
            checked={settings.notificationSound}
            onChange={checked => handleChange('notificationSound', checked)}
          />
        </SettingRow>

        {/* 震动反馈 - 仅在原生应用中显示 */}
        {isNativeApp && (
          <SettingRow label="震动反馈">
            <SettingToggle
              checked={settings.hapticFeedback}
              onChange={checked => handleChange('hapticFeedback', checked)}
            />
          </SettingRow>
        )}
      </SettingSection>

      {/* 每日提醒 - 仅在原生应用中显示 */}
      {isNativeApp && (
        <SettingSection
          title="每日提醒"
          footer="开启后，将在设定时间提醒您冲一杯咖啡"
        >
          <SettingRow label="开启提醒">
            <SettingToggle
              checked={settings.dailyReminder}
              onChange={checked => handleDailyReminderChange(checked)}
            />
          </SettingRow>

          {settings.dailyReminder && (
            <SettingRow label="提醒时间">
              <input
                type="time"
                value={settings.dailyReminderTime}
                onChange={handleTimeChange}
                className="rounded bg-white px-2 py-1 text-sm font-medium text-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:outline-hidden dark:bg-neutral-700 dark:text-neutral-200"
              />
            </SettingRow>
          )}
        </SettingSection>
      )}
    </SettingPage>
  );
};

export default NotificationSettings;
