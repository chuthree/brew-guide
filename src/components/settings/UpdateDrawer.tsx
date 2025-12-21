'use client';

import React from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import ArrowUpIcon from '@public/images/icons/ui/arrow-up.svg';

interface UpdateDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: string;
  latestVersion: string;
  downloadUrl: string;
  releaseNotes?: string;
  isAutoCheck?: boolean; // 是否为自动检测触发
  onPostpone?: () => void; // 点击"以后再说"的回调（7天后再提醒）
}

/**
 * 版本更新抽屉组件
 * 基于 ActionDrawer 构建，用于显示新版本信息并引导用户更新
 */
const UpdateDrawer: React.FC<UpdateDrawerProps> = ({
  isOpen,
  onClose,
  latestVersion,
  downloadUrl,
  releaseNotes,
  isAutoCheck = false,
  onPostpone,
}) => {
  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
  };

  const handleSecondaryClick = () => {
    if (isAutoCheck && onPostpone) {
      onPostpone();
    }
    onClose();
  };

  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="update-drawer">
      <ActionDrawer.Icon icon={ArrowUpIcon} />
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          发现新版本
          <span className="text-neutral-800 dark:text-neutral-200">
            {' '}
            v{latestVersion}
          </span>
          {releaseNotes ? (
            <>
              ，本次更新
              <span className="text-neutral-800 dark:text-neutral-200">
                {releaseNotes}
              </span>
              ，建议更新以获得最佳体验。
            </>
          ) : (
            <>，建议更新以获得最佳体验。</>
          )}
        </p>
      </ActionDrawer.Content>

      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={handleSecondaryClick}>
          {isAutoCheck ? '以后再说' : '稍后再说'}
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={handleDownload}>
          前往更新
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default UpdateDrawer;
