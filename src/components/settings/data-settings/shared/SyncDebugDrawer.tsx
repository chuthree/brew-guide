/**
 * 同步调试日志抽屉组件
 *
 * S3、WebDAV 设置页及快捷同步共用的日志抽屉
 */

'use client';

import React, { useRef, useState } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import hapticsUtils from '@/lib/ui/haptics';

interface SyncDebugDrawerProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 关闭回调 */
  onClose: () => void;
  /** 日志内容 */
  logs: readonly string[];
  hapticFeedback: boolean;
  /** 标题 */
  title?: string;
}

export const SyncDebugDrawer: React.FC<SyncDebugDrawerProps> = ({
  isOpen,
  onClose,
  logs,
  hapticFeedback,
  title = '同步日志',
}) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [copiedLogs, setCopiedLogs] = useState<readonly string[] | null>(null);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(logs.join('\n'));
      setCopiedLogs(logs);
      if (hapticFeedback) hapticsUtils.light();
    } catch {
      textAreaRef.current?.select();
    }
  };

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
          onClick={() => textAreaRef.current?.select()}
          className="h-48 w-full resize-none rounded-md border border-neutral-200/50 bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-700 focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
        />
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        <ActionDrawer.SecondaryButton onClick={onClose}>
          关闭
        </ActionDrawer.SecondaryButton>
        <ActionDrawer.PrimaryButton onClick={onCopy}>
          {copiedLogs === logs ? '已复制' : '复制日志'}
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};
