'use client';

import React, { ComponentType, SVGProps } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DeleteIcon from '@public/images/icons/ui/delete.svg';

export interface ConfirmDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 确认消息内容 */
  message: React.ReactNode;
  /** 确认按钮文案 */
  confirmText?: string;
  /** 是否为危险操作（使用红色按钮） */
  isDanger?: boolean;
  /** 自定义图标 */
  icon?: ComponentType<SVGProps<SVGElement>>;
  /** 退出动画完成后的回调 */
  onExitComplete?: () => void;
}

/**
 * 通用确认抽屉组件
 */
const ConfirmDrawer: React.FC<ConfirmDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  message,
  confirmText = '确认',
  isDanger = false,
  icon: Icon = DeleteIcon,
  onExitComplete,
}) => {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="confirm-drawer"
      onExitComplete={onExitComplete}
    >
      <ActionDrawer.Icon icon={Icon} />
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">{message}</p>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          取消
        </ActionDrawer.SecondaryButton>
        {isDanger ? (
          <ActionDrawer.DangerButton onClick={handleConfirm}>
            {confirmText}
          </ActionDrawer.DangerButton>
        ) : (
          <ActionDrawer.PrimaryButton onClick={handleConfirm}>
            {confirmText}
          </ActionDrawer.PrimaryButton>
        )}
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default ConfirmDrawer;
