/**
 * 云同步设置管理 Hook
 *
 * 这个 Hook 提供原子化的云同步设置管理，确保：
 * 1. 同一时间只有一个云同步服务启用
 * 2. 设置变更会立即持久化到 Storage
 * 3. 状态更新是原子的，不会出现竞态问题
 */

import { useCallback, useRef, useMemo } from 'react';
import type { SettingsOptions } from '@/components/settings/Settings';

// 云同步服务类型
export type CloudSyncType = 'none' | 's3' | 'webdav' | 'supabase';

// 类型定义
export type S3SyncSettings = NonNullable<SettingsOptions['s3Sync']>;
export type WebDAVSyncSettings = NonNullable<SettingsOptions['webdavSync']>;
export type SupabaseSyncSettings = NonNullable<SettingsOptions['supabaseSync']>;

// 默认设置
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
  realtimeEnabled: true,
  syncMode: 'realtime',
  enablePullToSync: true,
};

// 规范化设置（确保所有字段都有值）
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
    // 强制 syncMode 为 manual
    syncMode: 'manual',
    // 确保 endpoint 不是 undefined
    endpoint: (sanitized.endpoint as string) || '',
  };
}

export function normalizeWebDAVSettings(
  incoming?: SettingsOptions['webdavSync'] | null
): WebDAVSyncSettings {
  if (!incoming) return { ...defaultWebDAVSettings };

  return {
    ...defaultWebDAVSettings,
    ...incoming,
    // 强制 syncMode 为 manual
    syncMode: 'manual',
  };
}

export function normalizeSupabaseSettings(
  incoming?: SettingsOptions['supabaseSync'] | null
): SupabaseSyncSettings {
  if (!incoming) return { ...defaultSupabaseSettings };

  return {
    ...defaultSupabaseSettings,
    ...incoming,
  };
}

// 获取当前激活的同步类型
export function getActiveSyncType(
  s3: S3SyncSettings,
  webdav: WebDAVSyncSettings,
  supabase: SupabaseSyncSettings
): CloudSyncType {
  // 优先级: supabase > s3 > webdav
  if (supabase.enabled) return 'supabase';
  if (s3.enabled) return 's3';
  if (webdav.enabled) return 'webdav';
  return 'none';
}

interface UseCloudSyncSettingsProps {
  s3Settings: S3SyncSettings;
  webdavSettings: WebDAVSyncSettings;
  supabaseSettings: SupabaseSyncSettings;
  setS3Settings: (settings: S3SyncSettings) => void;
  setWebDAVSettings: (settings: WebDAVSyncSettings) => void;
  setSupabaseSettings: (settings: SupabaseSyncSettings) => void;
  persistSettings: (
    key: 's3Sync' | 'webdavSync' | 'supabaseSync',
    value: S3SyncSettings | WebDAVSyncSettings | SupabaseSyncSettings
  ) => void;
}

/**
 * 云同步设置管理 Hook
 */
