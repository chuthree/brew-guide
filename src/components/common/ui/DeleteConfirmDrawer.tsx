'use client';

import React from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DeleteIcon from '@public/images/icons/ui/delete.svg';

export interface DeleteConfirmDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  /** 要删除的项目名称 */
  itemName: string;
  /** 项目类型描述，如"咖啡豆"、"冲煮笔记"等 */
  itemType?: string;
  /** 额外的警告信息 */
  extraWarning?: string;
  /** 退出动画完成后的回调 */
  onExitComplete?: () => void;
}

/**
 * 统一删除确认抽屉组件
 * 用于咖啡豆、笔记、器具、方案等的删除确认
 */
const DeleteConfirmDrawer: React.FC<DeleteConfirmDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  itemName,
  itemType = '项目',
  extraWarning,
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
      historyId="delete-confirm-drawer"
      onExitComplete={onExitComplete}
    >
      <ActionDrawer.Icon icon={DeleteIcon} />
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          确认删除{itemType}
          <span className="text-neutral-800 dark:text-neutral-200">
            「{itemName}」
          </span>
          吗？此操作不可撤销。
          {extraWarning && (
            <>
              <br />
              <span className="text-neutral-800 dark:text-neutral-200">
                {extraWarning}
              </span>
            </>
          )}
        </p>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          取消
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.DangerButton onClick={handleConfirm}>
          确认删除
        </ActionDrawer.DangerButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default DeleteConfirmDrawer;
