'use client';

import React, { ComponentType, SVGProps } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';

/**
 * 提示抽屉组件 Props
 */
export interface TipDrawerProps {
  /** 控制抽屉是否打开 */
  isOpen: boolean;
  /** 关闭抽屉的回调 */
  onClose: () => void;
  /**
   * SVG 图标组件
   * 使用 SVGR 导入的 SVG 文件会自动转换为 React 组件
   */
  icon: ComponentType<SVGProps<SVGElement>>;
  /** 图标尺寸，默认 128 */
  iconSize?: number;
  /** 提示内容 */
  children: React.ReactNode;
  /** 主要按钮文案 */
  primaryButtonText?: string;
  /** 主要按钮点击回调 */
  onPrimaryClick?: () => void;
  /** 次要按钮文案 */
  secondaryButtonText?: string;
  /** 次要按钮点击回调 */
  onSecondaryClick?: () => void;
  /**
   * 模态框历史栈 ID（用于返回键管理）
   * 如果不传则自动生成唯一 ID
   */
  historyId?: string;
  /**
   * 退出动画完成后的回调
   */
  onExitComplete?: () => void;
}

/**
 * 统一提示抽屉组件
 *
 * 基于 ActionDrawer 封装，用于显示各种提示信息。
 * 提供统一的样式和交互体验。
 *
 * ## 使用场景
 * - 功能引导提示
 * - 操作完成提示
 * - 新功能介绍
 * - 用户教育提示
 *
 * @example
 * ```tsx
 * import TipDrawer from '@/components/common/ui/TipDrawer';
 * import EmojiObjectsIcon from '@public/images/icons/ui/emoji-objects.svg';
 *
 * <TipDrawer
 *   isOpen={showTip}
 *   onClose={() => setShowTip(false)}
 *   icon={EmojiObjectsIcon}
 *   primaryButtonText="帮我开启"
 *   onPrimaryClick={handleEnable}
 *   secondaryButtonText="明白了"
 *   onSecondaryClick={() => setShowTip(false)}
 * >
 *   <p className="text-neutral-500 dark:text-neutral-400">
 *     这是一条提示信息
 *   </p>
 * </TipDrawer>
 * ```
 */
const TipDrawer: React.FC<TipDrawerProps> = ({
  isOpen,
  onClose,
  icon,
  iconSize = 128,
  children,
  primaryButtonText,
  onPrimaryClick,
  secondaryButtonText,
  onSecondaryClick,
  historyId,
  onExitComplete,
}) => {
  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId={historyId}
      onExitComplete={onExitComplete}
    >
      <ActionDrawer.Icon icon={icon} size={iconSize} />
      <ActionDrawer.Content>{children}</ActionDrawer.Content>
      <ActionDrawer.Actions>
        {secondaryButtonText && (
          <ActionDrawer.SecondaryButton onClick={onSecondaryClick || onClose}>
            {secondaryButtonText}
          </ActionDrawer.SecondaryButton>
        )}
        {primaryButtonText && (
          <ActionDrawer.PrimaryButton onClick={onPrimaryClick}>
            {primaryButtonText}
          </ActionDrawer.PrimaryButton>
        )}
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default TipDrawer;
