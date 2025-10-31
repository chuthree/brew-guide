'use client';

import React, { useState, useEffect } from 'react';
import WebDAVSyncManager from '@/lib/webdav/syncManager';
import type { SyncResult as WebDAVSyncResult } from '@/lib/webdav/types';
import hapticsUtils from '@/lib/ui/haptics';
import { SettingsOptions } from '../Settings';

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
  const [status, setStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [syncManager, setSyncManager] = useState<WebDAVSyncManager | null>(
    null
  );
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNeeded, setSyncNeeded] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    phase: string;
    message: string;
    percentage: number;
  } | null>(null);

  // 自动连接
  useEffect(() => {
    if (
      enabled &&
      settings.lastConnectionSuccess &&
      settings.url &&
      settings.username &&
      settings.password
    ) {
      const autoConnect = async () => {
        const manager = new WebDAVSyncManager();
        const connected = await manager.initialize({
          url: settings.url,
          username: settings.username,
          password: settings.password,
          remotePath: settings.remotePath,
        });

        if (connected) {
          setStatus('connected');
          setSyncManager(manager);
          const lastSync = await manager.getLastSyncTime();
          setLastSyncTime(lastSync);
          const needsSync = await manager.needsSync();
          setSyncNeeded(needsSync);
        } else {
          setStatus('error');
          setError('自动连接失败，请检查配置');
        }
      };
      autoConnect();
    }
  }, [enabled, settings]);

  // 测试连接
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
      });

      if (connected) {
        setStatus('connected');
        setSyncManager(manager);
        onSettingChange('lastConnectionSuccess', true);

        const lastSync = await manager.getLastSyncTime();
        setLastSyncTime(lastSync);
        const needsSync = await manager.needsSync();
        setSyncNeeded(needsSync);

        // 通知 Settings 页面更新云同步状态
        window.dispatchEvent(new CustomEvent('cloudSyncStatusChange'));

        if (hapticFeedback) {
          hapticsUtils.light();
        }
      } else {
        setStatus('error');
        setError('连接失败，请检查WebDAV配置信息');
      }
    } catch (err) {
      setStatus('error');
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(`连接失败: ${errorMsg}`);
    }
  };

  // 执行同步
  const performSync = async (
    direction: 'auto' | 'upload' | 'download' = 'auto'
  ) => {
    if (!syncManager) {
      setError('请先测试连接');
      return;
    }

    if (isSyncing) {
      setError('同步正在进行中');
      return;
    }

    setIsSyncing(true);
    setError('');
    setSyncProgress(null);

    try {
      const result: WebDAVSyncResult = await syncManager.sync({
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
        const lastSync = await syncManager.getLastSyncTime();
        setLastSyncTime(lastSync);
        const needsSync = await syncManager.needsSync();
        setSyncNeeded(needsSync);

        const { showToast } = await import(
          '@/components/common/feedback/LightToast'
        );

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
          showToast({
            type: 'info',
            title: '数据已是最新，无需同步',
            duration: 2000,
          });
        }

        if (hapticFeedback) {
          hapticsUtils.medium();
        }

        onSyncComplete?.();
      } else {
        setError(result.message || '同步失败');
        const { showToast } = await import(
          '@/components/common/feedback/LightToast'
        );
        showToast({
          type: 'error',
          title: result.message || 'WebDAV 同步失败',
          duration: 3000,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(`同步失败: ${errorMsg}`);

      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
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

  // 获取状态指示点的颜色
  const getStatusColor = () => {
    if (!enabled) return 'bg-neutral-300 dark:bg-neutral-600';
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-neutral-300 dark:bg-neutral-600';
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    if (!enabled) return '点击启用';
    switch (status) {
      case 'connected':
        return '已连接';
      case 'connecting':
        return '连接中...';
      case 'error':
        return '连接失败';
      default:
        return '未配置';
    }
  };

  return (
    <div className="ml-0 space-y-3">
      {/* 主按钮 - 展开/收起配置 */}
      <button
        onClick={() => {
          if (!enabled && onEnable) {
            onEnable();
          }
          setExpanded(!expanded);
        }}
        className="flex w-full items-center justify-between rounded bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-800 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      >
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${getStatusColor()}`}></div>
          <span>WebDAV 云同步配置</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 dark:text-neutral-400">
            {getStatusText()}
          </span>
          <svg
            className={`h-4 w-4 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* 配置表单 - 折叠区域 */}
      {enabled && expanded && (
        <div className="space-y-3 rounded bg-neutral-100 p-4 dark:bg-neutral-800">
          {/* URL */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              WebDAV 服务器地址
            </label>
            <input
              type="url"
              value={settings.url}
              onChange={e => onSettingChange('url', e.target.value)}
              placeholder="https://your-server.com/remote.php/dav/files/username/"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Nextcloud: https://your-domain/remote.php/dav/files/username/
            </p>
          </div>

          {/* 用户名 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              用户名
            </label>
            <input
              type="text"
              value={settings.username}
              onChange={e => onSettingChange('username', e.target.value)}
              placeholder="username"
              autoComplete="username"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
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
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 pr-10 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
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
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              Nextcloud 建议使用应用专用密码
            </p>
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
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
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
      {enabled && status === 'connected' && (
        <div className="space-y-3">
          {/* 同步信息卡片 */}
          <div className="rounded bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
            <div className="space-y-2">
              {/* 同步状态 */}
              {syncNeeded && (
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    检测到数据变更
                  </span>
                </div>
              )}

              {/* 最后同步时间 */}
              {lastSyncTime && (
                <div className="text-sm text-neutral-600 dark:text-neutral-400">
                  最后同步：
                  {lastSyncTime.toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </div>

          {/* 同步按钮 */}
          <button
            onClick={() => performSync('auto')}
            disabled={isSyncing}
            className="w-full rounded bg-neutral-800 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-neutral-900 disabled:bg-neutral-400 dark:bg-neutral-700 dark:hover:bg-neutral-600"
          >
            {isSyncing ? (
              syncProgress ? (
                <div className="flex flex-col items-center gap-1">
                  <span>{syncProgress.message}</span>
                  <div className="h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-600">
                    <div
                      className="h-1.5 rounded-full bg-white transition-all duration-300"
                      style={{ width: `${syncProgress.percentage}%` }}
                    />
                  </div>
                </div>
              ) : (
                '同步中...'
              )
            ) : (
              '立即同步'
            )}
          </button>
        </div>
      )}
    </div>
  );
};
