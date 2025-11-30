'use client';

import React, { useState, useEffect, ComponentType, SVGProps } from 'react';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

export interface ActionDrawerProps {
  /** 控制抽屉是否打开 */
  isOpen: boolean;
  /** 关闭抽屉的回调 */
  onClose: () => void;
  /** 抽屉内容 */
  children: React.ReactNode;
  /**
   * 模态框历史栈 ID（用于返回键管理）
   * 如果不传则自动生成唯一 ID
   */
  historyId?: string;
  /**
   * 退出动画完成后的回调
   * 适合在此时机清理数据，避免内容在动画播放时突然消失
   */
  onExitComplete?: () => void;
}

export interface ActionDrawerIconProps {
  /**
   * SVG 图标组件
   * 使用 SVGR 导入的 SVG 文件会自动转换为 React 组件
   * @example
   * import AlertIcon from '@/public/images/icons/ui/alert.svg';
   * <ActionDrawer.Icon icon={AlertIcon} />
   */
  icon: ComponentType<SVGProps<SVGElement>>;
  /** 图标尺寸，默认 128 */
  size?: number;
}

export interface ActionDrawerContentProps {
  children: React.ReactNode;
  className?: string;
}

export interface ActionDrawerActionsProps {
  children: React.ReactNode;
  className?: string;
}

export interface ActionDrawerButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

/**
 * 通用操作抽屉组件
 *
 * 采用复合组件模式，支持灵活的内容布局：
 * - ActionDrawer.Icon - 顶部图标区域
 * - ActionDrawer.Content - 中间内容区域
 * - ActionDrawer.Actions - 底部操作按钮区域
 *
 * ## 间距规范（基于 8px 网格）
 *
 * - 圆角：24px (rounded-t-3xl)
 * - 内容区内边距：上 32px，左右 24px，下 24px
 * - 图标上边距：8px，下边距：24px
 * - 内容区与按钮间距：32px (mb-8)
 * - 按钮间距：12px (gap-3)
 *
 * ## 内容规范
 *
 * 1. **纯文本自然排版**：内容区域只使用 `<p>` 段落，不使用 h1-h6 等标题标签
 * 2. **透明度差异化**：通过文字颜色区分信息层级
 *    - 普通文案：`text-neutral-500 dark:text-neutral-400`
 *    - 强调内容：`text-neutral-800 dark:text-neutral-200`
 * 3. **按钮样式**：统一使用 `py-3 rounded-full text-sm font-medium` 基础样式
 *
 * @example
 * ```tsx
 * <ActionDrawer isOpen={isOpen} onClose={onClose}>
 *   <ActionDrawer.Icon icon={AlertIcon} />
 *   <ActionDrawer.Content>
 *     <p className="text-neutral-500 dark:text-neutral-400">
 *       确认要删除
 *       <span className="text-neutral-800 dark:text-neutral-200">「文件名」</span>
 *       吗？此操作不可撤销。
 *     </p>
 *   </ActionDrawer.Content>
 *   <ActionDrawer.Actions>
 *     <button className="flex-1 rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
 *       取消
 *     </button>
 *     <button className="flex-1 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
 *       确认
 *     </button>
 *   </ActionDrawer.Actions>
 * </ActionDrawer>
 * ```
 */
