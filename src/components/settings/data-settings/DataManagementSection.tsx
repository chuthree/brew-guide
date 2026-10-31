'use client';

import React, { useState, useRef } from 'react';
import { reloadApp } from '@/lib/app/reload';
import { DataManager as DataManagerUtil } from '@/lib/core/dataManager';
import { BackupReminderUtils } from '@/lib/utils/backupReminderUtils';
import { exportDataAsJsonFile } from '@/lib/utils/dataExportUtils';
import {
  recordCrashOperationComplete,
  recordCrashOperationStart,
  recordCrashOperationStep,
} from '@/lib/app/crashDiagnostics';
import {
  SettingSection,
  SettingRow,
  useScrollToHighlightedSetting,
} from '../atomic';
import { makeSettingRowSearchId } from '../settingsSearch';

interface DataManagementSectionProps {
  onDataChange?: () => void;
}

export const DataManagementSection: React.FC<DataManagementSectionProps> = ({
  onDataChange,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | 'info' | null;
    message: string;
    scope?: 'data' | 'image';
  }>({
    type: null,
    message: '',
  });
  const [isExporting, setIsExporting] = useState(false);
  const [preparedExportData, setPreparedExportData] = useState<string>();
  const [isRecompressing, setIsRecompressing] = useState(false);
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // 数据导出
  const handleExport = async () => {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    const operationId = recordCrashOperationStart('settings:data-export', {
      entry: 'settings:data-management',
      prepared: Boolean(preparedExportData),
    });
    try {
      const jsonData =
        preparedExportData ??
        (await DataManagerUtil.exportAllData({
          collectDiagnostics: true,
        }));
      if (!preparedExportData) {
        recordCrashOperationStep('data-export:before-save', {
          jsonLength: jsonData.length,
        });
      }
      const exportResult = await exportDataAsJsonFile(jsonData, {
        returnIncompleteResult: true,
      });
      recordCrashOperationComplete(
        {
          status: 'success',
          mode: exportResult.mode,
          jsonLength: jsonData.length,
        },
        operationId
      );

      if (
        exportResult.mode === 'activation-required' ||
        exportResult.mode === 'cancelled'
      ) {
        setPreparedExportData(jsonData);
        setStatus({
          type: 'info',
          message:
            exportResult.mode === 'activation-required'
              ? '数据已准备好，请再次点击导出数据'
              : '已取消导出，可再次点击导出数据',
        });
        return;
      }

      setPreparedExportData(undefined);
      if (exportResult.mode === 'native-share') {
        setStatus({
          type: 'success',
          message: '数据导出完成',
        });
      } else if (exportResult.mode === 'android-document') {
        setStatus({ type: 'success', message: '数据导出成功，文件已保存' });
      } else {
        setStatus({ type: 'success', message: '数据导出成功，文件已下载' });
      }

      try {
        await BackupReminderUtils.markBackupCompleted();
      } catch (error) {
        console.error('标记备份完成失败:', error);
      }
    } catch (_error) {
      recordCrashOperationComplete(
        {
          status: 'error',
          message: (_error as Error).message,
        },
        operationId
      );
      setStatus({
        type: 'error',
        message: `导出失败: ${(_error as Error).message}`,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 数据导入
  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = async event => {
        try {
          const jsonString = event.target?.result as string;

          const result = await DataManagerUtil.importAllData(jsonString);

          if (result.success) {
            reloadApp();
          } else {
            setStatus({ type: 'error', message: result.message });
          }
        } catch (_error) {
          setStatus({
            type: 'error',
            message: `导入失败: ${(_error as Error).message}`,
          });
        } finally {
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };

      reader.onerror = () => {
        setStatus({ type: 'error', message: '读取文件失败' });
      };

      reader.readAsText(file);
    } catch (_error) {
      setStatus({
        type: 'error',
        message: `导入失败: ${(_error as Error).message}`,
      });
    }
  };

  // 重置数据
  const handleReset = async () => {
    try {
      const result = await DataManagerUtil.resetAllData();

      if (result.success) {
        setStatus({ type: 'success', message: result.message });
        onDataChange?.();
        window.dispatchEvent(new CustomEvent('globalCacheReset'));
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setStatus({ type: 'error', message: result.message });
      }
    } catch (_error) {
      setStatus({
        type: 'error',
        message: `重置失败: ${(_error as Error).message}`,
      });
    } finally {
      setShowConfirmReset(false);
    }
  };

  const handleRecompressImages = async () => {
    if (isRecompressing) return;

    setIsRecompressing(true);
    setStatus({ type: 'info', message: '正在补压图片...', scope: 'image' });
    try {
      const { recompressOversizedAppImages } =
        await import('@/lib/images/recompressAppImages');
      const stats = await recompressOversizedAppImages();

      setStatus({
        type: stats.failedCount > 0 ? 'error' : 'success',
        scope: 'image',
        message:
          stats.failedCount > 0
            ? `补压完成，${stats.failedCount} 张失败`
            : stats.compressedCount > 0
              ? `已补压 ${stats.compressedCount} 张图片`
              : '没有需要补压的图片',
      });
    } catch (_error) {
      console.error('图片补压失败:', _error);
      setStatus({ type: 'error', message: '图片补压失败', scope: 'image' });
    } finally {
      setIsRecompressing(false);
    }
  };

  const highlightedSettingId = useScrollToHighlightedSetting(
    `${showConfirmReset}:${isExporting}:${isRecompressing}`
  );
  const [showImageOperations, setShowImageOperations] = useState(false);

  // 搜索高亮结束后保留入口，离开页面时随组件卸载重置。
  if (
    !showImageOperations &&
    highlightedSettingId === makeSettingRowSearchId('图片补压')
  ) {
    setShowImageOperations(true);
  }

  const buttonClass =
    'h-4 cursor-pointer text-sm leading-none font-medium text-neutral-600 active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300';
  const statusMessage = status.type ? (
    <p
      role={status.type === 'error' ? 'alert' : 'status'}
      className={`text-xs ${status.type === 'error' ? 'text-red-500 dark:text-red-400' : 'text-neutral-500 dark:text-neutral-400'}`}
    >
      {status.message}
    </p>
  ) : undefined;

  return (
    <>
      <div data-settings-search-id={makeSettingRowSearchId('数据管理')}>
        <SettingSection
          title="数据管理"
          footer={
            showConfirmReset
              ? '确认重置全部数据？此操作无法撤销，请先导出备份。'
              : status.scope !== 'image'
                ? statusMessage
                : undefined
          }
        >
          <SettingRow
            label={isExporting ? '导出中…' : '导出数据'}
            settingId={makeSettingRowSearchId('导出数据')}
            className="min-h-11"
            onClick={handleExport}
            disabled={isExporting}
          >
            {null}
          </SettingRow>
          <SettingRow
            label="导入数据"
            onClick={handleImportClick}
            className="min-h-11"
          >
            {null}
          </SettingRow>
          <SettingRow
            label="重置数据"
            className="min-h-11"
            onClick={
              showConfirmReset ? undefined : () => setShowConfirmReset(true)
            }
            isLast
          >
            {showConfirmReset ? (
              <div className="flex h-4 items-center gap-3">
                <button
                  type="button"
                  onClick={() => void handleReset()}
                  className="cursor-pointer text-sm leading-none font-medium text-red-500 active:opacity-70 dark:text-red-400"
                >
                  确认重置
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(false)}
                  className={buttonClass}
                >
                  取消
                </button>
              </div>
            ) : null}
          </SettingRow>
        </SettingSection>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        aria-label="导入数据文件"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />
      {showImageOperations && (
        <SettingSection
          title="数据操作"
          footer={status.scope === 'image' ? statusMessage : undefined}
        >
          <SettingRow
            label={isRecompressing ? '补压中…' : '图片补压'}
            settingId={makeSettingRowSearchId('图片补压')}
            className="min-h-11"
            onClick={handleRecompressImages}
            disabled={isRecompressing}
            isLast
          >
            {null}
          </SettingRow>
        </SettingSection>
      )}
    </>
  );
};
