/**
 * 云同步设置类型和辅助函数
 *
 * 2025-12-21 简化：移除未使用的 hook，只保留类型定义和辅助函数
 */

import type { SettingsOptions } from '@/components/settings/Settings';

// ============================================
// 类型定义
// ============================================

/** 云同步服务类型 */
export type CloudSyncType = 'none' | 's3' | 'webdav' | 'supabase';

/** S3 同步设置 */
export type S3SyncSettings = NonNullable<SettingsOptions['s3Sync']>;

/** WebDAV 同步设置 */
export type WebDAVSyncSettings = NonNullable<SettingsOptions['webdavSync']>;

/** Supabase 同步设置 */
export type SupabaseSyncSettings = NonNullable<SettingsOptions['supabaseSync']>;

// ============================================
// 默认设置
// ============================================

export const defaultS3Settings: S3SyncSettings = {
  enabled: false,
  accessKeyId: '',
  secretAccessKey: '',
  region: 'cn-south-1',
  bucketName: '',
  prefix: 'brew-guide-data/',
  endpoint: '',
  syncMode: 'manual',
  enablePullToSync: true,
};

export const defaultWebDAVSettings: WebDAVSyncSettings = {
  enabled: false,
  url: '',
  username: '',
  password: '',
  remotePath: 'brew-guide-data/',
  syncMode: 'manual',
  enablePullToSync: true,
};

export const defaultSupabaseSettings: SupabaseSyncSettings = {
  enabled: false,
  url: '',
  anonKey: '',
};

// ============================================
// 规范化函数
// ============================================

/**
 * 规范化 S3 设置（确保所有字段都有值）
 */
export function normalizeS3Settings(
  incoming?: SettingsOptions['s3Sync'] | null
): S3SyncSettings {
  if (!incoming) return { ...defaultS3Settings };

  // 移除已废弃的字段
  const sanitized = { ...incoming } as Record<string, unknown>;
  delete sanitized.autoSync;
  delete sanitized.syncInterval;

  return {
    ...defaultS3Settings,
    ...(sanitized as Partial<S3SyncSettings>),
    syncMode: 'manual', // 强制手动模式
    endpoint: (sanitized.endpoint as string) || '',
  };
}

/**
 * 规范化 WebDAV 设置
 */
export function normalizeWebDAVSettings(
  incoming?: SettingsOptions['webdavSync'] | null
): WebDAVSyncSettings {
  if (!incoming) return { ...defaultWebDAVSettings };

  return {
    ...defaultWebDAVSettings,
    ...incoming,
    syncMode: 'manual', // 强制手动模式
  };
}

/**
 * 规范化 Supabase 设置
 */
export function normalizeSupabaseSettings(
  incoming?: SettingsOptions['supabaseSync'] | null
): SupabaseSyncSettings {
  if (!incoming) return { ...defaultSupabaseSettings };

  return {
    ...defaultSupabaseSettings,
    ...incoming,
  };
}
