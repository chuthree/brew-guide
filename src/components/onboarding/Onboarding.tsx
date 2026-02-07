'use client';

import React, { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import {
  SettingsOptions,
  defaultSettings,
} from '@/components/settings/Settings';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { Lock, Layers, Share2 } from 'lucide-react';
import Image from 'next/image';
import { Capacitor } from '@capacitor/core';
import PersistentStorageManager, {
  isPersistentStorageSupported,
  isPWAMode,
} from '@/lib/utils/persistentStorage';
import { useSettingsStore } from '@/lib/stores/settingsStore';

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
  // 控制抽屉打开状态 - 直接打开，无需延迟
  const [isOpen, setIsOpen] = useState(true);

  // 使用 useThemeColor hook 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).__onboardingOpen = isOpen;
    window.dispatchEvent(
      new CustomEvent('onboarding-visibility', {
        detail: { open: isOpen },
      })
    );
  }, [isOpen]);

  // 持久化存储状态
  const [isPersisted, setIsPersisted] = useState(false);
  const [canRequestPersist, setCanRequestPersist] = useState(false);

  // 检测平台和持久化存储状态
  useEffect(() => {
    const checkPlatform = async () => {
      const isNative = Capacitor.isNativePlatform();

      if (!isNative) {
        const pwaMode = isPWAMode();

        if (pwaMode && isPersistentStorageSupported()) {
          setCanRequestPersist(true);
          try {
            const persisted = await PersistentStorageManager.checkPersisted();
            setIsPersisted(persisted);
          } catch (error) {
            console.error('检查持久化状态失败:', error);
          }
        }
      } else {
        // 原生应用默认已持久化
        setIsPersisted(true);
      }
    };

    checkPlatform();
  }, []);

  // 处理完成按钮点击
  const handleComplete = async () => {
    // 先关闭引导，避免存储/初始化异常导致界面卡住
    setIsOpen(false);
    onComplete();

    try {
      // 如果是 PWA 模式且支持持久化存储，先尝试请求
      if (canRequestPersist && !isPersisted) {
        // 不阻塞后续流程，避免请求挂起导致无法完成引导
        PersistentStorageManager.requestPersist().catch(error => {
          console.error('请求持久化存储失败:', error);
        });
      }

      // 动态导入 Storage
      const { Storage } = await import('@/lib/core/storage');
      // 标记引导已完成
      await Storage.set('onboardingCompleted', 'true');
      // 同步写入一次，避免异步存储异常
      Storage.setSync('onboardingCompleted', 'true');

      // 同步写入 IndexedDB 作为兜底（避免 localStorage 被清理）
      try {
        const { db } = await import('@/lib/core/db');
        await db.settings.put({ key: 'onboardingCompleted', value: 'true' });
      } catch (error) {
        console.error('写入引导完成状态到 IndexedDB 失败:', error);
      }

      // 使用 settingsStore 保存默认设置
      try {
        await useSettingsStore
          .getState()
          .importSettings(defaultSettings as any);
        // 通知上层组件设置已变更
        onSettingsChange(defaultSettings);
      } catch (error) {
        console.error('导入默认设置失败:', error);
      }
    } catch (error) {
      console.error('完成引导设置时发生错误:', error);
    }
  };

  return (
    <Drawer.Root open={isOpen} dismissible={false}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-3xl bg-white/95 backdrop-blur-xl dark:bg-neutral-900/95">
          <div className="pb-safe-bottom flex w-full flex-col gap-6 px-6 py-8">
            {/* Logo 和标题区域 */}
            <div className="flex flex-col items-start gap-6">
              {/* App Icon */}
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-[1.125rem]">
                <Image
                  src="/images/icons/app/icon-192x192.png"
                  alt="Brew Guide"
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              </div>

              {/* 标题 */}
              <Drawer.Title className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                欢迎使用 "Brew Guide"
              </Drawer.Title>
            </div>

            {/* 特性介绍 */}
            <div className="flex flex-col gap-5">
              {/* 特性 1 - 免费开源本地 */}
              <div className="flex items-start gap-4">
                <Lock className="mt-1.5 h-7 w-7 shrink-0 text-neutral-700 dark:text-neutral-300" />
                <div className="flex flex-col">
                  <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                    本地存储
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    完全免费且开源，所有数据存储在本地设备中，无需联网即可使用，你的隐私完全由自己掌控。
                  </p>
                </div>
              </div>

              {/* 特性 2 - 一站式管理 */}
              <div className="flex items-start gap-4">
                <Layers className="mt-1.5 h-7 w-7 shrink-0 text-neutral-700 dark:text-neutral-300" />
                <div className="flex flex-col">
                  <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                    一站管理
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    从辅助冲煮计时到豆仓库存管理，再到详细的品鉴笔记记录，一应俱全。
                  </p>
                </div>
              </div>

              {/* 特性 3 - 导入导出分享 */}
              <div className="flex items-start gap-4">
                <Share2 className="mt-1.5 h-7 w-7 shrink-0 text-neutral-700 dark:text-neutral-300" />
                <div className="flex flex-col">
                  <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">
                    轻松分享
                  </h3>
                  <p className="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                    支持数据导入导出，轻松分享你的冲煮方案与品鉴心得。
                  </p>
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <button
              onClick={handleComplete}
              className="mt-24 w-full rounded-full bg-neutral-800 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-neutral-700 active:scale-[0.98] dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              开始使用
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default Onboarding;
