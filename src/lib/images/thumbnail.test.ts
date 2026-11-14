import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createImageThumbnailDataUrl,
  getUsableThumbnailDataUrl,
  MAX_THUMBNAIL_DATA_URL_CHARS,
} from './thumbnail';

describe('thumbnail helpers', () => {
  it('rejects oversized thumbnail payloads', () => {
    expect(
      getUsableThumbnailDataUrl('x'.repeat(MAX_THUMBNAIL_DATA_URL_CHARS))
    ).toBe('x'.repeat(MAX_THUMBNAIL_DATA_URL_CHARS));
    expect(
      getUsableThumbnailDataUrl('x'.repeat(MAX_THUMBNAIL_DATA_URL_CHARS + 1))
    ).toBeUndefined();
  });

  it('skips oversized source images before decoding', async () => {
    await expect(
      createImageThumbnailDataUrl('x'.repeat(11), { maxSourceChars: 10 })
    ).resolves.toBeUndefined();
  });
});

describe('createImageThumbnailDataUrl', () => {
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
      createImageThumbnailDataUrl('data:image/jpeg;base64,original')
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
      createImageThumbnailDataUrl('data:image/jpeg;base64,original')
    ).resolves.toBeUndefined();
  });
});
