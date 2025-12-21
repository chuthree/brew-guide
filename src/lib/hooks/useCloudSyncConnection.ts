/**
 * 云同步连接状态 Hook
 *
 * 统一管理 S3、WebDAV、Supabase 的连接状态检查
 * 解耦 Settings.tsx 中的云同步逻辑
 */

import { useState, useEffect, useCallback } from 'react';
import type { SettingsOptions } from '@/components/settings/Settings';

export type CloudSyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';
export type CloudSyncProvider = 'none' | 's3' | 'webdav' | 'supabase';

interface UseCloudSyncConnectionReturn {
  /** 当前连接状态 */
  status: CloudSyncStatus;
  /** 当前启用的提供商 */
  provider: CloudSyncProvider;
  /** 是否正在同步 */
  isSyncing: boolean;
  /** 设置同步状态 */
  setIsSyncing: (syncing: boolean) => void;
  /** 手动刷新连接状态 */
  refresh: () => Promise<void>;
  /** 执行快速同步 */
  performSync: (direction: 'upload' | 'download') => Promise<void>;
}

/**
 * 获取当前启用的云同步提供商
 */
function getEnabledProvider(settings: SettingsOptions): CloudSyncProvider {
  // 优先级: supabase > s3 > webdav
  if (
    settings.supabaseSync?.enabled &&
    settings.supabaseSync?.lastConnectionSuccess
  ) {
    return 'supabase';
  }
  if (settings.s3Sync?.enabled && settings.s3Sync?.lastConnectionSuccess) {
    return 's3';
  }
  if (
    settings.webdavSync?.enabled &&
    settings.webdavSync?.lastConnectionSuccess
  ) {
    return 'webdav';
  }
  return 'none';
}

/**
 * 云同步连接状态 Hook
 */
