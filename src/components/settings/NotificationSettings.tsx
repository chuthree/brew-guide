'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import hapticsUtils from '@/lib/ui/haptics';
import { showToast } from '@/components/common/feedback/LightToast';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface NotificationSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({
  settings,
  onClose,
  handleChange,
}) => {
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

  // 开关组件
  const Switch = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: () => void;
  }) => (
    <label className="relative inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer sr-only"
      />
      <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
    </label>
  );

  if (!shouldRender) return null;

  return (
    <div
      className="fixed inset-0 mx-auto flex max-w-[500px] flex-col bg-neutral-50 dark:bg-neutral-900"
      style={getChildPageStyle(isVisible)}
    >
      {/* 头部导航栏 */}
      <div className="pt-safe-top relative flex items-center justify-center py-4">
        <button
          onClick={handleClose}
          className="absolute left-4 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 dark:text-neutral-300"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-md font-medium text-neutral-800 dark:text-neutral-200">
          通知设置
        </h2>
      </div>

      {/* 滚动内容区域 */}
      <div className="pb-safe-bottom relative flex-1 overflow-y-auto">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        {/* 通用设置 */}
        <div className="-mt-4 px-6 py-4">
          <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            通用
          </h3>
          <div className="space-y-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
            {/* 提示音 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                提示音
              </span>
              <Switch
                checked={settings.notificationSound}
                onChange={() =>
                  handleChange('notificationSound', !settings.notificationSound)
                }
              />
            </div>

            {/* 震动反馈 */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                震动反馈
              </span>
              <Switch
                checked={settings.hapticFeedback}
                onChange={() =>
                  handleChange('hapticFeedback', !settings.hapticFeedback)
                }
              />
            </div>
          </div>
        </div>

        {/* 每日提醒 - 仅在原生应用中显示 */}
        {isNativeApp && (
          <div className="px-6 py-4">
            <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
              每日提醒
            </h3>
            <div className="space-y-4 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                  开启提醒
                </span>
                <Switch
                  checked={settings.dailyReminder}
                  onChange={() =>
                    handleDailyReminderChange(!settings.dailyReminder)
                  }
                />
              </div>

              {settings.dailyReminder && (
                <div className="flex items-center justify-between border-t border-neutral-200 pt-4 dark:border-neutral-700">
                  <span className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                    提醒时间
                  </span>
                  <input
                    type="time"
                    value={settings.dailyReminderTime}
                    onChange={handleTimeChange}
                    className="rounded bg-white px-2 py-1 text-sm font-medium text-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:outline-hidden dark:bg-neutral-700 dark:text-neutral-200"
                  />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
              开启后，将在设定时间提醒您冲一杯咖啡
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationSettings;
