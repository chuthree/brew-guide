'use client';

import React from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';

interface CopyFailureDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onExitComplete?: () => void;
  content: string;
}

/**
 * 复制失败时显示的抽屉组件
 * 使用 ActionDrawer（基于 Vaul），自动支持嵌套抽屉。
 */
const CopyFailureDrawer: React.FC<CopyFailureDrawerProps> = ({
  isOpen,
  onClose,
  onExitComplete,
  content,
}) => {
  const handleClick = (e: React.MouseEvent<HTMLPreElement>) => {
    const range = document.createRange();
    range.selectNodeContents(e.currentTarget);
    window.getSelection()?.removeAllRanges();
    window.getSelection()?.addRange(range);
  };

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={onClose}
      onExitComplete={onExitComplete}
      historyId="copy-failure-drawer"
    >
      <ActionDrawer.Content>
        <p className="mb-4 text-neutral-500 dark:text-neutral-400">
          自动复制失败，请
          <span className="text-neutral-800 dark:text-neutral-200">
            点击下方文本
          </span>
          全选后手动复制
        </p>
        <pre
          onClick={handleClick}
          className="max-h-[40vh] overflow-auto rounded-lg bg-neutral-100 p-4 text-xs break-all whitespace-pre-wrap text-neutral-800 select-text dark:bg-neutral-800 dark:text-neutral-200"
        >
          {content}
        </pre>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose} className="w-full">
          关闭
        </ActionDrawer.SecondaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default CopyFailureDrawer;