export function useCloudSyncConnection(
  settings: SettingsOptions,
  isOpen: boolean
): UseCloudSyncConnectionReturn {
  const [status, setStatus] = useState<CloudSyncStatus>('disconnected');
  const [provider, setProvider] = useState<CloudSyncProvider>('none');
  const [isSyncing, setIsSyncing] = useState(false);

  // 检查连接状态
  const checkStatus = useCallback(async () => {
    const currentProvider = getEnabledProvider(settings);
    setProvider(currentProvider);

    if (currentProvider === 'none') {
      setStatus('disconnected');
      return;
    }

    setStatus('connecting');

    try {
      let connected = false;

      if (currentProvider === 'supabase') {
        // 检查 Supabase 连接
        const { simpleSyncService } = await import(
          '@/lib/supabase/simpleSyncService'
        );
        const supabaseConfig = settings.supabaseSync!;

        const initialized = simpleSyncService.initialize({
          url: supabaseConfig.url,
          anonKey: supabaseConfig.anonKey,
        });

        if (initialized) {
          connected = await simpleSyncService.testConnection();
        }
      } else if (currentProvider === 's3') {
        // 检查 S3 连接
        const { S3SyncManager } = await import('@/lib/s3/syncManagerV2');
        const s3Config = settings.s3Sync!;

        if (
          s3Config.accessKeyId &&
          s3Config.secretAccessKey &&
          s3Config.bucketName
        ) {
          const manager = new S3SyncManager();
          connected = await manager.initialize({
            region: s3Config.region,
            accessKeyId: s3Config.accessKeyId,
            secretAccessKey: s3Config.secretAccessKey,
            bucketName: s3Config.bucketName,
            prefix: s3Config.prefix,
            endpoint: s3Config.endpoint || undefined,
          });
        }
      } else if (currentProvider === 'webdav') {
        // 检查 WebDAV 连接
        const { WebDAVSyncManager } = await import('@/lib/webdav/syncManager');
        const webdavConfig = settings.webdavSync!;

        if (
          webdavConfig.url &&
          webdavConfig.username &&
          webdavConfig.password
        ) {
          const manager = new WebDAVSyncManager();
          connected = await manager.initialize({
            url: webdavConfig.url,
            username: webdavConfig.username,
            password: webdavConfig.password,
            remotePath: webdavConfig.remotePath,
          });
        }
      }

      setStatus(connected ? 'connected' : 'error');
    } catch (error) {
      console.error('检测云同步状态失败:', error);
      setStatus('error');
    }
  }, [settings.supabaseSync, settings.s3Sync, settings.webdavSync]);

  // 执行快速同步
  const performSync = useCallback(
    async (direction: 'upload' | 'download') => {
      if (isSyncing || status !== 'connected') {
        return;
      }

      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      const hapticsUtils = (await import('@/lib/ui/haptics')).default;

      try {
        setIsSyncing(true);

        if (provider === 'supabase') {
          // Supabase 同步
          const { simpleSyncService } = await import(
            '@/lib/supabase/simpleSyncService'
          );

          const result =
            direction === 'upload'
              ? await simpleSyncService.uploadAllData()
              : await simpleSyncService.downloadAllData();

          if (result.success) {
            if (result.uploaded > 0 || result.downloaded > 0) {
              showToast({
                type: 'success',
                title:
                  direction === 'upload'
                    ? `已上传 ${result.uploaded} 项到云端`
                    : `已从云端下载 ${result.downloaded} 项，即将重启...`,
                duration: 2500,
              });
              if (direction === 'download') {
                setTimeout(() => window.location.reload(), 2500);
              }
            } else {
              showToast({
                type: 'info',
                title: '数据已是最新',
                duration: 2000,
              });
            }
            if (settings.hapticFeedback) hapticsUtils.medium();
          } else {
            showToast({ type: 'error', title: result.message, duration: 3000 });
          }
        } else {
          // S3 或 WebDAV 同步
          let manager: any;
          let connected = false;

          if (provider === 's3') {
            const { S3SyncManager } = await import('@/lib/s3/syncManagerV2');
            const s3Config = settings.s3Sync!;
            manager = new S3SyncManager();
            connected = await manager.initialize({
              region: s3Config.region,
              accessKeyId: s3Config.accessKeyId,
              secretAccessKey: s3Config.secretAccessKey,
              bucketName: s3Config.bucketName,
              prefix: s3Config.prefix,
              endpoint: s3Config.endpoint || undefined,
            });
          } else if (provider === 'webdav') {
            const { WebDAVSyncManager } = await import(
              '@/lib/webdav/syncManager'
            );
            const webdavConfig = settings.webdavSync!;
            manager = new WebDAVSyncManager();
            connected = await manager.initialize({
              url: webdavConfig.url,
              username: webdavConfig.username,
              password: webdavConfig.password,
              remotePath: webdavConfig.remotePath,
            });
          }

          if (!connected || !manager) {
            throw new Error('云同步连接失败');
          }

          const result = await manager.sync({ preferredDirection: direction });

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
              showToast({
                type: 'info',
                title: '数据已是最新',
                duration: 2000,
              });
            }
            if (settings.hapticFeedback) hapticsUtils.medium();
          } else {
            showToast({
              type: 'error',
              title: result.message || '同步失败',
              duration: 3000,
            });
          }
        }
      } catch (error) {
        showToast({
          type: 'error',
          title: `同步失败: ${error instanceof Error ? error.message : '未知错误'}`,
          duration: 3000,
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [isSyncing, status, provider, settings]
  );

  // 监听云同步状态变更事件
  useEffect(() => {
    const handleStatusChange = () => checkStatus();
    window.addEventListener('cloudSyncStatusChange', handleStatusChange);
    return () =>
      window.removeEventListener('cloudSyncStatusChange', handleStatusChange);
  }, [checkStatus]);

  // 页面打开时检查状态
  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen, checkStatus]);

  return {
    status,
    provider,
    isSyncing,
    setIsSyncing,
    refresh: checkStatus,
    performSync,
  };
}
