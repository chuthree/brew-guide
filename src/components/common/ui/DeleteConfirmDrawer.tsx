'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DeleteIcon from '@public/images/icons/ui/delete.svg';
import DataInfoAlertIcon from '@public/images/icons/ui/data-info-alert.svg';

export interface DeleteConfirmDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | string | Promise<void | string>;
  /** 要删除的项目名称 */
  itemName: string;
  /** 区分同名记录，切换目标时重置操作状态 */
  itemId?: string;
  /** 项目类型描述，如"咖啡豆"、"冲煮笔记"等 */
  itemType?: string;
  /** 项目名称后缀，如"的快捷扣除记录"，用于特殊记录类型 */
  itemSuffix?: string;
  /** 额外的警告信息 */
  extraWarning?: string;
  actionLabel?: string;
  renderConfirmation?: (itemName: React.ReactNode) => React.ReactNode;
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
  itemId,
  itemType = '项目',
  itemSuffix,
  extraWarning,
  actionLabel = '删除',
  renderConfirmation,
  onExitComplete,
}) => {
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [presentation, setPresentation] = useState(0);
  const pendingRef = useRef(false);
  const sessionRef = useRef(0);
  const openRef = useRef(isOpen);
  const highlightedName = (
    <span className="text-neutral-800 dark:text-neutral-200">
      「{itemName}」
    </span>
  );

  useLayoutEffect(() => {
    openRef.current = isOpen;
    sessionRef.current += 1;
    if (isOpen) {
      setPresentation(sessionRef.current);
      setBlockedReason(null);
      setPending(false);
      pendingRef.current = false;
    }
    return () => {
      sessionRef.current += 1;
    };
  }, [isOpen, itemId, itemName]);

  const handleConfirm = async () => {
    if (pendingRef.current) return;
    const session = sessionRef.current;
    pendingRef.current = true;
    setPending(true);
    setBlockedReason(null);
    try {
      const reason = await onConfirm();
      if (session !== sessionRef.current) return;
      if (reason) setBlockedReason(reason);
      else onClose();
    } catch (error) {
      if (session !== sessionRef.current) return;
      setBlockedReason(
        error instanceof Error ? error.message : '操作未完成，请稍后重试'
      );
    } finally {
      if (session === sessionRef.current) {
        pendingRef.current = false;
        setPending(false);
      }
    }
  };

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="delete-confirm-drawer"
      dismissible={!pending}
      onExitComplete={() => {
        if (!openRef.current) onExitComplete?.();
      }}
    >
      <ActionDrawer.Switcher
        key={presentation}
        activeKey={blockedReason ? 'blocked' : 'confirm'}
      >
        <ActionDrawer.Icon
          icon={blockedReason ? DataInfoAlertIcon : DeleteIcon}
        />
        <ActionDrawer.Content>
          {blockedReason ? (
            <div role="status">
              <p className="mb-2 font-medium text-neutral-800 dark:text-neutral-200">
                无法{actionLabel}
              </p>
              <p className="text-neutral-500 dark:text-neutral-400">
                {blockedReason}
              </p>
            </div>
          ) : (
            <p className="text-neutral-500 dark:text-neutral-400">
              {renderConfirmation ? (
                renderConfirmation(highlightedName)
              ) : (
                <>
                  确认{actionLabel}
                  {itemType}
                  {highlightedName}
                  {itemSuffix}吗？
                </>
              )}
              {extraWarning || '此操作不可撤销。'}
            </p>
          )}
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          {blockedReason ? (
            <ActionDrawer.PrimaryButton onClick={onClose}>
              好的
            </ActionDrawer.PrimaryButton>
          ) : (
            <>
              <ActionDrawer.SecondaryButton
                onClick={onClose}
                disabled={pending}
              >
                取消
              </ActionDrawer.SecondaryButton>
              <ActionDrawer.DangerButton
                onClick={handleConfirm}
                disabled={pending}
              >
                {pending ? '处理中…' : `确认${actionLabel}`}
              </ActionDrawer.DangerButton>
            </>
          )}
        </ActionDrawer.Actions>
      </ActionDrawer.Switcher>
    </ActionDrawer>
  );
};

export default DeleteConfirmDrawer;
