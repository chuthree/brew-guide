'use client';

import React, { useState, useRef } from 'react';
import { ChevronRight } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { DataManager as DataManagerUtil } from '@/lib/core/dataManager';
import { BackupReminderUtils } from '@/lib/utils/backupReminderUtils';

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
  }>({
    type: null,
    message: '',
  });
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  // 数据导出
  const handleExport = async () => {
    try {
      const getLocalDateString = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const jsonData = await DataManagerUtil.exportAllData();
      const fileName = `brew-guide-data-${getLocalDateString(new Date())}.json`;

      if (isNative) {
        try {
          await Filesystem.writeFile({
            path: fileName,
            data: jsonData,
            directory: Directory.Cache,
            encoding: Encoding.UTF8,
          });

          const uriResult = await Filesystem.getUri({
            path: fileName,
            directory: Directory.Cache,
          });

          await Share.share({
            title: '导出数据',
            text: '请选择保存位置',
            url: uriResult.uri,
            dialogTitle: '导出数据',
          });

          await Filesystem.deleteFile({
            path: fileName,
            directory: Directory.Cache,
          });

          setStatus({ type: 'success', message: '数据已成功导出' });

          try {
            await BackupReminderUtils.markBackupCompleted();
          } catch (error) {
            console.error('标记备份完成失败:', error);
          }
        } catch (error) {
          throw new Error(`保存文件失败: ${(error as Error).message}`);
        }
      } else {
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);

        setStatus({ type: 'success', message: '数据导出成功，文件已下载' });

        try {
          await BackupReminderUtils.markBackupCompleted();
        } catch (error) {
          console.error('标记备份完成失败:', error);
        }
      }
    } catch (_error) {
      setStatus({
        type: 'error',
        message: `导出失败: ${(_error as Error).message}`,
      });
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

          const { isBeanconquerorData, importBeanconquerorData } =
            await import('@/lib/utils/beanconquerorImporter');

          if (isBeanconquerorData(jsonString)) {
            setStatus({
              type: 'info',
              message: '检测到 Beanconqueror 数据，正在转换...',
            });

            const importResult = await importBeanconquerorData(jsonString);

            if (importResult.success && importResult.data) {
              const { Storage } = await import('@/lib/core/storage');
              const { db } = await import('@/lib/core/db');

              await Storage.set('coffeeBeans', JSON.stringify([]));
              await db.coffeeBeans.clear();
              await Storage.set('brewingNotes', JSON.stringify([]));
              await db.brewingNotes.clear();

              const { getCoffeeBeanStore } =
                await import('@/lib/stores/coffeeBeanStore');
              const store = getCoffeeBeanStore();
              await store.refreshBeans();

              try {
                for (const bean of importResult.data.coffeeBeans) {
                  const { id: _id, timestamp: _timestamp, ...beanData } = bean;
                  await store.addBean(beanData);
                }
              } catch (error) {
                throw error;
              }

              if (importResult.data.brewingNotes.length > 0) {
                await Storage.set(
                  'brewingNotes',
                  JSON.stringify(importResult.data.brewingNotes)
                );

                try {
                  const { globalCache, calculateTotalCoffeeConsumption } =
                    await import('@/components/notes/List/globalCache');
                  type BrewingNote = import('@/lib/core/config').BrewingNote;
                  globalCache.notes = importResult.data
                    .brewingNotes as unknown as BrewingNote[];
                  globalCache.totalConsumption =
                    calculateTotalCoffeeConsumption(
                      importResult.data.brewingNotes as unknown as BrewingNote[]
                    );
                } catch (cacheError) {
                  console.error('更新笔记缓存失败:', cacheError);
                }
              }

              onDataChange?.();
              window.location.reload();
            } else {
              setStatus({ type: 'error', message: importResult.message });
            }
          } else {
            const result = await DataManagerUtil.importAllData(jsonString);

            if (result.success) {
              onDataChange?.();
              window.location.reload();
            } else {
              setStatus({ type: 'error', message: result.message });
            }
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

  return (
    <div className="px-6 py-4">
      <h3 className="mb-3 text-sm font-medium tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
        数据管理
      </h3>

      {status.type && (
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
          onClick={handleExport}
          className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
        >
          <span>导出数据</span>
          <ChevronRight className="h-4 w-4 text-neutral-400" />
        </button>

        <div>
          <button
            onClick={handleImportClick}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <span>导入数据</span>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {!showConfirmReset ? (
          <button
            onClick={() => setShowConfirmReset(true)}
            className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          >
            <span>重置数据</span>
            <ChevronRight className="h-4 w-4 text-neutral-400" />
          </button>
        ) : (
          <div className="space-y-3 rounded bg-neutral-100 p-4 dark:bg-neutral-800">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              确认重置数据？此操作无法撤销
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="flex-1 rounded bg-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
              >
                确认重置
              </button>
              <button
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
  );
};
