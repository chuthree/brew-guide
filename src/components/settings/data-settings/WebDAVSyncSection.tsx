'use client';

/**
 * WebDAV 同步配置组件
 *
 * 2025-12-21 重构：使用共享 Hook 和组件减少代码重复
 */

import React, { useState, useEffect } from 'react';
import { WebDAVSyncManager } from '@/lib/webdav/syncManager';
import type { SyncResult as WebDAVSyncResult } from '@/lib/webdav/types';
import type { BackupRecord } from '@/lib/s3/types';
import { useSyncSection } from '@/lib/hooks/useSyncSection';
import { SettingsOptions } from '../Settings';
import WebDAVTutorialModal from './WebDAVTutorialModal';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  SyncHeaderButton,
  SyncDebugDrawer,
  SyncButtons,
  BackupHistoryDrawer,
} from './shared';

type WebDAVSyncSettings = NonNullable<SettingsOptions['webdavSync']>;

interface WebDAVSyncSectionProps {
  settings: WebDAVSyncSettings;
  enabled: boolean;
  hapticFeedback: boolean;
  onSettingChange: <K extends keyof WebDAVSyncSettings>(
    key: K,
    value: WebDAVSyncSettings[K]
  ) => void;
  onSyncComplete?: () => void;
  onEnable?: () => void;
}

