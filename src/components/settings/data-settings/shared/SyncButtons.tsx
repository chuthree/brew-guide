/**
 * 同步操作按钮组件
 *
 * 共享组件，用于 S3、WebDAV、Supabase 的上传/下载按钮
 * 同步时显示动态点数动画
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Upload, Download } from 'lucide-react';

interface SyncButtonsProps {
  /** 是否已启用 */
  enabled?: boolean;
  /** 是否已连接 */
  isConnected: boolean;
  /** 是否正在同步 */
  isSyncing: boolean;
  /** 上传回调 */
  onUpload: () => void;
  /** 下载回调 */
  onDownload: () => void;
}

/** 动态点数组件 */
const AnimatedDots: React.FC = () => {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <span className="inline-block w-4 text-left">{'.'.repeat(dotCount)}</span>
  );
};

export const SyncButtons: React.FC<SyncButtonsProps> = ({
  enabled = true,
  isConnected,
  isSyncing,
  onUpload,
  onDownload,
}) => {
  // 记录当前同步方向
  const [syncDirection, setSyncDirection] = useState<
    'upload' | 'download' | null
  >(null);

  const handleUpload = () => {
    setSyncDirection('upload');
    onUpload();
  };

  const handleDownload = () => {
    setSyncDirection('download');
    onDownload();
  };

  // 同步结束后重置方向
  useEffect(() => {
    if (!isSyncing) {
      setSyncDirection(null);
    }
  }, [isSyncing]);

  if (!enabled || !isConnected) {
    return null;
  }

  const isUploading = isSyncing && syncDirection === 'upload';
  const isDownloading = isSyncing && syncDirection === 'download';

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* 上传按钮 */}
      <button
        onClick={handleUpload}
        disabled={isSyncing}
        className={`flex items-center justify-center gap-2 rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 ${isSyncing ? 'opacity-60' : ''}`}
      >
        <Upload className={`h-4 w-4 ${isUploading ? 'animate-pulse' : ''}`} />
        <span>
          {isUploading ? (
            <>
              上传中
              <AnimatedDots />
            </>
          ) : (
            '上传'
          )}
        </span>
      </button>

      {/* 下载按钮 */}
      <button
        onClick={handleDownload}
        disabled={isSyncing}
        className={`flex items-center justify-center gap-2 rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 ${isSyncing ? 'opacity-60' : ''}`}
      >
        <Download
          className={`h-4 w-4 ${isDownloading ? 'animate-pulse' : ''}`}
        />
        <span>
          {isDownloading ? (
            <>
              下载中
              <AnimatedDots />
            </>
          ) : (
            '下载'
          )}
        </span>
      </button>
    </div>
  );
};
