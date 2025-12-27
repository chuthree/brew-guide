/**
 * 备份历史抽屉组件
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import type { BackupRecord } from '@/lib/s3/types';

interface BackupHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  backups: BackupRecord[];
  onRestore: (backupKey: string) => Promise<boolean>;
  isRestoring: boolean;
}

export const BackupHistoryDrawer: React.FC<BackupHistoryDrawerProps> = ({
  isOpen,
  onClose,
  backups,
  onRestore,
  isRestoring,
}) => {
  const [selectedBackup, setSelectedBackup] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  // 检测滚动位置
  const handleScroll = useCallback(() => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setShowTopShadow(scrollTop > 5);
    setShowBottomShadow(scrollTop < scrollHeight - clientHeight - 5);
  }, []);

  // 列表变化时检测是否需要显示底部阴影
  useEffect(() => {
    if (isOpen && backups.length > 3) {
      // 延迟检测，等待 DOM 更新
      setTimeout(handleScroll, 50);
    } else {
      setShowTopShadow(false);
      setShowBottomShadow(false);
    }
  }, [isOpen, backups.length, handleScroll]);

  const handleRestoreClick = (backupKey: string) => {
    setSelectedBackup(backupKey);
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackup) return;
    const success = await onRestore(selectedBackup);
    if (success) {
      setSelectedBackup(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setSelectedBackup(null);
  };

  const handleClose = () => {
    setSelectedBackup(null);
    onClose();
  };

  return (
    <ActionDrawer isOpen={isOpen} onClose={handleClose}>
      <ActionDrawer.Switcher activeKey={selectedBackup ? 'confirm' : 'list'}>
        {selectedBackup ? (
          <>
            <ActionDrawer.Content>
              <p className="text-neutral-500 dark:text-neutral-400">
                确定要恢复此备份吗？
              </p>
              <p className="text-neutral-500 dark:text-neutral-400">
                当前数据将被备份中的数据
                <span className="text-neutral-800 dark:text-neutral-200">
                  覆盖
                </span>
              </p>
            </ActionDrawer.Content>
            <ActionDrawer.Actions>
              <ActionDrawer.SecondaryButton onClick={handleCancel}>
                取消
              </ActionDrawer.SecondaryButton>
              <ActionDrawer.PrimaryButton
                onClick={handleConfirmRestore}
                disabled={isRestoring}
              >
                {isRestoring ? '恢复中...' : '确认恢复'}
              </ActionDrawer.PrimaryButton>
            </ActionDrawer.Actions>
          </>
        ) : (
          <>
            <ActionDrawer.Content>
              <p className="text-neutral-800 dark:text-neutral-200">备份历史</p>
              {backups.length === 0 ? (
                <p className="py-4 text-center text-neutral-500">
                  暂无备份记录
                </p>
              ) : (
                <div className="relative">
                  {/* 顶部渐变阴影 */}
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-linear-to-b from-white to-transparent transition-opacity duration-200 dark:from-neutral-900 ${showTopShadow ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {/* 底部渐变阴影 */}
                  <div
                    className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-linear-to-t from-white to-transparent transition-opacity duration-200 dark:from-neutral-900 ${showBottomShadow ? 'opacity-100' : 'opacity-0'}`}
                  />
                  <div
                    ref={listRef}
                    onScroll={handleScroll}
                    className="max-h-44 space-y-2 overflow-y-auto"
                  >
                    {[...backups].reverse().map((backup, index) => (
                      <div
                        key={backup.key}
                        className="flex items-center justify-between rounded-lg bg-neutral-100 p-3 dark:bg-neutral-800"
                      >
                        <div>
                          <div className="text-sm text-neutral-800 dark:text-neutral-200">
                            {formatDate(backup.timestamp)}
                          </div>
                          <div className="text-xs text-neutral-500">
                            {index === 0 ? '最新' : `${index + 1} 个版本前`}
                          </div>
                        </div>
                        <button
                          onClick={() => handleRestoreClick(backup.key)}
                          disabled={isRestoring}
                          className="flex items-center gap-1 rounded-md bg-neutral-200 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-neutral-300 disabled:opacity-50 dark:bg-neutral-700 dark:hover:bg-neutral-600"
                        >
                          <RotateCcw className="h-3 w-3" />
                          恢复
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="text-xs text-neutral-400">
                每次上传前自动备份，最多保留 5 个历史版本
              </p>
            </ActionDrawer.Content>
            <ActionDrawer.Actions>
              <ActionDrawer.SecondaryButton onClick={handleClose}>
                关闭
              </ActionDrawer.SecondaryButton>
            </ActionDrawer.Actions>
          </>
        )}
      </ActionDrawer.Switcher>
    </ActionDrawer>
  );
};
