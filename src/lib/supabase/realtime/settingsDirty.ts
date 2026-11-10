import { nanoid } from 'nanoid';

/** Shared durable hint used by live changes and recovered business publications. */
const SETTINGS_DIRTY_KEY = 'brew-guide:realtime-sync:settingsDirty';

export function getSettingsDirtyToken(): string | null {
  return typeof localStorage === 'undefined'
    ? null
    : localStorage.getItem(SETTINGS_DIRTY_KEY);
}

export function hasDirtySettings(): boolean {
  // Keep the legacy "1" marker dirty until a successful sync acknowledges it.
  return Boolean(getSettingsDirtyToken());
}

/** False means no storage is available; callers with an outbox must retain it. */
export function markSettingsDirty(): boolean {
  if (typeof localStorage === 'undefined') return false;
  localStorage.setItem(SETTINGS_DIRTY_KEY, nanoid());
  return true;
}

export function clearSettingsDirty(
  expectedToken: string | null = getSettingsDirtyToken()
): void {
  if (typeof localStorage === 'undefined') return;
  // Do not acknowledge edits made after this sync captured its settings.
  if (localStorage.getItem(SETTINGS_DIRTY_KEY) === expectedToken) {
    localStorage.removeItem(SETTINGS_DIRTY_KEY);
  }
}
