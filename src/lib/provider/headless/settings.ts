import { defaultSettings } from '@/lib/settings/defaultSettings';
import type { AppSettings, RoasterConfig } from '@/lib/data/models';
import { host } from './host';
export { defaultSettings };
export function getSettingsStore() {
  const rows = host<Array<{ data_json: string }>>('sql.query', {
    sql: 'SELECT data_json FROM app_settings WHERE id = ?',
    params: ['main'],
  });
  return {
    settings: {
      ...defaultSettings,
      ...(rows[0] ? JSON.parse(rows[0].data_json) : {}),
    } as AppSettings,
  };
}
export function getRoasterConfigSync(name: string): RoasterConfig | undefined {
  return getSettingsStore().settings.roasterConfigs?.find(
    config => config.roasterName === name
  );
}
export function getRoasterConfigsSync() {
  return getSettingsStore().settings.roasterConfigs ?? [];
}
