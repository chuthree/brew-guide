'use client';

import React from 'react';
import {
  SettingsOptions,
  defaultSettings,
} from '@/components/settings/Settings';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { Lock, Layers, Share2 } from 'lucide-react';
import Image from 'next/image';

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
  // 使用半透明叠加层颜色同步顶部安全区
  useThemeColor({ useOverlay: true, enabled: true });

  // 处理完成按钮点击
  const handleComplete = async () => {
    try {
      // 动态导入 Storage
      const { Storage } = await import('@/lib/core/storage');
      // 标记引导已完成
      await Storage.set('onboardingCompleted', 'true');
      // 保存默认设置
      await Storage.set('brewGuideSettings', JSON.stringify(defaultSettings));

      // 通知上层组件设置已变更
      onSettingsChange(defaultSettings);
      // 调用完成回调
      onComplete();
    } catch (error) {
      console.error('完成引导设置时发生错误:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* 半透明背景 */}
      <div className="absolute inset-0 bg-black/50" />

      {/* 设置内容卡片 */}
      <div className="pb-safe-bottom relative flex w-full flex-col gap-6 rounded-t-3xl bg-white/95 px-6 py-8 shadow-2xl backdrop-blur-xl dark:bg-neutral-900/95">
        {/* Logo 和标题区域 */}
        <div className="flex flex-col items-start gap-6">
          {/* App Icon */}
          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-[1.125rem]">
            <Image
              src="/images/icons/app/icon-192x192.png"
              alt="Brew Guide"
              width={64}
              height={64}
              className="h-full w-full object-cover"
            />
          </div>

          {/* 标题 */}
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
            欢迎使用 “Brew Guide”
          </h1>
        </div>

        {/* 特性介绍 */}
        <div className="flex flex-col gap-5">
          {/* 特性 1 - 免费开源本地 */}
          <div className="flex items-start gap-4">
            <Lock className="mt-1.5 h-7 w-7 flex-shrink-0 text-neutral-700 dark:text-neutral-300" />
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
            <Layers className="mt-1.5 h-7 w-7 flex-shrink-0 text-neutral-700 dark:text-neutral-300" />
            <div className="gap- flex flex-col">
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
            <Share2 className="mt-1.5 h-7 w-7 flex-shrink-0 text-neutral-700 dark:text-neutral-300" />
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
    </div>
  );
};

export default Onboarding;
