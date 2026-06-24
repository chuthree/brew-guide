import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCoffeeBeanImageThumbnail } from './imageRepository';

describe('createCoffeeBeanImageThumbnail', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not return the original image when decoding fails', async () => {
    class FailingImage {
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }

    vi.stubGlobal('window', {});
    vi.stubGlobal('Image', FailingImage);

    await expect(
      createCoffeeBeanImageThumbnail('data:image/jpeg;base64,original')
    ).resolves.toBeUndefined();
  });

  it('rejects oversized thumbnail output instead of caching it', async () => {
    class MockImage {
      width = 100;
      height = 100;
      onload: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    vi.stubGlobal('window', {});
    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage: vi.fn(),
          imageSmoothingEnabled: false,
          imageSmoothingQuality: 'low',
        }),
        toDataURL: () => `data:image/webp;base64,${'a'.repeat(600 * 1024)}`,
      }),
    });

    await expect(
      createCoffeeBeanImageThumbnail('data:image/jpeg;base64,original')
    ).resolves.toBeUndefined();
  });
});
