'use client';

import React from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataInfoAlertIcon from '@public/images/icons/ui/data-info-alert.svg';

export interface ConvertToGreenPreview {
  beanId: string;
  beanName: string;
  originalBean: { capacity: number; remaining: number };
  greenBean: { capacity: number; remaining: number };
  roastingAmount: number;
  newRoastedBean: { capacity: number; remaining: number };
  brewingNotesCount: number;
  noteUsageTotal: number;
  recordsToDeleteCount: number;
  directConvert?: boolean;
}

interface ConvertToGreenDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  preview: ConvertToGreenPreview | null;
  /** 退出动画完成后的回调，适合在此时机清理数据 */
  onExitComplete?: () => void;
}

/**
 * 转生豆确认抽屉组件
 * 基于 ActionDrawer 构建，用于熟豆转生豆操作的确认
 */
const ConvertToGreenDrawer: React.FC<ConvertToGreenDrawerProps> = ({
  isOpen,
  onClose,
  onConfirm,
  preview,
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
      historyId="convert-to-green-drawer"
      onExitComplete={onExitComplete}
    >
      <ActionDrawer.Icon icon={DataInfoAlertIcon} />
      <ActionDrawer.Content>
        {preview && (
          <p className="text-neutral-500 dark:text-neutral-400">
            {preview.directConvert ? (
              <>
                将
                <span className="text-neutral-800 dark:text-neutral-200">
                  「{preview.beanName}」
                </span>
                转换为生豆，原熟豆
                <span className="text-neutral-800 dark:text-neutral-200">
                  {' '}
                  {preview.originalBean.capacity}g{' '}
                </span>
                尚未使用，将直接转为
                <span className="text-neutral-800 dark:text-neutral-200">
                  {' '}
                  {preview.greenBean.capacity}g{' '}
                </span>
                生豆。
              </>
            ) : (
              <>
                将
                <span className="text-neutral-800 dark:text-neutral-200">
                  「{preview.beanName}」
                </span>
                转换为生豆，原熟豆
                <span className="text-neutral-800 dark:text-neutral-200">
                  {' '}
                  {preview.originalBean.capacity}g{' '}
                </span>
                总量、
                <span className="text-neutral-800 dark:text-neutral-200">
                  {preview.originalBean.remaining}g{' '}
                </span>
                剩余，将拆分为
                <span className="text-neutral-800 dark:text-neutral-200">
                  {' '}
                  {preview.greenBean.capacity}g{' '}
                </span>
                生豆和
                <span className="text-neutral-800 dark:text-neutral-200">
                  {' '}
                  {preview.newRoastedBean.capacity}g{' '}
                </span>
                新熟豆。
                {preview.brewingNotesCount > 0 && (
                  <>
                    届时将迁移
                    <span className="text-neutral-800 dark:text-neutral-200">
                      {' '}
                      {preview.brewingNotesCount}{' '}
                    </span>
                    条冲煮记录至新熟豆。
                  </>
                )}
                {preview.recordsToDeleteCount > 0 && (
                  <>
                    同时删除
                    <span className="text-neutral-800 dark:text-neutral-200">
                      {' '}
                      {preview.recordsToDeleteCount}{' '}
                    </span>
                    条变动记录。
                  </>
                )}
              </>
            )}
          </p>
        )}
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          取消
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={handleConfirm}>
          确认转换
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default ConvertToGreenDrawer;
