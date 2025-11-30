'use client';

import React from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import IosShareIcon from '@public/images/icons/ui/ios-share.svg';
import { CoffeeBean } from '@/types/app';

interface BeanShareModalProps {
  isOpen: boolean;
  bean: CoffeeBean | null;
  onClose: () => void;
  onTextShare?: (bean: CoffeeBean) => void;
}

/**
 * 咖啡豆分享抽屉组件
 * 基于 ActionDrawer 构建，用于将咖啡豆信息分享为文本
 */
const BeanShareModal: React.FC<BeanShareModalProps> = ({
  isOpen,
  bean,
  onClose,
  onTextShare,
}) => {
  // 处理文本分享
  const handleTextShare = () => {
    if (bean && onTextShare) {
      onTextShare(bean);
      onClose();
    }
  };

  if (!bean) return null;

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      historyId="bean-share"
    >
      <ActionDrawer.Icon icon={IosShareIcon} />
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          复制
          <span className="text-neutral-800 dark:text-neutral-200">
            「{bean.name}」
          </span>
          的信息，可分享给朋友或用于
          <span className="text-neutral-800 dark:text-neutral-200">
            「快速添加」
          </span>
          导入。
        </p>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          取消
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={handleTextShare}>
          复制为文本
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default BeanShareModal;
