/** Platform-independent thumbnail limits and validation. */
export const DEFAULT_THUMBNAIL_MAX_SIZE = 192;
export const DEFAULT_THUMBNAIL_QUALITY = 0.72;
export const MAX_THUMBNAIL_DATA_URL_CHARS = 512 * 1024;
export const MAX_THUMBNAIL_SOURCE_DATA_URL_CHARS = 8 * 1024 * 1024;

export const getUsableThumbnailDataUrl = (
  thumbnail: string | undefined
): string | undefined =>
  thumbnail && thumbnail.length <= MAX_THUMBNAIL_DATA_URL_CHARS
    ? thumbnail
    : undefined;