export function useCloudSyncSettings({
  s3Settings,
  webdavSettings,
  supabaseSettings,
  setS3Settings,
  setWebDAVSettings,
  setSupabaseSettings,
  persistSettings,
}: UseCloudSyncSettingsProps) {
  // 使用 ref 存储最新状态，避免闭包问题
  const s3Ref = useRef(s3Settings);
  const webdavRef = useRef(webdavSettings);
  const supabaseRef = useRef(supabaseSettings);

  // 保持 ref 同步
  s3Ref.current = s3Settings;
  webdavRef.current = webdavSettings;
  supabaseRef.current = supabaseSettings;

  // 当前激活的同步类型
  const activeSyncType = useMemo(
    () => getActiveSyncType(s3Settings, webdavSettings, supabaseSettings),
    [s3Settings, webdavSettings, supabaseSettings]
  );

  /**
   * 切换同步服务类型
   * 这是一个原子操作，会同时禁用其他服务并启用指定服务
   */
  const switchSyncType = useCallback(
    (type: CloudSyncType) => {
      // 获取当前最新状态
      const currentS3 = s3Ref.current;
      const currentWebDAV = webdavRef.current;
      const currentSupabase = supabaseRef.current;

      // 根据目标类型，设置各服务的 enabled 状态
      const newS3: S3SyncSettings = {
        ...currentS3,
        enabled: type === 's3',
        // 切换时清除连接状态
        lastConnectionSuccess:
          type === 's3' ? currentS3.lastConnectionSuccess : false,
      };

      const newWebDAV: WebDAVSyncSettings = {
        ...currentWebDAV,
        enabled: type === 'webdav',
        lastConnectionSuccess:
          type === 'webdav' ? currentWebDAV.lastConnectionSuccess : false,
      };

      const newSupabase: SupabaseSyncSettings = {
        ...currentSupabase,
        enabled: type === 'supabase',
        lastConnectionSuccess:
          type === 'supabase' ? currentSupabase.lastConnectionSuccess : false,
      };

      // 更新 ref
      s3Ref.current = newS3;
      webdavRef.current = newWebDAV;
      supabaseRef.current = newSupabase;

      // 批量更新状态
      setS3Settings(newS3);
      setWebDAVSettings(newWebDAV);
      setSupabaseSettings(newSupabase);

      // 持久化到存储（三个都要保存以确保一致性）
      persistSettings('s3Sync', newS3);
      persistSettings('webdavSync', newWebDAV);
      persistSettings('supabaseSync', newSupabase);

      console.log('[CloudSync] 切换同步类型:', type, {
        s3Enabled: newS3.enabled,
        webdavEnabled: newWebDAV.enabled,
        supabaseEnabled: newSupabase.enabled,
      });
    },
    [setS3Settings, setWebDAVSettings, setSupabaseSettings, persistSettings]
  );

  /**
   * 更新 S3 设置（不改变 enabled 状态）
   */
  const updateS3Setting = useCallback(
    <K extends keyof S3SyncSettings>(key: K, value: S3SyncSettings[K]) => {
      const current = s3Ref.current;
      const newSettings: S3SyncSettings = {
        ...current,
        [key]: value,
      };

      // 如果修改的是配置参数，清除连接状态
      if (key !== 'enabled' && key !== 'lastConnectionSuccess') {
        newSettings.lastConnectionSuccess = false;
      }

      s3Ref.current = newSettings;
      setS3Settings(newSettings);
      persistSettings('s3Sync', newSettings);
    },
    [setS3Settings, persistSettings]
  );

  /**
   * 更新 WebDAV 设置（不改变 enabled 状态）
   */
  const updateWebDAVSetting = useCallback(
    <K extends keyof WebDAVSyncSettings>(
      key: K,
      value: WebDAVSyncSettings[K]
    ) => {
      const current = webdavRef.current;
      const newSettings: WebDAVSyncSettings = {
        ...current,
        [key]: value,
      };

      if (key !== 'enabled' && key !== 'lastConnectionSuccess') {
        newSettings.lastConnectionSuccess = false;
      }

      webdavRef.current = newSettings;
      setWebDAVSettings(newSettings);
      persistSettings('webdavSync', newSettings);
    },
    [setWebDAVSettings, persistSettings]
  );

  /**
   * 更新 Supabase 设置（不改变 enabled 状态）
   */
  const updateSupabaseSetting = useCallback(
    <K extends keyof SupabaseSyncSettings>(
      key: K,
      value: SupabaseSyncSettings[K]
    ) => {
      const current = supabaseRef.current;
      const newSettings: SupabaseSyncSettings = {
        ...current,
        [key]: value,
      };

      if (
        key !== 'enabled' &&
        key !== 'lastConnectionSuccess' &&
        key !== 'realtimeEnabled'
      ) {
        newSettings.lastConnectionSuccess = false;
      }

      supabaseRef.current = newSettings;
      setSupabaseSettings(newSettings);
      persistSettings('supabaseSync', newSettings);
    },
    [setSupabaseSettings, persistSettings]
  );

  return {
    // 当前状态
    activeSyncType,
    s3Settings,
    webdavSettings,
    supabaseSettings,

    // 操作方法
    switchSyncType,
    updateS3Setting,
    updateWebDAVSetting,
    updateSupabaseSetting,
  };
}
