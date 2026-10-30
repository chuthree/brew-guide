import type { AppSettings } from '@/lib/data/models';

const LOCAL_SYNC_SETTINGS = [
  's3Sync',
  'webdavSync',
  'supabaseSync',
  'activeSyncType',
  'supabaseBackupProvider',
] as const;

/** 连接配置只保存在本机，导出时不携带账号、密码和代理密钥。 */
export function omitSyncConnectionSettings<T extends Partial<AppSettings>>(
  settings: T
): T {
  const shared = { ...settings };
  for (const key of LOCAL_SYNC_SETTINGS) delete shared[key];
  return shared;
}

export function preserveSyncConnectionSettings<T extends Partial<AppSettings>>(
  incoming: T,
  local: Partial<AppSettings>
): T {
  const settings = omitSyncConnectionSettings(incoming);
  for (const key of LOCAL_SYNC_SETTINGS) {
    if (local[key] !== undefined)
      Object.assign(settings, { [key]: local[key] });
  }
  return settings;
}

/** 字体大小、安全区域及连接配置随设备保存，不参与跨设备同步。 */
export function omitDeviceSettings(settings: Partial<AppSettings>) {
  const {
    textZoomLevel: _textZoomLevel,
    safeAreaMargins: _safeAreaMargins,
    ...sharedSettings
  } = omitSyncConnectionSettings(settings);

  if (sharedSettings.layoutSettings) {
    const { dataFontSize: _dataFontSize, ...sharedLayout } =
      sharedSettings.layoutSettings;
    sharedSettings.layoutSettings = sharedLayout;
  }

  return sharedSettings;
}

/** 同时兼容含设备设置的旧备份；本地无设置时留给设置存储补默认值。 */
export function preserveDeviceSettings(
  incoming: Partial<AppSettings>,
  local: Partial<AppSettings>
): Partial<AppSettings> {
  const settings: Partial<AppSettings> = preserveSyncConnectionSettings(
    omitDeviceSettings(incoming),
    local
  );
  if (local.textZoomLevel !== undefined) {
    settings.textZoomLevel = local.textZoomLevel;
  }
  if (local.safeAreaMargins !== undefined) {
    settings.safeAreaMargins = local.safeAreaMargins;
  }
  if (local.layoutSettings?.dataFontSize !== undefined) {
    settings.layoutSettings = {
      ...settings.layoutSettings,
      dataFontSize: local.layoutSettings.dataFontSize,
    };
  }
  return settings;
}
