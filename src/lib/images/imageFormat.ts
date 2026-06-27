export const APP_IMAGE_MIME_TYPE = 'image/webp';
export const JPEG_IMAGE_MIME_TYPE = 'image/jpeg';
export const PNG_IMAGE_MIME_TYPE = 'image/png';
export const WEBP_IMAGE_MIME_TYPE = 'image/webp';
export const GIF_IMAGE_MIME_TYPE = 'image/gif';

const HEIF_IMAGE_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  jpg: JPEG_IMAGE_MIME_TYPE,
  jpeg: JPEG_IMAGE_MIME_TYPE,
  png: PNG_IMAGE_MIME_TYPE,
  webp: WEBP_IMAGE_MIME_TYPE,
  gif: GIF_IMAGE_MIME_TYPE,
  heic: 'image/heic',
  heif: 'image/heif',
  hif: 'image/heif',
};

export const SUPPORTED_SOURCE_IMAGE_MIME_TYPES = [
  JPEG_IMAGE_MIME_TYPE,
  PNG_IMAGE_MIME_TYPE,
  WEBP_IMAGE_MIME_TYPE,
  GIF_IMAGE_MIME_TYPE,
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
] as const;

export const IMAGE_FILE_ACCEPT = SUPPORTED_SOURCE_IMAGE_MIME_TYPES.join(',');

const SUPPORTED_SOURCE_IMAGE_MIME_TYPE_SET = new Set<string>(
  SUPPORTED_SOURCE_IMAGE_MIME_TYPES
);

export const getAppImageFileName = (fileName: string): string =>
  /\.[^/.]+$/.test(fileName)
    ? fileName.replace(/\.[^/.]+$/, '.webp')
    : `${fileName}.webp`;

export const getThumbnailMimeType = (dataUrl: string): string =>
  dataUrl.startsWith(`data:${JPEG_IMAGE_MIME_TYPE}`)
    ? JPEG_IMAGE_MIME_TYPE
    : APP_IMAGE_MIME_TYPE;

export function normalizeImageMimeType(file: Pick<File, 'name' | 'type'>) {
  const declaredType = file.type.trim().toLowerCase();

  if (declaredType === 'image/jpg') {
    return JPEG_IMAGE_MIME_TYPE;
  }

  if (SUPPORTED_SOURCE_IMAGE_MIME_TYPE_SET.has(declaredType)) {
    return declaredType;
  }

  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension
    ? MIME_TYPE_BY_EXTENSION[extension] || declaredType
    : declaredType;
}

export function isSupportedSourceImageFile(file: Pick<File, 'name' | 'type'>) {
  const mimeType = normalizeImageMimeType(file);
  return SUPPORTED_SOURCE_IMAGE_MIME_TYPE_SET.has(mimeType);
}

export function isHeifImageMimeType(mimeType: string) {
  return HEIF_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

export function getImageFormatFromMimeType(mimeType: string) {
  if (mimeType === JPEG_IMAGE_MIME_TYPE) return 'jpeg';
  if (mimeType === PNG_IMAGE_MIME_TYPE) return 'png';
  if (mimeType === WEBP_IMAGE_MIME_TYPE) return 'webp';
  if (mimeType === GIF_IMAGE_MIME_TYPE) return 'gif';
  if (mimeType === 'image/heif' || mimeType === 'image/heif-sequence') {
    return 'heif';
  }
  if (mimeType === 'image/heic' || mimeType === 'image/heic-sequence') {
    return 'heic';
  }
  return mimeType.split('/')[1] || 'jpeg';
}
