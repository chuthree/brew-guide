'use client';

/**
 * S3 同步配置组件
 *
 * 2025-12-21 重构：使用共享 Hook 和组件减少代码重复
 */

import React, { useState, useEffect } from 'react';
import { S3SyncManager } from '@/lib/s3/syncManagerV2';
import type {
  SyncResult,
  SyncMetadataV2 as SyncMetadata,
} from '@/lib/s3/types';
import { useSyncSection } from '@/lib/hooks/useSyncSection';
import { SettingsOptions } from '../Settings';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import DataAlertIcon from '@public/images/icons/ui/data-alert.svg';
import { showToast } from '@/components/common/feedback/LightToast';
import { SyncHeaderButton, SyncDebugDrawer, SyncButtons } from './shared';

type S3SyncSettings = NonNullable<SettingsOptions['s3Sync']>;

interface S3SyncSectionProps {
  settings: S3SyncSettings;
  enabled: boolean;
  hapticFeedback: boolean;
  onSettingChange: <K extends keyof S3SyncSettings>(
    key: K,
    value: S3SyncSettings[K]
  ) => void;
  onSyncComplete?: () => void;
  onConflict?: (remoteTime: number | null) => void;
  onEnable?: () => void;
}

export const S3SyncSection: React.FC<S3SyncSectionProps> = ({
  settings,
  enabled,
  hapticFeedback,
  onSettingChange,
  onSyncComplete,
  onConflict,
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
  // S3 特有状态
  // ============================================

  const [showSecretKey, setShowSecretKey] = useState(false);
  const [syncManager, setSyncManager] = useState<S3SyncManager | null>(null);

  // ============================================
  // 自动连接
  // ============================================

  useEffect(() => {
    if (!enabled) {
      setStatus('disconnected');
      setSyncManager(null);
      setError('');
      return;
    }

    const isConfigComplete =
      settings.accessKeyId && settings.secretAccessKey && settings.bucketName;

    if (!isConfigComplete) {
      setStatus('disconnected');
      return;
    }

    // 如果之前成功连接过，显示为已连接状态（但不实际建立连接）
    // 实际连接在用户执行同步操作时按需建立
    if (settings.lastConnectionSuccess) {
      setStatus('connected');
    } else {
      setStatus('disconnected');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, settings.lastConnectionSuccess]);

  // ============================================
  // 连接和同步操作
  // ============================================

  const testConnection = async () => {
    if (
      !settings.accessKeyId ||
      !settings.secretAccessKey ||
      !settings.bucketName
    ) {
      setError('请填写完整的S3配置信息');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setError('');

    try {
      const manager = new S3SyncManager();
      const connected = await manager.initialize({
        region: settings.region,
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
        bucketName: settings.bucketName,
        prefix: settings.prefix,
        endpoint: settings.endpoint || undefined,
      });

      if (connected) {
        setStatus('connected');
        setSyncManager(manager);
        onSettingChange('lastConnectionSuccess', true);
        notifyCloudSyncStatusChange();
        triggerHaptic('light');
      } else {
        setStatus('error');
        if (!settings.endpoint) {
          setError('连接失败：请检查 Bucket 名称和 Region 是否正确');
        } else {
          setError('连接失败：无法访问存储桶或缺少写入权限');
        }
      }
    } catch (err) {
      setStatus('error');
      setError(`连接失败: ${err instanceof Error ? err.message : '未知错误'}`);
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
      // 按需建立连接
      let manager = syncManager;
      if (!manager) {
        manager = new S3SyncManager();
        const connected = await manager.initialize({
          region: settings.region,
          accessKeyId: settings.accessKeyId,
          secretAccessKey: settings.secretAccessKey,
          bucketName: settings.bucketName,
          prefix: settings.prefix,
          endpoint: settings.endpoint || undefined,
        });
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

      const result: SyncResult = await manager.sync({
        preferredDirection: direction,
        onProgress: progress => {
          setSyncProgress({
            phase: progress.phase,
            message: progress.message,
            percentage: progress.percentage,
          });
        },
      });

      if (result.conflict) {
        const metadata = result.remoteMetadata;
        if (metadata && 'version' in metadata && metadata.version === '2.0.0') {
          onConflict?.((metadata as SyncMetadata).lastSyncTime || null);
        }
        if (result.debugLogs && result.debugLogs.length > 0) {
          setDebugLogs(result.debugLogs);
          setShowDebugDrawer(true);
        }
        setError('数据冲突：本地和云端数据都已更改。');
        return;
      }

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
          title: result.message || '同步失败',
          duration: 3000,
        });
      }
    } catch (err) {
      console.error('同步失败:', err);
      setError(`同步失败: ${err instanceof Error ? err.message : '未知错误'}`);
      showToast({
        type: 'error',
        title: `同步失败: ${err instanceof Error ? err.message : '未知错误'}`,
        duration: 3000,
      });
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  };

  // ============================================
  // UI 渲染
  // ============================================

  return (
    <div className="ml-0 space-y-3">
      {/* 头部按钮 */}
      <SyncHeaderButton
        serviceName="S3"
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
          {/* 服务地址 (Endpoint) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              服务地址 (Endpoint)
            </label>
            <input
              type="url"
              value={settings.endpoint || ''}
              onChange={e => onSettingChange('endpoint', e.target.value)}
              placeholder="http(s)://bucket-name.s3.cn-south-1.qiniucs.com"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              七牛云示例: http(s)://bucket-name.s3.cn-south-1.qiniucs.com
            </p>
          </div>

          {/* 区域 (Region) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              区域 (Region)
            </label>
            <input
              type="text"
              value={settings.region}
              onChange={e => onSettingChange('region', e.target.value)}
              placeholder="cn-south-1"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              如不确定可填写: us-east-1 或 cn-south-1
            </p>
          </div>

          {/* Access Key ID */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Access Key ID
            </label>
            <input
              type="text"
              value={settings.accessKeyId}
              onChange={e => onSettingChange('accessKeyId', e.target.value)}
              placeholder="AKIA..."
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          {/* Secret Access Key */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              Secret Access Key
            </label>
            <div className="relative">
              <input
                type={showSecretKey ? 'text' : 'password'}
                value={settings.secretAccessKey}
                onChange={e =>
                  onSettingChange('secretAccessKey', e.target.value)
                }
                placeholder="密钥"
                className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 pr-10 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey(!showSecretKey)}
                className="absolute top-1/2 right-2 -translate-y-1/2 transform p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {showSecretKey ? (
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

          {/* 存储桶 (Bucket) */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              存储桶 (Bucket)
            </label>
            <input
              type="text"
              value={settings.bucketName}
              onChange={e => onSettingChange('bucketName', e.target.value)}
              placeholder="bucket-name"
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
            />
          </div>

          {/* 文件前缀 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
              文件前缀（可选）
            </label>
            <input
              type="text"
              value={settings.prefix}
              onChange={e => onSettingChange('prefix', e.target.value)}
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
      <SyncButtons
        enabled={enabled}
        isConnected={status === 'connected'}
        isSyncing={isSyncing}
        onUpload={() => performSync('upload')}
        onDownload={() => performSync('download')}
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
        title="S3 同步日志"
      />
    </div>
  );
};
