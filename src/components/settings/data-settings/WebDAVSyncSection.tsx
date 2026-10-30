'use client';

/**
 * WebDAV 同步配置组件
 *
 * 2025-12-21 重构：使用共享 Hook 和组件减少代码重复
 */

import { SettingInput, SettingRow } from '../atomic';
import { makeSettingRowSearchId } from '../settingsSearch';
import React, { useState } from 'react';
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
  isLast?: boolean;
  renderContent: (
    configuration: React.ReactNode,
    actions: React.ReactNode
  ) => React.ReactNode;
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
  isLast = true,
  renderContent,
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
  // WebDAV 特有状态
  // ============================================

  const [syncManager, setSyncManager] = useState<WebDAVSyncManager | null>(
    null
  );
  const [showTutorial, setShowTutorial] = useState(false);
  const [showBackupDrawer, setShowBackupDrawer] = useState(false);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const isConfigComplete = Boolean(
    settings.url && settings.username && settings.password
  );
  const effectiveStatus: typeof status =
    !enabled || !isConfigComplete
      ? 'disconnected'
      : status === 'disconnected' && settings.lastConnectionSuccess
        ? 'connected'
        : status;
  const effectiveError = enabled ? error : '';
  const activeSyncManager = enabled && isConfigComplete ? syncManager : null;

  // ============================================
  // 状态初始化（不自动连接，连接在用户操作时按需建立）
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
            (settings.remotePath
              ? '连接失败：请检查服务器地址、账号、应用密码和路径是否正确'
              : '连接失败：请检查服务器地址、账号或应用密码')
        );
      }
    } catch (err) {
      setStatus('error');
      const errorMsg = err instanceof Error ? err.message : '未知错误';
      setError(`连接失败: ${errorMsg}`);
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
        manager = new WebDAVSyncManager();
        const skipTest = settings.lastConnectionSuccess === true;
        const connected = await manager.initialize(
          {
            url: settings.url,
            username: settings.username,
            password: settings.password,
            remotePath: settings.remotePath,
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
      let manager = activeSyncManager;
      if (!manager || !manager.isInitialized()) {
        manager = new WebDAVSyncManager();
        const connected = await manager.initialize(
          {
            url: settings.url,
            username: settings.username,
            password: settings.password,
            remotePath: settings.remotePath,
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
        serviceName="WebDAV"
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
          {/* URL */}
          <SettingRow
            label="服务器地址"
            isSubSetting
            expandControl
            isLast={false}
          >
            <SettingInput
              aria-label="服务器地址"
              autoCapitalize="none"
              spellCheck={false}
              id="webdav-url"
              type="url"
              value={settings.url}
              onChange={e => onSettingChange('url', e.target.value)}
              placeholder="服务器地址"
            />
          </SettingRow>

          {/* 账号 */}
          <SettingRow label="账号" isSubSetting expandControl isLast={false}>
            <SettingInput
              aria-label="账号"
              autoCapitalize="none"
              spellCheck={false}
              id="webdav-username"
              type="text"
              value={settings.username}
              onChange={e => onSettingChange('username', e.target.value)}
              placeholder="username"
              autoComplete="username"
            />
          </SettingRow>

          {/* 应用密码 */}
          <SettingRow
            label="应用密码"
            isSubSetting
            expandControl
            isLast={false}
          >
            <SettingInput
              aria-label="应用密码"
              autoCapitalize="none"
              spellCheck={false}
              id="webdav-password"
              type="password"
              value={settings.password}
              onChange={e => onSettingChange('password', e.target.value)}
              placeholder="应用密码"
              autoComplete="current-password"
            />
          </SettingRow>

          {/* 远程路径 */}
          <SettingRow
            label="远程目录路径"
            isSubSetting
            expandControl
            isLast={false}
          >
            <SettingInput
              aria-label="远程目录路径"
              autoCapitalize="none"
              spellCheck={false}
              id="webdav-remote-path"
              type="text"
              value={settings.remotePath}
              onChange={e => onSettingChange('remotePath', e.target.value)}
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
    </>
  );
};
