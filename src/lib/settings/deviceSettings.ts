import type { AppSettings } from '@/lib/data/models';

/** 字体大小和安全区域随设备保存，不参与云备份或跨设备同步。 */
export function omitDeviceSettings(settings: Partial<AppSettings>) {
  const {
    textZoomLevel: _textZoomLevel,
    safeAreaMargins: _safeAreaMargins,
    ...sharedSettings
  } = settings;

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
  const settings: Partial<AppSettings> = omitDeviceSettings(incoming);
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
