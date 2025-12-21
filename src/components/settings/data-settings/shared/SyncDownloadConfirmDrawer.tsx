/**
 * 下载确认抽屉组件
 *
 * 共享组件，用于确认下载操作（会覆盖本地数据）
 */

'use client';

import React from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';

interface SyncDownloadConfirmDrawerProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 确认下载回调 */
  onConfirm: () => void;
  /** 服务名称 */
  serviceName?: string;
}

export const SyncDownloadConfirmDrawer: React.FC<
  SyncDownloadConfirmDrawerProps
> = ({ isOpen, onClose, onConfirm, serviceName = '云端' }) => {
  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="sync-download-confirm"
    >
      <ActionDrawer.Icon icon={DataAlertIcon} />
      <ActionDrawer.Content>
        <p className="mb-2 text-base font-medium text-neutral-800 dark:text-neutral-200">
          ⚠️ 数据覆盖警告
        </p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          从{serviceName}下载数据将覆盖本地所有数据，此操作不可撤销。
        </p>
        <p className="mt-2 text-sm font-medium text-red-500 dark:text-red-400">
          请确保您已备份重要数据！
        </p>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          取消
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton
          onClick={() => {
            onClose();
            onConfirm();
          }}
        >
          确认下载
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};
