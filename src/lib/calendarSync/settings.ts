import type { AppSettings } from '../core/db';

export interface CoffeeBeanCalendarSyncSettings {
  enabled: boolean;
  syncAgingPeriod: boolean;
  syncFlavorPeriod: boolean;
}

export const defaultCalendarSyncSettings: CoffeeBeanCalendarSyncSettings = {
  enabled: false,
  syncAgingPeriod: false,
  syncFlavorPeriod: true,
};

export const normalizeCalendarSyncSettings = (
  settings?: Partial<CoffeeBeanCalendarSyncSettings> | null
): CoffeeBeanCalendarSyncSettings => ({
  ...defaultCalendarSyncSettings,
  ...(settings || {}),
});

export const getCalendarSyncSettings = (
  settings: AppSettings
): CoffeeBeanCalendarSyncSettings =>
  normalizeCalendarSyncSettings(settings.calendarSync);