const ActionDrawer: React.FC<ActionDrawerProps> & {
  Icon: React.FC<ActionDrawerIconProps>;
  Content: React.FC<ActionDrawerContentProps>;
  Actions: React.FC<ActionDrawerActionsProps>;
  PrimaryButton: React.FC<ActionDrawerButtonProps>;
  SecondaryButton: React.FC<ActionDrawerButtonProps>;
  DangerButton: React.FC<ActionDrawerButtonProps>;
} = ({ isOpen, onClose, children, historyId, onExitComplete }) => {
  // 生成稳定的唯一 ID（如果未提供 historyId）
  const [autoId] = useState(
    () =>
      `action-drawer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  );
  const modalId = historyId || autoId;

  // 动画状态管理（与 EquipmentManagementDrawer 保持一致）
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  // 集成历史栈管理，支持返回键关闭
  useModalHistory({
    id: modalId,
    isOpen,
    onClose,
  });

  // 处理显示/隐藏动画
  // 动画时长：350ms，与 CSS transition 保持一致
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      // 延迟触发动画，确保 DOM 已渲染
      const timer = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
      // 等待退出动画完成后卸载组件并触发回调
      const timer = setTimeout(() => {
        setShouldRender(false);
        onExitComplete?.();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isOpen, onExitComplete]);

  if (!shouldRender) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* 抽屉内容 */}
      <div
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[500px] rounded-t-3xl bg-white transition-transform duration-[350ms] ease-[cubic-bezier(0.36,0.66,0.04,1)] dark:bg-neutral-900 ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* 内容区域 */}
        <div className="flex flex-col px-6 pt-8 pb-6">{children}</div>
      </div>
    </>
  );
};

/**
 * 抽屉图标组件
 *
 * 图标规范：
 * - 使用 SVGR 导入的 SVG 作为 React 组件
 * - 统一中性色：浅色模式黑色，深色模式白色
 * - 默认尺寸 128px
 *
 * @example
 * import AlertIcon from '@public/images/icons/ui/alert.svg';
 * <ActionDrawer.Icon icon={AlertIcon} />
 */
const ActionDrawerIcon: React.FC<ActionDrawerIconProps> = ({
  icon: Icon,
  size = 128,
}) => (
  <div className="mb-6 text-neutral-800 dark:text-neutral-200">
    <Icon width={size} height={size} />
  </div>
);

/**
 * 抽屉内容区域组件
 *
 * 内容规范：
 * - 使用自然排版的纯文本格式（`<p>` 段落）
 * - 普通文案：`text-neutral-500 dark:text-neutral-400`
 * - 强调内容：`text-neutral-800 dark:text-neutral-200`
 */
const ActionDrawerContent: React.FC<ActionDrawerContentProps> = ({
  children,
  className = '',
}) => (
  <div className={`mb-8 space-y-3 text-sm leading-relaxed ${className}`}>
    {children}
  </div>
);

/**
 * 抽屉操作按钮区域组件
 *
 * 按钮样式规范：
 * - 基础样式：`rounded-full px-4 py-3 text-sm font-medium`
 * - 次要按钮：`bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300`
 * - 主要按钮：`bg-neutral-900 text-white dark:bg-white dark:text-neutral-900`
 * - 危险按钮：`bg-red-500 text-white dark:bg-red-600`
 * - 交互反馈：`transition-transform active:scale-[0.98]`
 */
const ActionDrawerActions: React.FC<ActionDrawerActionsProps> = ({
  children,
  className = '',
}) => <div className={`flex gap-3 ${className}`}>{children}</div>;

/** 按钮基础样式 */
const buttonBaseClass =
  'flex-1 rounded-full px-4 py-3 text-sm font-medium transition-transform active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100';

/**
 * 主要按钮组件
 *
 * 用于主要操作，如「确认」「提交」「更新」等
 * - 浅色模式：深色背景，白色文字
 * - 深色模式：白色背景，深色文字
 */
const ActionDrawerPrimaryButton: React.FC<ActionDrawerButtonProps> = ({
  children,
  onClick,
  className = '',
  disabled = false,
  type = 'button',
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`${buttonBaseClass} bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 ${className}`}
  >
    {children}
  </button>
);

/**
 * 次要按钮组件
 *
 * 用于次要操作，如「取消」「稍后再说」「关闭」等
 * - 浅色模式：浅灰背景，深色文字
 * - 深色模式：深灰背景，浅色文字
 */
const ActionDrawerSecondaryButton: React.FC<ActionDrawerButtonProps> = ({
  children,
  onClick,
  className = '',
  disabled = false,
  type = 'button',
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`${buttonBaseClass} bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 ${className}`}
  >
    {children}
  </button>
);

/**
 * 危险按钮组件
 *
 * 用于危险/破坏性操作，如「删除」「清空」等
 * - 红色背景，白色文字
 */
const ActionDrawerDangerButton: React.FC<ActionDrawerButtonProps> = ({
  children,
  onClick,
  className = '',
  disabled = false,
  type = 'button',
}) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`${buttonBaseClass} bg-red-500 text-white dark:bg-red-600 ${className}`}
  >
    {children}
  </button>
);

// 绑定子组件
ActionDrawer.Icon = ActionDrawerIcon;
ActionDrawer.Content = ActionDrawerContent;
ActionDrawer.Actions = ActionDrawerActions;
ActionDrawer.PrimaryButton = ActionDrawerPrimaryButton;
ActionDrawer.SecondaryButton = ActionDrawerSecondaryButton;
ActionDrawer.DangerButton = ActionDrawerDangerButton;

export default ActionDrawer;
