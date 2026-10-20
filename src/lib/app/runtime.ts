import { Capacitor } from '@capacitor/core';

export type AppRuntime = 'web' | 'capacitor' | 'tauri';

export interface AppRuntimeInfo {
  runtime: AppRuntime;
  capacitorPlatform: 'android' | 'ios' | 'unknown' | null;
  /** False for the OL shell, which loads the hosted app and keeps IndexedDB. */
  capacitorBundled?: boolean;
  /** False for the desktop OL shell; omitted for bundled Tauri apps. */
  tauriBundled?: boolean;
}

export const BUNDLED_WEB_HOSTNAME = 'app';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/** Detect the app shell without importing any storage implementation. */
export function detectAppRuntime(): AppRuntimeInfo {
  // Tauri is checked first so a WebView or an injected Capacitor API cannot
  // cause the desktop shell to be treated as Capacitor Native.
  if (isTauriRuntime()) {
    const location = window.location;
    if (
      (location?.protocol === 'http:' || location?.protocol === 'https:') &&
      !['localhost', 'tauri.localhost', '127.0.0.1', '[::1]'].includes(
        location.hostname
      )
    ) {
      return {
        runtime: 'tauri',
        capacitorPlatform: null,
        tauriBundled: false,
      };
    }
    return { runtime: 'tauri', capacitorPlatform: null };
  }

  let isCapacitorNative = false;
  try {
    isCapacitorNative = Capacitor.isNativePlatform();
  } catch {
    return { runtime: 'web', capacitorPlatform: null };
  }

  if (!isCapacitorNative) {
    return { runtime: 'web', capacitorPlatform: null };
  }

  let capacitorPlatform: AppRuntimeInfo['capacitorPlatform'] = 'unknown';
  try {
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') {
      capacitorPlatform = platform;
    }
  } catch {
    // A native Capacitor shell remains identifiable even if its platform
    // implementation is not one of the currently supported platforms.
  }

  return {
    runtime: 'capacitor',
    capacitorPlatform,
    capacitorBundled:
      typeof window !== 'undefined' &&
      window.location.hostname === BUNDLED_WEB_HOSTNAME,
  };
}
