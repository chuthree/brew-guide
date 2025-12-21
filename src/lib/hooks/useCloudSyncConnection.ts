/**
 * 云同步连接状态 Hook（简化版）
 *
 * 不主动建立连接，只提供状态管理和同步功能
 */

import { useState, useCallback } from 'react';
import type { SettingsOptions } from '@/components/settings/Settings';

export type CloudSyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';
export type CloudSyncProvider = 'none' | 's3' | 'webdav' | 'supabase';

interface UseCloudSyncConnectionReturn {
  status: CloudSyncStatus;
  provider: CloudSyncProvider;
  isSyncing: boolean;
  setIsSyncing: (syncing: boolean) => void;
  refresh: () => Promise<void>;
  performSync: (direction: 'upload' | 'download') => Promise<void>;
}

/**
 * 获取当前启用的云同步提供商
 */
function getEnabledProvider(settings: SettingsOptions): CloudSyncProvider {
  const activeType = settings.activeSyncType;
  if (!activeType || activeType === 'none') return 'none';

  // 检查对应服务是否已成功连接过
  if (activeType === 'supabase' && settings.supabaseSync?.lastConnectionSuccess)
    return 'supabase';
  if (activeType === 's3' && settings.s3Sync?.lastConnectionSuccess)
    return 's3';
  if (activeType === 'webdav' && settings.webdavSync?.lastConnectionSuccess)
    return 'webdav';
  return 'none';
}

/**
 * 云同步连接状态 Hook
 */
export function useCloudSyncConnection(
  settings: SettingsOptions,
  _isOpen: boolean
): UseCloudSyncConnectionReturn {
  const provider = getEnabledProvider(settings);
  const status: CloudSyncStatus =
    provider !== 'none' ? 'connected' : 'disconnected';
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {}, []);

  const performSync = useCallback(
    async (direction: 'upload' | 'download') => {
      if (isSyncing || provider === 'none') return;

      const { showToast } = await import(
        '@/components/common/feedback/LightToast'
      );
      const hapticsUtils = (await import('@/lib/ui/haptics')).default;

      try {
        setIsSyncing(true);

        if (provider === 'supabase') {
          const { simpleSyncService } = await import(
            '@/lib/supabase/simpleSyncService'
          );
          const result =
            direction === 'upload'
              ? await simpleSyncService.uploadAllData()
              : await simpleSyncService.downloadAllData();

          if (result.success) {
            const count =
              result.uploaded > 0 ? result.uploaded : result.downloaded;
            if (count > 0) {
              showToast({
                type: 'success',
                title:
                  direction === 'upload'
                    ? `已上传 ${count} 项到云端`
                    : `已从云端下载 ${count} 项，即将重启...`,
                duration: 2500,
              });
              if (direction === 'download')
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
            showToast({ type: 'error', title: result.message, duration: 3000 });
          }
        } else if (provider === 's3') {
          const { S3SyncManager } = await import('@/lib/s3/syncManagerV2');
          const cfg = settings.s3Sync!;
          const mgr = new S3SyncManager();
          const ok = await mgr.initialize({
            region: cfg.region,
            accessKeyId: cfg.accessKeyId,
            secretAccessKey: cfg.secretAccessKey,
            bucketName: cfg.bucketName,
            prefix: cfg.prefix,
            endpoint: cfg.endpoint || undefined,
          });
          if (!ok) throw new Error('S3 连接失败');
          const result = await mgr.sync({ preferredDirection: direction });
          handleFileSyncResult(
            result,
            showToast,
            settings.hapticFeedback,
            hapticsUtils
          );
        } else if (provider === 'webdav') {
          const { WebDAVSyncManager } = await import(
            '@/lib/webdav/syncManager'
          );
          const cfg = settings.webdavSync!;
          const mgr = new WebDAVSyncManager();
          const ok = await mgr.initialize({
            url: cfg.url,
            username: cfg.username,
            password: cfg.password,
            remotePath: cfg.remotePath,
          });
          if (!ok) throw new Error('WebDAV 连接失败');
          const result = await mgr.sync({ preferredDirection: direction });
          handleFileSyncResult(
            result,
            showToast,
            settings.hapticFeedback,
            hapticsUtils
          );
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
    [isSyncing, provider, settings]
  );

  return { status, provider, isSyncing, setIsSyncing, refresh, performSync };
}

// 处理文件同步结果
function handleFileSyncResult(
  result: {
    success: boolean;
    uploadedFiles?: number;
    downloadedFiles?: number;
    message?: string;
  },
  showToast: (opts: {
    type: 'success' | 'error' | 'info' | 'warning';
    title: string;
    duration: number;
  }) => void,
  hapticFeedback: boolean | undefined,
  hapticsUtils: { medium: () => void }
) {
  if (result.success) {
    const up = result.uploadedFiles ?? 0;
    const down = result.downloadedFiles ?? 0;
    if (up > 0 && down > 0) {
      showToast({
        type: 'success',
        title: `同步完成：上传 ${up} 项，下载 ${down} 项，即将重启...`,
        duration: 3000,
      });
      setTimeout(() => window.location.reload(), 3000);
    } else if (up > 0) {
      showToast({
        type: 'success',
        title: `已上传 ${up} 项到云端`,
        duration: 2500,
      });
    } else if (down > 0) {
      showToast({
        type: 'success',
        title: `已从云端下载 ${down} 项，即将重启...`,
        duration: 2500,
      });
      setTimeout(() => window.location.reload(), 2500);
    } else {
      showToast({ type: 'info', title: '数据已是最新', duration: 2000 });
    }
    if (hapticFeedback) hapticsUtils.medium();
  } else {
    showToast({
      type: 'error',
      title: result.message || '同步失败',
      duration: 3000,
    });
  }
}
