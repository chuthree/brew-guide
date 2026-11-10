/**
 * 同步配置头部按钮组件
 *
 * 共享组件，用于 S3、WebDAV、Supabase 的展开/收起按钮
 */

'use client';

import React from 'react';
import { SettingRow } from '../../atomic';
import { ChevronRight } from 'lucide-react';
import type { ConnectionStatus } from '@/lib/sync/types';

interface SyncHeaderButtonProps {
  /** 服务名称 */
  serviceName: string;
  isLast?: boolean;
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
  isLast = true,
  statusColor,
  statusText,
  expanded,
  onClick,
}) => {
  return (
    <SettingRow vertical isLast={isLast}>
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        className="setting-control flex w-full min-w-0 items-center justify-between gap-3 text-left active:opacity-70"
      >
        <span className="truncate-label text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
          {serviceName} 配置
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden="true"
            className={`size-1.5 shrink-0 rounded-full ${statusColor}`}
          />
          <span className="text-sm leading-none font-normal text-neutral-600 dark:text-neutral-300">
            {statusText}
          </span>
          <ChevronRight
            className={`size-4 text-neutral-400 transition-transform dark:text-neutral-500 ${expanded ? 'rotate-90' : ''}`}
          />
        </span>
      </button>
    </SettingRow>
  );
};
