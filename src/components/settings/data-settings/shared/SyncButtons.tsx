/** S3、WebDAV 共用的同步操作设置行。 */
'use client';

import React, { useState } from 'react';
import { SettingRow } from '../../atomic';
import { makeSettingRowSearchId } from '../../settingsSearch';
import { useSettingSearchHighlight } from '../../atomic/SettingSearchHighlightContext';

interface SyncButtonsProps {
  enabled?: boolean;
  isConnected: boolean;
  isSyncing: boolean;
  onSync: () => void;
  onUpload: () => void;
  onDownload: () => void;
  onShowBackups?: () => void;
  isLoadingBackups?: boolean;
  isLast?: boolean;
}

export const SyncButtons: React.FC<SyncButtonsProps> = ({
  enabled = true,
  isConnected,
  isSyncing,
  onSync,
  onUpload,
  onDownload,
  onShowBackups,
  isLoadingBackups = false,
  isLast = true,
}) => {
  const [syncDirection, setSyncDirection] = useState<
    'auto' | 'upload' | 'download' | null
  >(null);
  const { highlightedSettingId } = useSettingSearchHighlight();
  if (!enabled || !isConnected) return null;

  const isDisabled = isSyncing || isLoadingBackups;
  const actions = [
    {
      settingId: makeSettingRowSearchId('同步数据'),
      label: isSyncing && syncDirection === 'auto' ? '同步中…' : '同步数据',
      onClick: () => {
        setSyncDirection('auto');
        onSync();
      },
    },
    {
      settingId: makeSettingRowSearchId('上传数据'),
      label: isSyncing && syncDirection === 'upload' ? '上传中…' : '上传数据',
      onClick: () => {
        setSyncDirection('upload');
        onUpload();
      },
    },
    {
      settingId: makeSettingRowSearchId('下载数据'),
      label: isSyncing && syncDirection === 'download' ? '下载中…' : '下载数据',
      onClick: () => {
        setSyncDirection('download');
        onDownload();
      },
    },
    ...(onShowBackups
      ? [
          {
            settingId: makeSettingRowSearchId('备份历史'),
            label: isLoadingBackups ? '加载备份中…' : '备份历史',
            onClick: onShowBackups,
          },
        ]
      : []),
  ];

  return (
    <SettingRow
      vertical
      isLast={isLast}
      settingId={
        actions.find(action => action.settingId === highlightedSettingId)
          ?.settingId
      }
    >
      <div
        className={`grid h-4 ${onShowBackups ? 'grid-cols-4' : 'grid-cols-3'}`}
      >
        {actions.map(action => (
          <button
            key={action.settingId}
            type="button"
            data-settings-search-id={action.settingId}
            aria-label={action.label}
            disabled={isDisabled}
            onClick={action.onClick}
            className="relative -my-3.5 flex h-11 min-w-0 items-center justify-center px-2 text-sm leading-none font-medium text-neutral-800 before:absolute before:top-3.5 before:bottom-3.5 before:left-0 before:border-l before:border-black/5 first:before:hidden active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200 dark:before:border-white/5"
          >
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>
    </SettingRow>
  );
};
