/**
 * 统一同步服务
 */

import type { SettingsOptions } from '@/lib/core/db';
import type { CloudProvider, SyncDirection, SyncProgress } from './types';
import type { ISyncManager, ISyncResult, ISyncOptions } from './interfaces';
import { createFailureResult, BaseSyncManagerAdapter } from './interfaces';

interface ManagerCache {
  provider: CloudProvider;
  manager: ISyncManager;
  hash: string;
}

function hash(o: object): string {
  return JSON.stringify(o);
}

class UnifiedSyncService {
  private cache: ManagerCache | null = null;

  getActiveProvider(settings: SettingsOptions): CloudProvider {
    const type = settings.activeSyncType;
    if (!type || type === 'none') return 'none';

    const cfg = {
      supabase: settings.supabaseSync,
      s3: settings.s3Sync,
      webdav: settings.webdavSync,
    }[type];
    return cfg?.lastConnectionSuccess ? type : 'none';
  }

  async getManager(
    settings: SettingsOptions,
    provider: CloudProvider
  ): Promise<ISyncManager | null> {
    if (provider === 'none') return null;

    const config = this.buildConfig(settings, provider);
    if (!config) return null;

    const configHash = hash(config);

    if (
      this.cache?.provider === provider &&
      this.cache.hash === configHash &&
      this.cache.manager.isInitialized()
    ) {
      return this.cache.manager;
    }

    this.cache?.manager.disconnect();
    this.cache = null;

    const manager = await this.createManager(provider, config);
    if (!manager) return null;

    this.cache = { provider, manager, hash: configHash };
    return manager;
  }

  private buildConfig(
    settings: SettingsOptions,
    provider: CloudProvider
  ): object | null {
    switch (provider) {
      case 'supabase':
        return settings.supabaseSync
          ? {
              provider: 'supabase',
              url: settings.supabaseSync.url,
              anonKey: settings.supabaseSync.anonKey,
            }
          : null;
      case 's3':
        return settings.s3Sync
          ? {
              region: settings.s3Sync.region,
              accessKeyId: settings.s3Sync.accessKeyId,
              secretAccessKey: settings.s3Sync.secretAccessKey,
              bucketName: settings.s3Sync.bucketName,
              prefix: settings.s3Sync.prefix,
              endpoint: settings.s3Sync.endpoint,
            }
          : null;
      case 'webdav':
        return settings.webdavSync
          ? {
              url: settings.webdavSync.url,
              username: settings.webdavSync.username,
              password: settings.webdavSync.password,
              remotePath: settings.webdavSync.remotePath,
            }
          : null;
      default:
        return null;
    }
  }

  private async createManager(
    provider: CloudProvider,
    config: object
  ): Promise<ISyncManager | null> {
    switch (provider) {
      // Supabase 使用 RealtimeSyncService 自动同步，不再需要手动同步管理器
      case 'supabase':
        return null;
      case 's3': {
        const { S3SyncManager } = await import('@/lib/s3/syncManagerV2');
        const mgr = new S3SyncManager();
        const ok = await mgr.initialize(config as never);
        return ok ? new BaseSyncManagerAdapter('s3', mgr) : null;
      }
      case 'webdav': {
        const { WebDAVSyncManager } = await import('@/lib/webdav/syncManager');
        const mgr = new WebDAVSyncManager();
        const ok = await mgr.initialize(config as never);
        return ok ? new BaseSyncManagerAdapter('webdav', mgr) : null;
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
    const provider = this.getActiveProvider(settings);
    if (provider === 'none') return createFailureResult('未配置云同步服务');

    const manager = await this.getManager(settings, provider);
    if (!manager) return createFailureResult('同步服务初始化失败');

    return manager.sync({ direction, onProgress } as ISyncOptions);
  }

  async testConnection(
    settings: SettingsOptions,
    provider: CloudProvider
  ): Promise<boolean> {
    if (provider === 'none') return false;
    const manager = await this.getManager(settings, provider);
    return manager?.testConnection() ?? false;
  }

  disconnect(): void {
    this.cache?.manager.disconnect();
    this.cache = null;
  }
}

export const syncService = new UnifiedSyncService();
