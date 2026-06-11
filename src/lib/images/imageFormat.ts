export const APP_IMAGE_MIME_TYPE = 'image/webp';
export const JPEG_IMAGE_MIME_TYPE = 'image/jpeg';

export const getAppImageFileName = (fileName: string): string =>
  /\.[^/.]+$/.test(fileName)
    ? fileName.replace(/\.[^/.]+$/, '.webp')
    : `${fileName}.webp`;

export const getThumbnailMimeType = (dataUrl: string): string =>
  dataUrl.startsWith(`data:${JPEG_IMAGE_MIME_TYPE}`)
    ? JPEG_IMAGE_MIME_TYPE
    : APP_IMAGE_MIME_TYPE;
