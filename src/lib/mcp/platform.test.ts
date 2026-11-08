import { describe, expect, it, vi } from 'vitest';
import type { AppRuntimeInfo } from '@/lib/app/runtime';
const host = vi.hoisted(() => ({
  runtime: { runtime: 'tauri', capacitorPlatform: null } as AppRuntimeInfo,
}));
vi.mock('@/lib/app/runtime', () => ({ detectAppRuntime: () => host.runtime }));
vi.mock('@/lib/data/sqlite/tauriSqliteDriver', () => ({
  openTauriSqliteDriver: async () => 'tauri-db',
}));
vi.mock('@/lib/data/sqlite/capacitorSqliteDriver', () => ({
  openCapacitorSqliteDriver: async () => 'capacitor-db',
}));
vi.mock('@/lib/data/images/tauriImageFileStore', () => ({
  createTauriImageFileStore: async () => 'tauri-images',
}));
vi.mock('@/lib/data/images/capacitorAndroidImageFileStore', () => ({
  createCapacitorAndroidImageFileStore: async () => 'android-images',
}));
vi.mock('@/lib/data/images/capacitorImageFileStore', () => ({
  createCapacitorImageFileStore: async () => 'ios-images',
}));
import {
  openBusinessSqliteDriver,
  createBusinessImageFileStore,
} from './platform';
describe('Business native storage ports', () => {
  it('retains desktop storage and selects Android/iOS image stores', async () => {
    expect(await openBusinessSqliteDriver()).toBe('tauri-db');
    expect(await createBusinessImageFileStore()).toBe('tauri-images');
    host.runtime = { runtime: 'capacitor', capacitorPlatform: 'android' };
    expect(await openBusinessSqliteDriver()).toBe('capacitor-db');
    expect(await createBusinessImageFileStore()).toBe('android-images');
    host.runtime = { runtime: 'capacitor', capacitorPlatform: 'ios' };
    expect(await openBusinessSqliteDriver()).toBe('capacitor-db');
    expect(await createBusinessImageFileStore()).toBe('ios-images');
  });
  it('does not open native storage for hosted Capacitor shells', async () => {
    host.runtime = {
      runtime: 'capacitor',
      capacitorPlatform: 'android',
      capacitorBundled: false,
    };
    await expect(openBusinessSqliteDriver()).rejects.toThrow(
      'hosted web shell'
    );
    await expect(createBusinessImageFileStore()).rejects.toThrow(
      'hosted web shell'
    );
  });
});
