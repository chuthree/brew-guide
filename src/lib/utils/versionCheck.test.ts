import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdates } from './versionCheck';

const appConfig = vi.hoisted(() => ({ APP_VERSION: '1.7.1-beta.1' }));
vi.mock('@/lib/core/config', () => appConfig);

afterEach(() => {
  vi.unstubAllGlobals();
  appConfig.APP_VERSION = '1.7.1-beta.1';
});

describe('updates from the Android beta', () => {
  it.each([
    ['1.7.0', false],
    ['1.7.1-beta.0', false],
    ['1.7.1-beta.1', false],
    ['1.7.1-beta.1.1', true],
    ['1.7.1-beta.2', true],
    ['1.7.1-beta.10', true],
    ['1.7.1-rc.1', true],
    ['1.7.1', true],
    ['1.7.2', true],
  ])('detects %s as an update: %s', async (version, hasUpdate) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version }),
      })
    );

    await expect(checkForUpdates()).resolves.toMatchObject({
      currentVersion: '1.7.1-beta.1',
      latestVersion: version,
      hasUpdate,
    });
  });

  it.each([
    ['1.7.1-beta.2', '1.7.1-beta.10', true],
    ['1.7.1-beta.10', '1.7.1-beta.2', false],
    ['1.7.1-beta.1.1', '1.7.1-beta.1', false],
    ['1.7.1', '1.7.1-beta.10', false],
  ])('compares %s with %s: %s', async (currentVersion, version, hasUpdate) => {
    appConfig.APP_VERSION = currentVersion;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version }),
      })
    );

    await expect(checkForUpdates()).resolves.toMatchObject({
      currentVersion,
      latestVersion: version,
      hasUpdate,
    });
  });
});
