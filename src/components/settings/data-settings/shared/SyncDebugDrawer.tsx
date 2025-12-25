/**
 * 同步调试日志抽屉组件
 *
 * 共享组件，用于 S3、WebDAV、Supabase 的调试日志显示
 */

'use client';

import React from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';

interface SyncDebugDrawerProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 日志内容 */
  logs: string[];
  /** 文本框引用 */
  textAreaRef: React.RefObject<HTMLTextAreaElement | null>;
  /** 是否复制成功 */
  copySuccess: boolean;
  /** 复制日志 */
  onCopy: () => void;
  /** 全选 */
  onSelectAll: () => void;
  /** 标题 */
  title?: string;
}

export const SyncDebugDrawer: React.FC<SyncDebugDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  textAreaRef,
  copySuccess,
  onCopy,
  onSelectAll,
  title = '同步日志',
}) => {
  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="sync-debug-logs">
      <ActionDrawer.Icon icon={DataAlertIcon} />
      <ActionDrawer.Content>
        <p className="mb-3 text-neutral-500 dark:text-neutral-400">
          {title} -
          <span className="text-neutral-800 dark:text-neutral-200">
            详细日志
          </span>
          ，可以帮助诊断问题。点击文本框可全选内容。
        </p>
        <textarea
          ref={textAreaRef}
          value={logs.join('\n')}
          readOnly
          onClick={onSelectAll}
          className="h-48 w-full resize-none rounded-md border border-neutral-200/50 bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700 focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        />
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          关闭
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={onCopy}>
          {copySuccess ? '已复制' : '复制日志'}
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};
