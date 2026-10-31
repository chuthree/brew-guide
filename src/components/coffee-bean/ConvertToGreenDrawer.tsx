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
            <span className="text-neutral-800 dark:text-neutral-200">
              「{preview.beanName}」
            </span>
            {preview.directConvert ? (
              <>将转为生豆，重量不变，原熟豆会移除。</>
            ) : (
              <>
                剩余的 {preview.greenBean.remaining}g 记为生豆，已用的{' '}
                {preview.roastingAmount}g 记为同名熟豆。原熟豆会被替换。
                {preview.brewingNotesCount > 0 && '冲煮笔记会保留在新熟豆下。'}
              </>
            )}
            {preview.recordsToDeleteCount > 0 &&
              `原有的 ${preview.recordsToDeleteCount} 条用量变动记录会删除。`}
          </p>
        )}
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          取消
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={handleConfirm}>
          转为生豆
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default ConvertToGreenDrawer;
