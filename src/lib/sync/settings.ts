import type { SettingsOptions } from '@/lib/core/db';
import type { CloudProvider } from './types';

export type ManualSyncProvider = Exclude<CloudProvider, 'supabase'>;

export function getResolvedActiveSyncType(
  settings: SettingsOptions
): CloudProvider {
  if (settings.activeSyncType) return settings.activeSyncType;
  if (settings.supabaseSync?.enabled) return 'supabase';
  if (settings.s3Sync?.enabled) return 's3';
  if (settings.webdavSync?.enabled) return 'webdav';
  return 'none';
}

export function getSupabaseBackupProvider(
  settings: SettingsOptions
): ManualSyncProvider {
  const provider = settings.supabaseBackupProvider;
  return provider === 's3' || provider === 'webdav' ? provider : 'none';
}

export function getSelectedManualSyncProvider(
  settings: SettingsOptions
): ManualSyncProvider {
  const activeProvider = getResolvedActiveSyncType(settings);

  if (activeProvider === 's3' || activeProvider === 'webdav') {
    return activeProvider;
  }

  if (activeProvider === 'supabase') {
    return getSupabaseBackupProvider(settings);
  }

  return 'none';
}

export function isProviderConnected(
  settings: SettingsOptions,
  provider: CloudProvider
): boolean {
  switch (provider) {
    case 'supabase':
      return settings.supabaseSync?.lastConnectionSuccess === true;
    case 's3':
      return settings.s3Sync?.lastConnectionSuccess === true;
    case 'webdav':
      return settings.webdavSync?.lastConnectionSuccess === true;
    default:
      return false;
  }
}

export function getConnectedManualSyncProvider(
  settings: SettingsOptions
): ManualSyncProvider {
  const provider = getSelectedManualSyncProvider(settings);
  return isProviderConnected(settings, provider) ? provider : 'none';
}

export function isPullToSyncEnabled(settings: SettingsOptions): boolean {
  const provider = getConnectedManualSyncProvider(settings);

  switch (provider) {
    case 's3':
      return settings.s3Sync?.enablePullToSync !== false;
    case 'webdav':
      return settings.webdavSync?.enablePullToSync !== false;
    default:
      return false;
  }
}

export function getCloudProviderLabel(provider: CloudProvider): string {
  switch (provider) {
    case 's3':
      return 'S3 对象存储';
    case 'webdav':
      return 'WebDAV';
    case 'supabase':
      return 'Supabase 实时同步';
    default:
      return '不使用';
  }
}
