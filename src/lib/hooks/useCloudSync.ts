/**
 * 云同步 Hook
 */

import { useState, useCallback } from 'react';
import type { SettingsOptions } from '@/lib/core/db';
import type { CloudProvider, SyncDirection } from '@/lib/sync/types';
import { syncService } from '@/lib/sync/UnifiedSyncService';
import { showToast } from '@/components/common/feedback/LightToast';
import hapticsUtils from '@/lib/ui/haptics';

export type CloudSyncStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

interface UseCloudSyncReturn {
  status: CloudSyncStatus;
  provider: CloudProvider;
  isSyncing: boolean;
  setIsSyncing: (v: boolean) => void;
  performSync: (direction: SyncDirection) => Promise<void>;
}

export function useCloudSyncConnection(
  settings: SettingsOptions
): UseCloudSyncReturn {
  const provider = syncService.getActiveProvider(settings);
  const status: CloudSyncStatus =
    provider !== 'none' ? 'connected' : 'disconnected';
  const [isSyncing, setIsSyncing] = useState(false);

  const performSync = useCallback(
    async (direction: SyncDirection) => {
      if (isSyncing || provider === 'none') return;

      setIsSyncing(true);
      try {
        const result = await syncService.sync(settings, direction);

        if (result.success) {
          const n =
            direction === 'upload'
              ? result.uploadedCount
              : result.downloadedCount;
          if (n > 0) {
            showToast({
              type: 'success',
              title:
                direction === 'upload'
                  ? `已上传 ${n} 项`
                  : `已下载 ${n} 项，即将重启...`,
              duration: 2500,
            });
            if (direction === 'download')
              setTimeout(() => window.location.reload(), 2500);
          } else {
            showToast({ type: 'info', title: '数据已是最新', duration: 2000 });
          }
          if (settings.hapticFeedback) hapticsUtils.medium();
        } else {
          showToast({ type: 'error', title: result.message, duration: 3000 });
        }
      } catch (e) {
        showToast({
          type: 'error',
          title: `同步失败: ${e instanceof Error ? e.message : '未知错误'}`,
          duration: 3000,
        });
      } finally {
        setIsSyncing(false);
      }
    },
    [isSyncing, provider, settings]
  );

  return { status, provider, isSyncing, setIsSyncing, performSync };
}

export type { CloudProvider };
