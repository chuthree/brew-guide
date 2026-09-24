import { Capacitor } from '@capacitor/core';

export type AppRuntime = 'web' | 'capacitor' | 'tauri';

export interface AppRuntimeInfo {
  runtime: AppRuntime;
  capacitorPlatform: 'android' | 'ios' | 'unknown' | null;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/** Detect the app shell without importing any storage implementation. */
export function detectAppRuntime(): AppRuntimeInfo {
  // Tauri is checked first so a WebView or an injected Capacitor API cannot
  // cause the desktop shell to be treated as Capacitor Native.
  if (isTauriRuntime()) {
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

  return { runtime: 'capacitor', capacitorPlatform };
}
