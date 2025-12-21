/**
 * 同步配置头部按钮组件
 *
 * 共享组件，用于 S3、WebDAV、Supabase 的展开/收起按钮
 */

'use client';

import React from 'react';
import type { ConnectionStatus } from '@/lib/sync/types';

interface SyncHeaderButtonProps {
  /** 服务名称 */
  serviceName: string;
  /** 是否启用 */
  enabled: boolean;
  /** 当前状态 */
  status: ConnectionStatus;
  /** 是否展开 */
  expanded: boolean;
  /** 状态颜色 */
  statusColor: string;
  /** 状态文本 */
  statusText: string;
  /** 点击回调 */
  onClick: () => void;
}

export const SyncHeaderButton: React.FC<SyncHeaderButtonProps> = ({
  serviceName,
  statusColor,
  statusText,
  expanded,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
    >
      <div className="flex items-center gap-2">
        <div className={`h-2 w-2 rounded-full ${statusColor}`}></div>
        <span>{serviceName} 云同步配置</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {statusText}
        </span>
        <svg
          className={`h-4 w-4 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </button>
  );
};
