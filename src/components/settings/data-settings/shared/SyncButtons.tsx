/**
 * 同步操作按钮组件
 *
 * 共享组件，用于 S3、WebDAV、Supabase 的上传/下载按钮
 */

'use client';

import React from 'react';
import { Upload, Download } from 'lucide-react';
import type { SyncProgress } from '@/lib/sync/types';

interface SyncButtonsProps {
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否正在同步 */
  isSyncing: boolean;
  /** 同步进度 */
  syncProgress: SyncProgress | null;
  /** 上传回调 */
  onUpload: () => void;
  /** 下载回调 */
  onDownload: () => void;
}

export const SyncButtons: React.FC<SyncButtonsProps> = ({
  isConnected,
  isSyncing,
  syncProgress,
  onUpload,
  onDownload,
}) => {
  if (!isConnected) {
    return null;
  }

  return (
    <div className="flex gap-2">
      {/* 同步进度显示 */}
      {isSyncing && syncProgress && (
        <div className="flex flex-1 items-center justify-center rounded-lg bg-neutral-100 px-3 py-2 dark:bg-neutral-800">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
              {syncProgress.phase}
            </span>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
              {syncProgress.message} ({syncProgress.percentage}%)
            </span>
          </div>
        </div>
      )}

      {/* 上传按钮 */}
      <button
        onClick={onUpload}
        disabled={isSyncing}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      >
        <Upload className="h-4 w-4" />
        <span>{isSyncing ? '同步中...' : '上传'}</span>
      </button>

      {/* 下载按钮 */}
      <button
        onClick={onDownload}
        disabled={isSyncing}
        className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700"
      >
        <Download className="h-4 w-4" />
        <span>{isSyncing ? '同步中...' : '下载'}</span>
      </button>
    </div>
  );
};
