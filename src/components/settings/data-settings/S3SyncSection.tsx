'use client';

/**
 * S3 同步配置组件
 *
 * 2025-12-21 重构：使用共享 Hook 和组件减少代码重复
 */

import { SettingInput, SettingRow } from '../atomic';
import { makeSettingRowSearchId } from '../settingsSearch';
import React, { useState } from 'react';
import { S3SyncManager } from '@/lib/s3/syncManagerV2';
import { CloudProxySetting } from './shared/CloudProxySetting';
import type {
  SyncResult,
  SyncMetadataV2 as SyncMetadata,
  BackupRecord,
} from '@/lib/s3/types';
import { useSyncSection } from '@/lib/hooks/useSyncSection';
import { SettingsOptions } from '../Settings';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  SyncHeaderButton,
  SyncDebugDrawer,
  SyncButtons,
  BackupHistoryDrawer,
} from './shared';

type S3SyncSettings = NonNullable<SettingsOptions['s3Sync']>;

interface S3SyncSectionProps {
  settings: S3SyncSettings;
  enabled: boolean;
  isLast?: boolean;
  renderContent: (
    configuration: React.ReactNode,
    actions: React.ReactNode
  ) => React.ReactNode;
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
  isLast = true,
  renderContent,
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
    setSyncProgress,
    debugLogs,
    setDebugLogs,
    showDebugDrawer,
    setShowDebugDrawer,
    textAreaRef,
    copySuccess,
    handleCopyLogs,
    handleSelectAll,
    notifyCloudSyncStatusChange,
    triggerHaptic,
  } = useSyncSection(enabled, { hapticFeedback, onSyncComplete });

  // ============================================
  // S3 特有状态
  // ============================================

  const [syncManager, setSyncManager] = useState<S3SyncManager | null>(null);
  const [showBackupDrawer, setShowBackupDrawer] = useState(false);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const isConfigComplete = Boolean(
    settings.accessKeyId && settings.secretAccessKey && settings.bucketName
  );
  const effectiveStatus: typeof status =
    !enabled ||
    !isConfigComplete ||
    (status === 'connected' && !settings.lastConnectionSuccess)
      ? 'disconnected'
      : status === 'disconnected' && settings.lastConnectionSuccess
        ? 'connected'
        : status;
  const effectiveError = enabled ? error : '';
  const activeSyncManager =
    enabled && isConfigComplete && settings.lastConnectionSuccess
      ? syncManager
      : null;

  const handleProxyChange = (value: string) => {
    onSettingChange('proxyUrl', value);
    setSyncManager(null);
    setStatus('disconnected');
    setError('');
  };

  // ============================================
  // 自动连接
  // ============================================
  const getEffectiveStatusColor = () => {
    if (!enabled) return 'bg-neutral-300 dark:bg-neutral-600';
    switch (effectiveStatus) {
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

  const getEffectiveStatusText = () => {
    if (!enabled) return '点击启用';
    switch (effectiveStatus) {
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
        proxyUrl: settings.proxyUrl,
      });

      if (connected) {
        setStatus('connected');
        setSyncManager(manager);
        onSettingChange('lastConnectionSuccess', true);
        notifyCloudSyncStatusChange();
        triggerHaptic('light');
      } else {
        setStatus('error');
        setError(
          manager.getLastError() ||
            (settings.endpoint
              ? '连接失败：无法访问存储桶或缺少写入权限'
              : '连接失败：请检查 Bucket 名称和 Region 是否正确')
        );
      }
    } catch (err) {
      setStatus('error');
      setError(`连接失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  };

  const performSync = async (direction: 'auto' | 'upload' | 'download') => {
    if (isSyncing) {
      setError('同步正在进行中');
      return;
    }

    setIsSyncing(true);
    setError('');
    setSyncProgress(null);

    try {
      // 按需建立连接（已验证过的连接跳过测试）
      let manager = activeSyncManager;
      if (!manager || !manager.isInitialized()) {
        manager = new S3SyncManager();
        const skipTest = settings.lastConnectionSuccess === true;
        const connected = await manager.initialize(
          {
            region: settings.region,
            accessKeyId: settings.accessKeyId,
            secretAccessKey: settings.secretAccessKey,
            bucketName: settings.bucketName,
            prefix: settings.prefix,
            endpoint: settings.endpoint || undefined,
            proxyUrl: settings.proxyUrl,
          },
          skipTest
        );
        if (!connected) {
          setStatus('error');
          setError(manager.getLastError() || '连接失败，请检查配置');
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
        setError(result.message);
        return;
      }

      if (result.success) {
        if (result.downloadedFiles > 0) {
          triggerHaptic('medium');
          onSyncComplete?.();
          window.location.reload();
          return;
        }

        if (result.uploadedFiles > 0) {
          showToast({
            type: 'success',
            title:
              direction === 'auto'
                ? result.message
                : `已上传 ${result.uploadedFiles} 项到云端`,
            duration: 2500,
          });
        } else {
          if (
            direction !== 'auto' &&
            result.debugLogs &&
            result.debugLogs.length > 0
          ) {
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

  const handleShowBackups = async () => {
    setIsLoadingBackups(true);
    try {
      let manager = activeSyncManager;
      if (!manager || !manager.isInitialized()) {
        manager = new S3SyncManager();
        const connected = await manager.initialize(
          {
            region: settings.region,
            accessKeyId: settings.accessKeyId,
            secretAccessKey: settings.secretAccessKey,
            bucketName: settings.bucketName,
            prefix: settings.prefix,
            endpoint: settings.endpoint || undefined,
            proxyUrl: settings.proxyUrl,
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
    if (!activeSyncManager) return false;
    setIsRestoring(true);
    try {
      const success = await activeSyncManager.restoreFromBackup(backupKey);
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

  const configuration = (
    <>
      {/* 头部按钮 */}
      <SyncHeaderButton
        serviceName="S3"
        enabled={enabled}
        status={effectiveStatus}
        expanded={expanded}
        isLast={!expanded && isLast}
        statusColor={getEffectiveStatusColor()}
        statusText={getEffectiveStatusText()}
        onClick={() => {
          if (!enabled && onEnable) {
            onEnable();
          }
          setExpanded(!expanded);
        }}
      />

      {/* 配置表单 */}
      {enabled && expanded && (
        <>
          <CloudProxySetting
            value={settings.proxyUrl}
            onChange={handleProxyChange}
          />

          {/* 服务地址 (Endpoint) */}
          <SettingRow
            label="服务地址 (Endpoint)"
            isSubSetting
            expandControl
            isLast={false}
          >
            <SettingInput
              aria-label="服务地址 (Endpoint)"
              autoCapitalize="none"
              spellCheck={false}
              type="url"
              value={settings.endpoint || ''}
              onChange={e => onSettingChange('endpoint', e.target.value)}
              placeholder="s3.cstcloud.cn"
            />
          </SettingRow>

          {/* 区域 (Region) */}
          <SettingRow
            label="区域 (Region)"
            isSubSetting
            expandControl
            isLast={false}
          >
            <SettingInput
              aria-label="区域 (Region)"
              autoCapitalize="none"
              spellCheck={false}
              type="text"
              value={settings.region}
              onChange={e => onSettingChange('region', e.target.value)}
              placeholder="us-east-1"
            />
          </SettingRow>

          {/* Access Key ID */}
          <SettingRow
            label="Access Key ID"
            isSubSetting
            expandControl
            isLast={false}
          >
            <SettingInput
              aria-label="Access Key ID"
              autoCapitalize="none"
              spellCheck={false}
              type="text"
              value={settings.accessKeyId}
              onChange={e => onSettingChange('accessKeyId', e.target.value)}
              placeholder="AKIA..."
            />
          </SettingRow>

          {/* Secret Access Key */}
          <SettingRow
            label="Secret Access Key"
            isSubSetting
            expandControl
            isLast={false}
          >
            <SettingInput
              aria-label="Secret Access Key"
              autoCapitalize="none"
              spellCheck={false}
              type="password"
              value={settings.secretAccessKey}
              onChange={e => onSettingChange('secretAccessKey', e.target.value)}
              placeholder="密钥"
            />
          </SettingRow>

          {/* 存储桶 (Bucket) */}
          <SettingRow
            label="存储桶 (Bucket)"
            isSubSetting
            expandControl
            isLast={false}
          >
            <SettingInput
              aria-label="存储桶 (Bucket)"
              autoCapitalize="none"
              spellCheck={false}
              type="text"
              value={settings.bucketName}
              onChange={e => onSettingChange('bucketName', e.target.value)}
              placeholder="bucket-name"
            />
          </SettingRow>

          {/* 文件前缀 */}
          <SettingRow
            label="文件前缀（可选）"
            isSubSetting
            expandControl
            isLast={false}
          >
            <SettingInput
              aria-label="文件前缀（可选）"
              autoCapitalize="none"
              spellCheck={false}
              type="text"
              value={settings.prefix}
              onChange={e => onSettingChange('prefix', e.target.value)}
              placeholder="brew-guide-data/"
            />
          </SettingRow>

          {/* 错误信息 */}
          {effectiveError && (
            <div
              role="alert"
              className="px-3.5 py-3 text-xs leading-relaxed text-red-600 dark:text-red-400"
            >
              {effectiveError}
            </div>
          )}

          {/* 测试连接按钮 */}
          <SettingRow
            label={effectiveStatus === 'connecting' ? '连接中…' : '测试连接'}
            settingId={makeSettingRowSearchId('测试连接')}
            isSubSetting
            className="min-h-11"
            onClick={testConnection}
            disabled={effectiveStatus === 'connecting'}
            isLast={isLast}
          >
            {null}
          </SettingRow>
        </>
      )}
    </>
  );

  const actions =
    enabled && effectiveStatus === 'connected' ? (
      <SyncButtons
        enabled={enabled}
        isConnected={effectiveStatus === 'connected'}
        isSyncing={isSyncing}
        onUpload={() => performSync('upload')}
        onSync={() => performSync('auto')}
        onDownload={() => performSync('download')}
        onShowBackups={handleShowBackups}
        isLoadingBackups={isLoadingBackups}
        isLast
      />
    ) : null;

  return (
    <>
      {renderContent(configuration, actions)}

      {/* 备份历史抽屉 */}
      <BackupHistoryDrawer
        isOpen={showBackupDrawer}
        onClose={() => setShowBackupDrawer(false)}
        backups={backups}
        onRestore={handleRestoreBackup}
        isRestoring={isRestoring}
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
    </>
  );
};
