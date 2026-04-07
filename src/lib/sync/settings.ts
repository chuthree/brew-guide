import type { SettingsOptions } from '@/lib/core/db';
import type { CloudProvider } from './types';

export type ManualSyncProvider = Exclude<CloudProvider, 'supabase'>;
type ConcreteManualSyncProvider = Exclude<ManualSyncProvider, 'none'>;

const MANUAL_SYNC_PROVIDERS: ConcreteManualSyncProvider[] = ['s3', 'webdav'];

function hasOwnProperty<K extends PropertyKey>(
  value: object,
  key: K
): value is Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isActiveSyncType(value: unknown): value is CloudProvider {
  return (
    value === 'none' ||
    value === 's3' ||
    value === 'webdav' ||
    value === 'supabase'
  );
}

function isManualSyncProvider(value: unknown): value is ManualSyncProvider {
  return value === 'none' || value === 's3' || value === 'webdav';
}

function inferLegacyActiveSyncType(
  settings: Partial<SettingsOptions>
): CloudProvider {
  if (settings.supabaseSync?.enabled) return 'supabase';
  if (settings.s3Sync?.enabled) return 's3';
  if (settings.webdavSync?.enabled) return 'webdav';
  return 'none';
}

function isManualProviderEnabled(
  settings: Partial<SettingsOptions>,
  provider: ConcreteManualSyncProvider
): boolean {
  if (provider === 's3') return settings.s3Sync?.enabled === true;
  return settings.webdavSync?.enabled === true;
}

function inferLegacySupabaseBackupProvider(
  settings: Partial<SettingsOptions>
): ManualSyncProvider {
  const connectedProviders = MANUAL_SYNC_PROVIDERS.filter(provider =>
    isProviderConnected(settings as SettingsOptions, provider)
  );
  if (connectedProviders.length === 1) {
    return connectedProviders[0];
  }

  const enabledProviders = MANUAL_SYNC_PROVIDERS.filter(provider =>
    isManualProviderEnabled(settings, provider)
  );
  if (enabledProviders.length === 1) {
    return enabledProviders[0];
  }

  return 'none';
}

export function normalizeSyncSettings<T extends Partial<SettingsOptions>>(
  settings: T
): T & {
  activeSyncType: CloudProvider;
  supabaseBackupProvider: ManualSyncProvider;
} {
  const activeSyncType = hasOwnProperty(settings, 'activeSyncType')
    ? getResolvedActiveSyncType(settings)
    : inferLegacyActiveSyncType(settings);

  const supabaseBackupProvider = hasOwnProperty(settings, 'supabaseBackupProvider')
    ? getSupabaseBackupProvider(settings)
    : activeSyncType === 'supabase'
      ? inferLegacySupabaseBackupProvider(settings)
      : 'none';

  return {
    ...settings,
    activeSyncType,
    supabaseBackupProvider,
  };
}

export function getResolvedActiveSyncType(
  settings: Partial<SettingsOptions>
): CloudProvider {
  return isActiveSyncType(settings.activeSyncType)
    ? settings.activeSyncType
    : inferLegacyActiveSyncType(settings);
}

export function getSupabaseBackupProvider(
  settings: Partial<SettingsOptions>
): ManualSyncProvider {
  const provider = settings.supabaseBackupProvider;
  return isManualSyncProvider(provider) ? provider : 'none';
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
