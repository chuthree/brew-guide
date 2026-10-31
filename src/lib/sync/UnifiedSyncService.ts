/**
 * 统一同步服务
 */

import type { SettingsOptions } from '@/lib/data/models';
import type { SyncDirection, SyncProgress } from './types';
import type { ISyncManager, ISyncResult } from './interfaces';
import { createFailureResult, BaseSyncManagerAdapter } from './interfaces';
import { getConnectedManualSyncProvider } from './settings';
import type { ManualSyncProvider } from './settings';

interface ManagerCache {
  provider: ManualSyncProvider;
  manager: ISyncManager;
  hash: string;
}

function hash(o: object): string {
  return JSON.stringify(o);
}

class UnifiedSyncService {
  private cache: ManagerCache | null = null;

  getManualProvider(settings: SettingsOptions): ManualSyncProvider {
    return getConnectedManualSyncProvider(settings);
  }

  private async getManager(
    settings: SettingsOptions,
    provider: ManualSyncProvider,
    options: { skipConnectionTest?: boolean } = {}
  ): Promise<ISyncManager | null> {
    if (provider === 'none') return null;

    const config = this.buildConfig(settings, provider);
    if (!config) return null;

    const configHash = hash(config);

    if (
      this.cache?.provider === provider &&
      this.cache.hash === configHash
    ) {
      return this.cache.manager;
    }

    this.cache = null;

    const manager = await this.createManager(
      provider,
      config,
      options.skipConnectionTest === true
    );
    if (!manager) return null;

    this.cache = { provider, manager, hash: configHash };
    return manager;
  }

  private buildConfig(
    settings: SettingsOptions,
    provider: ManualSyncProvider
  ): object | null {
    switch (provider) {
      case 's3':
        return settings.s3Sync
          ? {
              region: settings.s3Sync.region,
              accessKeyId: settings.s3Sync.accessKeyId,
              secretAccessKey: settings.s3Sync.secretAccessKey,
              bucketName: settings.s3Sync.bucketName,
              prefix: settings.s3Sync.prefix,
              endpoint: settings.s3Sync.endpoint,
              proxyUrl: settings.s3Sync.proxyUrl,
            }
          : null;
      case 'webdav':
        return settings.webdavSync
          ? {
              url: settings.webdavSync.url,
              username: settings.webdavSync.username,
              password: settings.webdavSync.password,
              remotePath: settings.webdavSync.remotePath,
              proxyUrl: settings.webdavSync.proxyUrl,
            }
          : null;
      default:
        return null;
    }
  }

  private async createManager(
    provider: ManualSyncProvider,
    config: object,
    skipConnectionTest: boolean
  ): Promise<ISyncManager | null> {
    switch (provider) {
      case 's3': {
        const { S3SyncManager } = await import('@/lib/s3/syncManagerV2');
        const mgr = new S3SyncManager();
        const ok = await mgr.initialize(config as never, skipConnectionTest);
        return ok ? new BaseSyncManagerAdapter(mgr) : null;
      }
      case 'webdav': {
        const { WebDAVSyncManager } = await import('@/lib/webdav/syncManager');
        const mgr = new WebDAVSyncManager();
        const ok = await mgr.initialize(config as never, skipConnectionTest);
        return ok ? new BaseSyncManagerAdapter(mgr) : null;
      }
      default:
        return null;
    }
  }

  async sync(
    settings: SettingsOptions,
    direction: SyncDirection,
    onProgress?: (p: SyncProgress) => void
  ): Promise<ISyncResult> {
    const provider = this.getManualProvider(settings);
    if (provider === 'none') return createFailureResult('未配置云同步服务');

    const manager = await this.getManager(settings, provider, {
      skipConnectionTest: true,
    });
    if (!manager) return createFailureResult('同步服务初始化失败');

    return manager.sync({ direction, onProgress });
  }
}

export const syncService = new UnifiedSyncService();
