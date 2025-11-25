'use client';

import React from 'react';
import { ChevronLeft, Bell, Clock, Send } from 'lucide-react';
import { SettingsOptions } from './Settings';
import { getChildPageStyle } from '@/lib/navigation/pageTransition';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

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

  // 历史栈管理
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    window.history.pushState({ modal: 'notification-settings' }, '');

    const handlePopState = () => onCloseRef.current();
    window.addEventListener('popstate', handlePopState);

    return () => window.removeEventListener('popstate', handlePopState);
  }, []); // 空依赖数组，确保只在挂载时执行一次

  // 关闭处理
  const handleClose = () => {
    // 立即触发退出动画
    setIsVisible(false);

    // 立即通知父组件子设置正在关闭
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));

    // 等待动画完成后再真正关闭
    setTimeout(() => {
      if (window.history.state?.modal === 'notification-settings') {
        window.history.back();
      } else {
        onClose();
      }
    }, 350); // 与 IOS_TRANSITION_CONFIG.duration 一致
  };

  // 控制动画状态
  const [shouldRender, setShouldRender] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);

  // 处理显示/隐藏动画
  React.useEffect(() => {
    setShouldRender(true);
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  // 调度每日提醒
  const scheduleDailyNotification = async (time: string) => {
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

      // 调度新的提醒 - 使用 at 指定具体时间，并设置为每天重复
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
            // 如果有关联声音设置，可以在这里处理
            // sound: settings.notificationSound ? undefined : null,
          },
        ],
      });

      console.log('已调度每日提醒:', scheduledTime.toLocaleString());
    } catch (error) {
      console.error('调度通知失败:', error);
    }
  };

  // 处理每日提醒开关
  const handleDailyReminderChange = async (checked: boolean) => {
    if (checked) {
      try {
        // 请求权限
        const permission = await LocalNotifications.requestPermissions();
        if (permission.display === 'granted') {
          handleChange('dailyReminder', true);
          // 调度通知
          await scheduleDailyNotification(settings.dailyReminderTime);
        } else {
          // 提示权限被拒绝
          const { showToast } = await import(
            '@/components/common/feedback/LightToast'
          );
          showToast({
            type: 'error',
            title: '需要通知权限才能开启提醒',
            duration: 2000,
          });
        }
      } catch (error) {
        console.error('请求通知权限失败:', error);
      }
    } else {
      handleChange('dailyReminder', false);
      // 取消通知
      try {
        await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
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
      await scheduleDailyNotification(time);
    }
  };

  // 测试推送
  const handleTestNotification = async () => {
    try {
      const permission = await LocalNotifications.requestPermissions();
      if (permission.display !== 'granted') {
        const { showToast } = await import(
          '@/components/common/feedback/LightToast'
        );
        showToast({
          type: 'error',
          title: '请先开启通知权限',
          duration: 2000,
        });
        return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            title: '测试提醒',
            body: '今天冲了吗？☕️ (这是一条测试消息)',
            id: 9999,
            schedule: { at: new Date(Date.now() + 1000 * 5) }, // 5秒后
          },
        ],
      });

      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      showToast({
        type: 'success',
        title: '测试通知将在5秒后发送',
        duration: 2000,
      });
    } catch (error) {
      console.error('发送测试通知失败:', error);
      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      showToast({
        type: 'error',
        title: '发送测试通知失败',
        duration: 2000,
      });
    }
  };

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
      <div className="pb-safe-bottom relative flex-1 divide-y divide-neutral-200 overflow-y-auto dark:divide-neutral-800">
        {/* 顶部渐变阴影 */}
        <div className="pointer-events-none sticky top-0 z-10 h-12 w-full bg-linear-to-b from-neutral-50 to-transparent first:border-b-0 dark:from-neutral-900"></div>

        {/* 设置内容 */}
        <div className="-mt-4 px-6 py-4">
          {/* 统一样式的设置项 */}
          <div className="space-y-5">
            {/* 提示音 */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                提示音
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.notificationSound}
                  onChange={e =>
                    handleChange('notificationSound', e.target.checked)
                  }
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 震动反馈 */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                震动反馈
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={settings.hapticFeedback}
                  onChange={e => {
                    handleChange('hapticFeedback', e.target.checked);
                  }}
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
              </label>
            </div>

            {/* 每日提醒 - 仅在原生应用中显示 */}
            {isNativeApp && (
              <>
                {/* 分隔线 */}
                <div className="border-t border-neutral-200 dark:border-neutral-800"></div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="h-4 w-4 text-neutral-500" />
                      <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                        每日提醒
                      </div>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={settings.dailyReminder}
                        onChange={e =>
                          handleDailyReminderChange(e.target.checked)
                        }
                        className="peer sr-only"
                      />
                      <div className="peer h-6 w-11 rounded-full bg-neutral-200 peer-checked:bg-neutral-600 after:absolute after:top-0.5 after:left-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full dark:bg-neutral-700 dark:peer-checked:bg-neutral-500"></div>
                    </label>
                  </div>

                  {settings.dailyReminder && (
                    <div className="animate-in fade-in slide-in-from-top-2 space-y-4 rounded-lg bg-neutral-100 p-4 duration-200 dark:bg-neutral-800">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                          <Clock className="h-4 w-4" />
                          <span>提醒时间</span>
                        </div>
                        <input
                          type="time"
                          value={settings.dailyReminderTime}
                          onChange={handleTimeChange}
                          className="rounded bg-white px-2 py-1 text-sm font-medium text-neutral-800 focus:ring-2 focus:ring-neutral-500 focus:outline-hidden dark:bg-neutral-700 dark:text-neutral-200"
                        />
                      </div>

                      <button
                        onClick={handleTestNotification}
                        className="flex w-full items-center justify-center gap-2 rounded bg-white py-2 text-sm font-medium text-neutral-800 shadow-xs transition-colors hover:bg-neutral-50 active:scale-95 dark:bg-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-600"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>发送测试通知 (5秒后)</span>
                      </button>
                      <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
                        测试通知将在点击后5秒发送，请退回桌面查看
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;
