import { Capacitor } from '@capacitor/core';
import { createCapacitorImageFileStore } from './capacitorImageFileStore';

/** Compatibility entry point for Android diagnostics. */
export async function createCapacitorAndroidImageFileStore() {
  const platform = Capacitor.getPlatform();
  if (platform !== 'android')
    throw new Error(
      `Capacitor Android image file storage is unavailable on platform ${platform}`
    );
  return createCapacitorImageFileStore();
}
