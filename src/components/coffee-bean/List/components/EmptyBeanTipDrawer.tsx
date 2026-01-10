'use client';

import React, { useCallback } from 'react';
import TipDrawer from '@/components/common/ui/TipDrawer';
import EmojiObjectsIcon from '@public/images/icons/ui/emoji-objects.svg';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { AlignLeft } from 'lucide-react';

/**
 * 用完咖啡豆提示抽屉 Props
 */
interface EmptyBeanTipDrawerProps {
  /** 控制抽屉是否打开 */
  isOpen: boolean;
  /** 关闭抽屉的回调 */
  onClose: () => void;
  /** 开启【包含已用完】筛选的回调 */
  onEnableShowEmptyBeans: () => void;
}

/**
 * 检查是否应该显示用完咖啡豆提示
 * 从 settingsStore 读取状态
 * @returns 如果应该显示返回 true，否则返回 false
 */
export const shouldShowEmptyBeanTip = (): boolean => {
  const settings = useSettingsStore.getState().settings;
  return settings.emptyBeanTipShown !== true;
};

/**
 * 标记用完咖啡豆提示已显示
 * 保存到 settingsStore，会随数据同步
 */
export const markEmptyBeanTipShown = async (): Promise<void> => {
  await useSettingsStore.getState().updateSettings({
    emptyBeanTipShown: true,
  });
};

/**
 * 用完咖啡豆提示抽屉组件
 *
 * 当用户第一次用完咖啡豆后显示，提示用户：
 * - 用完的咖啡豆被归档
 * - 可在咖啡豆分类栏点击筛选图标进入筛选
 * - 开启【包含已用完】查看已用完的咖啡豆
 *
 * 提供两个操作：
 * - 明白了：关闭提示
 * - 帮我开启：自动开启【包含已用完】筛选
 */
const EmptyBeanTipDrawer: React.FC<EmptyBeanTipDrawerProps> = ({
  isOpen,
  onClose,
  onEnableShowEmptyBeans,
}) => {
  /**
   * 处理"明白了"按钮点击
   */
  const handleUnderstand = useCallback(async () => {
    await markEmptyBeanTipShown();
    onClose();
  }, [onClose]);

  /**
   * 处理"帮我开启"按钮点击
   */
  const handleEnable = useCallback(async () => {
    await markEmptyBeanTipShown();
    onEnableShowEmptyBeans();
    onClose();
  }, [onEnableShowEmptyBeans, onClose]);

  return (
    <TipDrawer
      isOpen={isOpen}
      onClose={handleUnderstand}
      icon={EmojiObjectsIcon}
      historyId="empty-bean-tip"
      primaryButtonText="帮我开启"
      onPrimaryClick={handleEnable}
      secondaryButtonText="明白了"
      onSecondaryClick={handleUnderstand}
    >
      <p className="text-neutral-500 dark:text-neutral-400">
        用完的咖啡豆被归档，可在咖啡豆分类栏点击{' '}
        <span className="inline-flex items-center align-middle">
          <AlignLeft
            size={12}
            className="mx-0.5 inline-block text-neutral-800 dark:text-neutral-200"
          />
        </span>{' '}
        进入筛选，并开启
        <span className="text-neutral-800 dark:text-neutral-200">
          【包含已用完】
        </span>
        。
      </p>
    </TipDrawer>
  );
};

export default EmptyBeanTipDrawer;
