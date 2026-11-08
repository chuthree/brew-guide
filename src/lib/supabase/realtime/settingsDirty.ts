/** Shared durable hint used by live changes and recovered business publications. */
const SETTINGS_DIRTY_KEY = 'brew-guide:realtime-sync:settingsDirty';

export function hasDirtySettings(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    localStorage.getItem(SETTINGS_DIRTY_KEY) === '1'
  );
}

/** False means no storage is available; callers with an outbox must retain it. */
export function markSettingsDirty(): boolean {
  if (typeof localStorage === 'undefined') return false;
  localStorage.setItem(SETTINGS_DIRTY_KEY, '1');
  return true;
}

export function clearSettingsDirty(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(SETTINGS_DIRTY_KEY);
}
