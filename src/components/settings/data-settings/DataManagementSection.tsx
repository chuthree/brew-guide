'use client';

import React, { useState, useRef } from 'react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showErrorReport } from '@/lib/feedback/errorReport';
import ArrowUpIcon from '@public/images/icons/ui/arrow-up.svg';
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
  const importingRef = useRef(false);
  const [importStatus, setImportStatus] = useState<{
    phase: 'importing' | 'success';
    message: string;
  } | null>(null);
  const [status, setStatus] = useState<{
    type: 'success' | 'info' | null;
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
      setStatus({ type: null, message: '' });
      showErrorReport({
        title: '导出数据失败',
        source: 'data:export',
        error: _error,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // 数据导入
  const handleImportClick = () => {
    if (importingRef.current || importStatus) return;
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || importingRef.current || importStatus) return;

    importingRef.current = true;
    const operationId = recordCrashOperationStart('settings:data-import', {
      fileBytes: file.size,
    });
    setImportStatus({
      phase: 'importing',
      message: '正在导入数据，请保持应用打开，暂时不要离开或关闭应用。',
    });
    try {
      let lastProgress = '';
      const result = await DataManagerUtil.importAllData(file, {
        onProgress: (phase, fraction) => {
          const message = `${phase === 'checking' ? '正在检查备份' : '正在导入数据'} ${Math.floor(fraction * 100)}%。请保持应用打开。`;
          if (message === lastProgress) return;
          lastProgress = message;
          setImportStatus({ phase: 'importing', message });
        },
      });
      recordCrashOperationComplete(
        {
          status: result.success ? 'success' : 'error',
          message: result.message,
        },
        operationId
      );
      if (result.success) {
        setImportStatus({
          phase: 'success',
          message: '数据已导入。请刷新应用，加载最新数据。',
        });
      } else {
        setImportStatus(null);
        showErrorReport({
          title: '导入数据失败',
          source: 'data:import',
          error: result.message,
        });
      }
    } catch (error) {
      recordCrashOperationComplete(
        {
          status: 'error',
          message: error instanceof Error ? error.message : '导入失败',
        },
        operationId
      );
      setImportStatus(null);
      showErrorReport({ title: '导入数据失败', source: 'data:import', error });
    } finally {
      importingRef.current = false;
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        setStatus({ type: null, message: '' });
        showErrorReport({
          title: '重置数据失败',
          source: 'data:reset',
          error: result.message,
        });
      }
    } catch (_error) {
      setStatus({ type: null, message: '' });
      showErrorReport({
        title: '重置数据失败',
        source: 'data:reset',
        error: _error,
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

      if (stats.failedCount > 0) {
        setStatus({ type: null, message: '', scope: 'image' });
        showErrorReport({
          title: '部分图片补压失败',
          source: 'data:recompress-images',
          error: `${stats.failedCount} 张图片处理失败；此操作未返回逐项错误原因。`,
          logs: [JSON.stringify(stats)],
        });
        return;
      }
      setStatus({
        type: 'success',
        scope: 'image',
        message:
          stats.compressedCount > 0
            ? `已补压 ${stats.compressedCount} 张图片`
            : '没有需要补压的图片',
      });
    } catch (_error) {
      setStatus({ type: null, message: '', scope: 'image' });
      showErrorReport({
        title: '图片补压失败',
        source: 'data:recompress-images',
        error: _error,
      });
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
    'setting-control cursor-pointer text-sm font-medium text-neutral-600 active:opacity-70 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300';
  const statusMessage = status.type ? (
    <p role="status" className="text-xs text-neutral-500 dark:text-neutral-400">
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
            onClick={handleExport}
            disabled={isExporting}
          >
            {null}
          </SettingRow>
          <SettingRow
            label="导入数据"
            onClick={handleImportClick}
            disabled={importStatus !== null}
          >
            {null}
          </SettingRow>
          <SettingRow
            label="重置数据"
            onClick={
              showConfirmReset ? undefined : () => setShowConfirmReset(true)
            }
            isLast
          >
            {showConfirmReset ? (
              <div className="setting-control flex items-center gap-3">
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
      <ActionDrawer
        title="导入数据"
        isOpen={importStatus !== null}
        onClose={() => {}}
        dismissible={false}
      >
        <ActionDrawer.Icon icon={ArrowUpIcon} />
        <ActionDrawer.Content>
          <p
            role="status"
            aria-live="polite"
            className="text-neutral-500 dark:text-neutral-400"
          >
            {importStatus?.message}
          </p>
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          <ActionDrawer.PrimaryButton
            disabled={importStatus?.phase === 'importing'}
            onClick={reloadApp}
          >
            {importStatus?.phase === 'importing' ? '正在导入…' : '刷新应用'}
          </ActionDrawer.PrimaryButton>
        </ActionDrawer.Actions>
      </ActionDrawer>
      {showImageOperations && (
        <SettingSection
          title="数据操作"
          footer={status.scope === 'image' ? statusMessage : undefined}
        >
          <SettingRow
            label={isRecompressing ? '补压中…' : '图片补压'}
            settingId={makeSettingRowSearchId('图片补压')}
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