export const WebDAVSyncSection: React.FC<WebDAVSyncSectionProps> = ({
  settings,
  enabled,
  hapticFeedback,
  onSettingChange,
  onSyncComplete,
  onEnable,
}) => {
  // ============================================
  // 使用共享 Hook
  // ============================================

  const {
    status,
    setStatus,
    error,
    setError,
    expanded,
    setExpanded,
    isSyncing,
    setIsSyncing,
    syncProgress,
    setSyncProgress,
    debugLogs,
    setDebugLogs,
    showDebugDrawer,
    setShowDebugDrawer,
    textAreaRef,
    copySuccess,
    handleCopyLogs,
    handleSelectAll,
    getStatusColor,
    getStatusText,
    notifyCloudSyncStatusChange,
    triggerHaptic,
  } = useSyncSection(enabled, { hapticFeedback, onSyncComplete });

  // ============================================
  // WebDAV 特有状态
  // ============================================

  const [showPassword, setShowPassword] = useState(false);
  const [syncManager, setSyncManager] = useState<WebDAVSyncManager | null>(
    null
  );
  const [showTutorial, setShowTutorial] = useState(false);
  const [showBackupDrawer, setShowBackupDrawer] = useState(false);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);

  // ============================================
  // 状态初始化（不自动连接，连接在用户操作时按需建立）
  // ============================================

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      setSyncManager(null);
      setError('');
      return;
    }

    const isConfigComplete =
      settings.url && settings.username && settings.password;

    if (!isConfigComplete) {
      setStatus('disconnected');
      return;
    }

    // 如果之前成功连接过，显示为已连接状态
    setStatus(settings.lastConnectionSuccess ? 'connected' : 'disconnected');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, settings.lastConnectionSuccess]);

  // ============================================
  // 教程完成回调
  // ============================================

  const handleTutorialComplete = async (config: {
    url: string;
    username: string;
    password: string;
  }) => {
    onSettingChange('url', config.url);
    onSettingChange('username', config.username);
    onSettingChange('password', config.password);
    onSettingChange('lastConnectionSuccess', true);

    setExpanded(true);
    setStatus('connected');

    const manager = new WebDAVSyncManager();
    await manager.initialize({
      url: config.url,
      username: config.username,
      password: config.password,
      remotePath: settings.remotePath,
    });
    setSyncManager(manager);

    notifyCloudSyncStatusChange();
    triggerHaptic('light');
  };

  // ============================================
  // 连接和同步操作
  // ============================================

  const testConnection = async () => {
    if (!settings.url || !settings.username || !settings.password) {
      setError('请填写完整的WebDAV配置信息');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setError('');

    try {
      const manager = new WebDAVSyncManager();
      const connected = await manager.initialize({
        url: settings.url,
        username: settings.username,
        password: settings.password,
        remotePath: settings.remotePath,
        useProxy: settings.useProxy,
      });

      if (connected) {
        setStatus('connected');
        setSyncManager(manager);
        onSettingChange('lastConnectionSuccess', true);
        notifyCloudSyncStatusChange();
        triggerHaptic('light');
      } else {
        setStatus('error');
        if (settings.remotePath) {
          setError('连接失败：请检查服务器地址、账号密码和路径是否正确');
        } else {
          setError('连接失败：请检查服务器地址、账号或密码');
        }
      }
    } catch (err) {
      setStatus('error');
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(`连接失败: ${errorMsg}`);
    }
  };

  const performSync = async (direction: 'upload' | 'download') => {
    if (isSyncing) {
      setError('同步正在进行中');
      return;
    }

    setIsSyncing(true);
    setError('');
    setSyncProgress(null);

    try {
      // 按需建立连接（已验证过的连接跳过测试）
      let manager = syncManager;
      if (!manager || !manager.isInitialized()) {
        manager = new WebDAVSyncManager();
        const skipTest = settings.lastConnectionSuccess === true;
        const connected = await manager.initialize(
          {
            url: settings.url,
            username: settings.username,
            password: settings.password,
            remotePath: settings.remotePath,
            useProxy: settings.useProxy,
          },
          skipTest
        );
        if (!connected) {
          setStatus('error');
          setError('连接失败，请检查配置');
          setIsSyncing(false);
          return;
        }
        setSyncManager(manager);
        setStatus('connected');
        onSettingChange('lastConnectionSuccess', true);
      }

      const result: WebDAVSyncResult = await manager.sync({
        preferredDirection: direction,
        onProgress: progress => {
          setSyncProgress({
            phase: progress.phase,
            message: progress.message,
            percentage: progress.percentage,
          });
        },
      });

      if (result.success) {
        if (result.uploadedFiles > 0 && result.downloadedFiles > 0) {
          showToast({
            type: 'success',
            title: `同步完成：上传 ${result.uploadedFiles} 项，下载 ${result.downloadedFiles} 项，即将重启...`,
            duration: 3000,
          });
          setTimeout(() => window.location.reload(), 3000);
        } else if (result.uploadedFiles > 0) {
          showToast({
            type: 'success',
            title: `已上传 ${result.uploadedFiles} 项到云端`,
            duration: 2500,
          });
        } else if (result.downloadedFiles > 0) {
          showToast({
            type: 'success',
            title: `已从云端下载 ${result.downloadedFiles} 项，即将重启...`,
            duration: 2500,
          });
          setTimeout(() => window.location.reload(), 2500);
        } else {
          if (result.debugLogs && result.debugLogs.length > 0) {
            setDebugLogs(result.debugLogs);
            setShowDebugDrawer(true);
            showToast({
              type: 'warning',
              title: `${direction === 'upload' ? '上传' : '下载'}完成但未传输任何文件，请查看详细日志`,
              duration: 3000,
            });
          } else {
            showToast({
              type: 'info',
              title: '数据已是最新，无需同步',
              duration: 2000,
            });
          }
        }

        triggerHaptic('medium');
        onSyncComplete?.();
      } else {
        if (result.debugLogs && result.debugLogs.length > 0) {
          setDebugLogs(result.debugLogs);
          setShowDebugDrawer(true);
        }
        setError(result.message || '同步失败');
        showToast({
          type: 'error',
          title: result.message || 'WebDAV 同步失败',
          duration: 3000,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(`同步失败: ${errorMsg}`);
      showToast({
        type: 'error',
        title: `WebDAV 同步失败: ${errorMsg}`,
        duration: 3000,
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleShowBackups = async () => {
    setIsLoadingBackups(true);
    try {
      let manager = syncManager;
      if (!manager || !manager.isInitialized()) {
        manager = new WebDAVSyncManager();
        const connected = await manager.initialize(
          {
            url: settings.url,
            username: settings.username,
            password: settings.password,
            remotePath: settings.remotePath,
            useProxy: settings.useProxy,
          },
          true
        );
        if (!connected) {
          showToast({ type: 'error', title: '连接失败', duration: 2000 });
          return;
        }
        setSyncManager(manager);
      }

      const list = await manager.listBackups();
      setBackups(list);
      setShowBackupDrawer(true);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const handleRestoreBackup = async (backupKey: string): Promise<boolean> => {
    if (!syncManager) return false;
    setIsRestoring(true);
    try {
      const success = await syncManager.restoreFromBackup(backupKey);
      if (success) {
        showToast({
          type: 'success',
          title: '恢复成功，即将重启...',
          duration: 2000,
        });
        setTimeout(() => window.location.reload(), 2000);
        return true;
      } else {
        showToast({ type: 'error', title: '恢复失败', duration: 2000 });
        return false;
      }
    } finally {
      setIsRestoring(false);
    }
  };

  // ============================================
  // UI 渲染
  // ============================================

  return (
    <div className="ml-0 space-y-3">
      {/* 头部按钮 */}
      <SyncHeaderButton
        serviceName="WebDAV"
        enabled={enabled}
        status={status}
        expanded={expanded}
        statusColor={getStatusColor()}
        statusText={getStatusText()}
        onClick={() => {
          if (!enabled && onEnable) {
            onEnable();
          }
          setExpanded(!expanded);
        }}
      />

      {/* 配置表单 */}
      {enabled && expanded && (
        <div className="space-y-3 rounded bg-neutral-100 p-4 dark:bg-neutral-800">
          {/* URL */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              服务器地址
            </label>
            <input
              type="url"
              value={settings.url}
              onChange={e => onSettingChange('url', e.target.value)}
              placeholder="https://dav.jianguoyun.com/dav/"
              className="w-full rounded-md border border-neutral-200/50 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
            <div className="mt-1.5 flex items-center justify-between">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                坚果云: https://dav.jianguoyun.com/dav/
              </p>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300">
                <input
                  type="checkbox"
                  checked={settings.useProxy !== false}
                  onChange={e => onSettingChange('useProxy', e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-neutral-300 text-neutral-600 focus:ring-1 focus:ring-neutral-400 dark:border-neutral-600 dark:bg-neutral-700"
                />
                <span>代理</span>
              </label>
            </div>
          </div>

          {/* 账号 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              账号
            </label>
            <input
              type="text"
              value={settings.username}
              onChange={e => onSettingChange('username', e.target.value)}
              placeholder="username"
              autoComplete="username"
              className="w-full rounded-md border border-neutral-200/50 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          {/* 密码 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={settings.password}
                onChange={e => onSettingChange('password', e.target.value)}
                placeholder="password"
                autoComplete="current-password"
                className="w-full rounded-md border border-neutral-200/50 bg-neutral-50 px-3 py-2 pr-10 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute top-1/2 right-2 -translate-y-1/2 transform p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {showPassword ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m5.656 5.656L15.536 15.536m-1.414-1.414L15.536 15.536"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* 远程路径 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              远程目录路径
            </label>
            <input
              type="text"
              value={settings.remotePath}
              onChange={e => onSettingChange('remotePath', e.target.value)}
              placeholder="brew-guide-data/"
              className="w-full rounded-md border border-neutral-200/50 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          {/* 错误信息 */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-xs text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {/* 测试连接按钮 */}
          <button
            onClick={testConnection}
            disabled={status === 'connecting'}
            className="w-full rounded-md bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-900 disabled:bg-neutral-400 dark:bg-neutral-700 dark:hover:bg-neutral-600"
          >
            {status === 'connecting' ? '连接中...' : '测试连接'}
          </button>
        </div>
      )}

      {/* 同步按钮 */}
      <SyncButtons
        enabled={enabled}
        isConnected={status === 'connected'}
        isSyncing={isSyncing}
        onUpload={() => performSync('upload')}
        onDownload={() => performSync('download')}
        onShowBackups={handleShowBackups}
        isLoadingBackups={isLoadingBackups}
      />

      {/* 备份历史抽屉 */}
      <BackupHistoryDrawer
        isOpen={showBackupDrawer}
        onClose={() => setShowBackupDrawer(false)}
        backups={backups}
        onRestore={handleRestoreBackup}
        isRestoring={isRestoring}
      />

      {/* WebDAV 配置教程 */}
      <WebDAVTutorialModal
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onComplete={handleTutorialComplete}
      />

      {/* 调试日志抽屉 */}
      <SyncDebugDrawer
        isOpen={showDebugDrawer}
        onClose={() => setShowDebugDrawer(false)}
        logs={debugLogs}
        textAreaRef={textAreaRef}
        copySuccess={copySuccess}
        onCopy={handleCopyLogs}
        onSelectAll={handleSelectAll}
        title="WebDAV 同步日志"
      />
    </div>
  );
};
