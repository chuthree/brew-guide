import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkForUpdates } from './versionCheck';

vi.mock('@/lib/core/config', () => ({ APP_VERSION: '1.6.3-beta.1' }));

afterEach(() => vi.unstubAllGlobals());

describe('updates from the Android beta', () => {
  it.each([
    ['1.6.2', false],
    ['1.6.3-beta.1', false],
    ['1.6.3-beta.2', true],
    ['1.6.3', true],
    ['1.6.4', true],
  ])('detects %s as an update: %s', async (version, hasUpdate) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version }),
      })
    );

    await expect(checkForUpdates()).resolves.toMatchObject({
      currentVersion: '1.6.3-beta.1',
      latestVersion: version,
      hasUpdate,
    });
  });
});
