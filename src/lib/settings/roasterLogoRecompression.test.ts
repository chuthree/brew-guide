import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@/lib/data/models';

const mocks = vi.hoisted(() => {
  const store = {
    settings: {
      roasterConfigs: [],
    } as Partial<AppSettings>,
    updateSettings: vi.fn(async (updates: Partial<AppSettings>) => {
      store.settings = {
        ...store.settings,
        ...updates,
      };
    }),
  };
  const compressBase64Image = vi.fn();

  return {
    store,
    compressBase64Image,
    getSettingsStore: vi.fn(() => store),
  };
});

vi.mock('@/lib/stores/settingsStore', () => ({
  getSettingsStore: mocks.getSettingsStore,
}));
vi.mock('@/lib/utils/imageCompression', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/utils/imageCompression')
  >('@/lib/utils/imageCompression');
  return {
    ...actual,
    compressBase64Image: mocks.compressBase64Image,
  };
});

import { recompressOversizedRoasterLogos } from './roasterLogoRecompression';

describe('roaster logo recompression', () => {
  beforeEach(() => {
    mocks.store.settings = {
      roasterConfigs: [],
    };
    mocks.store.updateSettings.mockClear();
    mocks.compressBase64Image.mockReset();
    mocks.getSettingsStore.mockClear();
  });

  it('recompresses oversized roaster logos through the settings store', async () => {
    const oversizedLogo = `data:image/jpeg;base64,${'a'.repeat(200 * 1024)}`;
    const smallLogo = 'data:image/jpeg;base64,abcd';
    const compressedLogo = `data:image/webp;base64,${'b'.repeat(40 * 1024)}`;

    mocks.store.settings.roasterConfigs = [
      { roasterName: 'Big Logo', logoData: oversizedLogo, updatedAt: 1 },
      { roasterName: 'Small Logo', logoData: smallLogo, updatedAt: 1 },
      { roasterName: 'No Logo', updatedAt: 1 },
    ];
    mocks.compressBase64Image.mockResolvedValue(compressedLogo);

    const stats = await recompressOversizedRoasterLogos();

    expect(mocks.compressBase64Image).toHaveBeenCalledTimes(1);
    expect(mocks.store.updateSettings).toHaveBeenCalledTimes(1);
    expect(mocks.store.settings.roasterConfigs).toEqual([
      expect.objectContaining({
        roasterName: 'Big Logo',
        logoData: compressedLogo,
      }),
      { roasterName: 'Small Logo', logoData: smallLogo, updatedAt: 1 },
      { roasterName: 'No Logo', updatedAt: 1 },
    ]);
    expect(stats).toMatchObject({
      scannedCount: 2,
      candidateCount: 1,
      compressedCount: 1,
      failedCount: 0,
    });
    expect(stats.savedBytes).toBeGreaterThan(0);
  });
});
