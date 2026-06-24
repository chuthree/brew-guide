import { describe, expect, it } from 'vitest';
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
