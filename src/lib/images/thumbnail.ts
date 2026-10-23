import { getThumbnailMimeType } from '@/lib/images/imageFormat';

import {
  DEFAULT_THUMBNAIL_MAX_SIZE,
  DEFAULT_THUMBNAIL_QUALITY,
  MAX_THUMBNAIL_SOURCE_DATA_URL_CHARS,
  getUsableThumbnailDataUrl,
} from './thumbnailPolicy';
export * from './thumbnailPolicy';

export async function createImageThumbnailDataUrl(
  dataUrl: string,
  options: {
    maxSize?: number;
    quality?: number;
    maxSourceChars?: number;
  } = {}
): Promise<string | undefined> {
  if (
    typeof window === 'undefined' ||
    typeof Image === 'undefined' ||
    dataUrl.length >
      (options.maxSourceChars ?? MAX_THUMBNAIL_SOURCE_DATA_URL_CHARS)
  ) {
    return undefined;
  }

  const {
    maxSize = DEFAULT_THUMBNAIL_MAX_SIZE,
    quality = DEFAULT_THUMBNAIL_QUALITY,
  } = options;

  return new Promise(resolve => {
    const image = new Image();

    image.onload = () => {
      try {
        const ratio = Math.min(
          1,
          maxSize / Math.max(image.width, image.height)
        );
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
          resolve(undefined);
          return;
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, width, height);
        const thumbnail = canvas.toDataURL(
          getThumbnailMimeType(dataUrl),
          quality
        );
        resolve(getUsableThumbnailDataUrl(thumbnail));
      } catch {
        resolve(undefined);
      }
    };

    image.onerror = () => resolve(undefined);
    image.src = dataUrl;
  });
}
