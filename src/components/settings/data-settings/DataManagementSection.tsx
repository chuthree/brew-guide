'use client';

import React, { useState, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { DataManager as DataManagerUtil } from '@/lib/core/dataManager';
import { BackupReminderUtils } from '@/lib/utils/backupReminderUtils';
import { exportDataAsJsonFile } from '@/lib/utils/dataExportUtils';
import {
  recordCrashOperationComplete,
  recordCrashOperationStart,
  recordCrashOperationStep,
} from '@/lib/app/crashDiagnostics';
import { useScrollToHighlightedSetting } from '../atomic';
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
    });
    try {
      const jsonData = await DataManagerUtil.exportAllData({
        collectDiagnostics: true,
      });
      recordCrashOperationStep('data-export:before-save', {
        jsonLength: jsonData.length,
      });
      const exportResult = await exportDataAsJsonFile(jsonData);
      recordCrashOperationComplete(
        {
          status: 'success',
          mode: exportResult.mode,
          jsonLength: jsonData.length,
        },
        operationId
      );

      if (exportResult.mode === 'native-share') {
        setStatus({
          type: 'success',
          message: '已打开系统分享，请选择保存位置或发送给其他应用',
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
            onDataChange?.();
            window.location.reload();
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

  const recompressImageLabel =
    isRecompressing || status.scope === 'image' ? status.message : '图片补压';
  const highlightedSettingId = useScrollToHighlightedSetting(
    `${showConfirmReset}:${isExporting}:${isRecompressing}`
  );
  const getSearchHighlightClass = React.useCallback(
    (label: string) =>
      highlightedSettingId === makeSettingRowSearchId(label)
        ? 'bg-neutral-200/70 dark:bg-neutral-700/45'
        : '',
    [highlightedSettingId]
  );

  return (
    <>
      <div
        data-settings-search-id={makeSettingRowSearchId('数据管理')}
        className={`px-6 py-4 transition-colors ${getSearchHighlightClass('数据管理')}`}
      >
        <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
          数据管理
        </h3>

        {status.type && status.scope !== 'image' && (
          <div
            className={`mb-4 rounded-md p-3 text-sm ${
              status.type === 'success'
                ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                : status.type === 'error'
                  ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                  : 'bg-blue-50 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
            }`}
          >
            {status.message}
          </div>
        )}

        <div className="space-y-3">
          <button
            type="button"
            data-settings-search-id={makeSettingRowSearchId('导出数据')}
            onClick={handleExport}
            disabled={isExporting}
            className={`flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 ${getSearchHighlightClass('导出数据')}`}
          >
            <span>{isExporting ? '导出中...' : '导出数据'}</span>
            <ChevronRight className="size-4 text-neutral-400" />
          </button>

          <div>
            <button
              type="button"
              data-settings-search-id={makeSettingRowSearchId('导入数据')}
              onClick={handleImportClick}
              className={`flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 ${getSearchHighlightClass('导入数据')}`}
            >
              <span>导入数据</span>
              <ChevronRight className="size-4 text-neutral-400" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              aria-label="导入数据文件"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {!showConfirmReset ? (
            <button
              type="button"
              data-settings-search-id={makeSettingRowSearchId('重置数据')}
              onClick={() => setShowConfirmReset(true)}
              className={`flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 ${getSearchHighlightClass('重置数据')}`}
            >
              <span>重置数据</span>
              <ChevronRight className="size-4 text-neutral-400" />
            </button>
          ) : (
            <div
              data-settings-search-id={makeSettingRowSearchId('重置数据')}
              className={`space-y-3 rounded bg-neutral-100 p-4 transition-colors dark:bg-neutral-800 ${getSearchHighlightClass('重置数据')}`}
            >
              <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                确认重置数据？此操作无法撤销
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 rounded bg-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                >
                  确认重置
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirmReset(false)}
                  className="flex-1 rounded bg-neutral-800 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-900 dark:bg-neutral-600 dark:hover:bg-neutral-500"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
          数据操作
        </h3>

        <button
          type="button"
          data-settings-search-id={makeSettingRowSearchId('图片补压')}
          onClick={handleRecompressImages}
          disabled={isRecompressing}
          className={`flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700 ${getSearchHighlightClass('图片补压')}`}
        >
          <span>{recompressImageLabel}</span>
          <ChevronRight className="size-4 text-neutral-400" />
        </button>
      </div>
    </>
  );
};
