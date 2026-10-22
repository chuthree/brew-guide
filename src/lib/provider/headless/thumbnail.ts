import { host } from './host';
import {
  DEFAULT_THUMBNAIL_MAX_SIZE,
  DEFAULT_THUMBNAIL_QUALITY,
  MAX_THUMBNAIL_SOURCE_DATA_URL_CHARS,
  getUsableThumbnailDataUrl,
} from '@/lib/images/thumbnailPolicy';
export * from '@/lib/images/thumbnailPolicy';
export async function createImageThumbnailDataUrl(
  dataUrl: string,
  options: { maxSize?: number; quality?: number; maxSourceChars?: number } = {}
): Promise<string | undefined> {
  if (
    dataUrl.length >
    (options.maxSourceChars ?? MAX_THUMBNAIL_SOURCE_DATA_URL_CHARS)
  )
    return undefined;
  try {
    return getUsableThumbnailDataUrl(
      host<{ compressed: string }>('images.process', {
        dataUrl,
        options: {
          compression: {
            maxSizeMB: 0.1,
            maxWidthOrHeight: options.maxSize ?? DEFAULT_THUMBNAIL_MAX_SIZE,
            initialQuality: options.quality ?? DEFAULT_THUMBNAIL_QUALITY,
          },
        },
      }).compressed
    );
  } catch {
    // Like the UI codec, a failed optional thumbnail does not discard the source.
    return undefined;
  }
}
