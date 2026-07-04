'use client';

import React, { useState, useCallback } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import {
  BackupReminderUtils,
  BackupReminderType,
} from '@/lib/utils/backupReminderUtils';
import { DataManager as DataManagerUtil } from '@/lib/core/dataManager';
import { exportDataAsJsonFile } from '@/lib/utils/dataExportUtils';
import BackupRestoreIcon from '@public/images/icons/ui/backup-restore.svg';

interface BackupReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminderType?: BackupReminderType | null;
}

const BackupReminderModal: React.FC<BackupReminderModalProps> = ({
  isOpen,
  onClose,
  reminderType = null,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [exportStatus, setExportStatus] = useState<
    'idle' | 'exporting' | 'success' | 'error'
  >('idle');
  const [exportMessage, setExportMessage] = useState('');

  const handleBackupNow = useCallback(async () => {
    setIsLoading(true);
    setExportStatus('exporting');
    setExportMessage('正在备份…');

    try {
      const jsonData = await DataManagerUtil.exportAllData();
      const exportResult = await exportDataAsJsonFile(jsonData);

      if (exportResult.mode === 'native-share') {
        setExportMessage('选一个位置保存，或分享给其他应用。');
      } else if (exportResult.mode === 'android-document') {
        setExportMessage('备份完成，文件已保存。');
      } else {
        setExportMessage('备份完成。');
      }

      // 标记备份完成
      await BackupReminderUtils.markBackupCompleted();

      setExportStatus('success');
    } catch (error) {
      console.error('导出失败:', error);
      setExportStatus('error');
      setExportMessage('备份没有成功，请再试一次。');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleRemindLater = useCallback(async () => {
    setIsLoading(true);
    try {
      await BackupReminderUtils.markReminderShown();
      onClose();
    } catch (error) {
      console.error('设置提醒失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [onClose]);

  const getReminderMessage = () => {
    switch (reminderType) {
      case 'hasDataNeverBackedUp':
        return '你已经留下了不少冲煮记录和咖啡豆信息，现在备份一下，更放心。';
      case 'firstTimeAfterDays':
        return '定期备份，无论换机还是重装，你的咖啡数据都还在。';
      case 'periodicReminder':
        return '距上次备份已经有一段时间了，现在备份一下吧。';
      default:
        return '定期备份，让你的咖啡数据始终安全。';
    }
  };

  const message = exportMessage || getReminderMessage();
  const primaryText =
    exportStatus === 'exporting'
      ? '备份中…'
      : exportStatus === 'success'
        ? '好'
        : exportStatus === 'error'
          ? '再试一次'
          : '现在备份';
  const handlePrimaryClick = useCallback(() => {
    if (exportStatus === 'success') {
      onClose();
      return;
    }

    void handleBackupNow();
  }, [exportStatus, handleBackupNow, onClose]);

  return (
    <ActionDrawer isOpen={isOpen} onClose={onClose} historyId="backup-reminder">
      <ActionDrawer.Icon icon={BackupRestoreIcon} />
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">{message}</p>
      </ActionDrawer.Content>
      <ActionDrawer.Actions>
        {exportStatus !== 'success' && (
          <ActionDrawer.SecondaryButton
            onClick={handleRemindLater}
            disabled={isLoading}
          >
            以后再说
          </ActionDrawer.SecondaryButton>
        )}
        <ActionDrawer.PrimaryButton
          onClick={handlePrimaryClick}
          disabled={isLoading && exportStatus !== 'success'}
        >
          {primaryText}
        </ActionDrawer.PrimaryButton>
      </ActionDrawer.Actions>
    </ActionDrawer>
  );
};

export default BackupReminderModal;
