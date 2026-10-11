import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: 'web',
  pluginImportCount: 0,
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => mocks.platform,
  },
}));

vi.mock('@capacitor-community/sqlite', () => {
  mocks.pluginImportCount += 1;
  throw new Error(
    'native SQLite plugin module should not load on this platform'
  );
});

import { openAndroidSqliteDriver } from './androidSqliteDriver';

describe('Android SQLite driver platform isolation', () => {
  beforeEach(() => {
    mocks.pluginImportCount = 0;
  });

  it.each(['web', 'ios', 'electron'])(
    '%s cannot open the Android driver',
    async platform => {
      mocks.platform = platform;
      await expect(openAndroidSqliteDriver()).rejects.toThrow(
        `only available on Capacitor Android; actual platform is ${platform}`
      );
      expect(mocks.pluginImportCount).toBe(0);
    }
  );
});
