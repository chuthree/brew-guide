export const RECOGNITION_UPLOAD_CONFIG = {
  allowedTypes: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ],
  maxSize: 5 * 1024 * 1024,
} as const;

export function validateRecognitionImageFile(file: File): void {
  const allowedTypes = RECOGNITION_UPLOAD_CONFIG.allowedTypes as readonly string[];

  if (!allowedTypes.includes(file.type)) {
    throw new Error('不支持的文件类型，请上传 JPG、PNG 或 HEIF 图片');
  }

  if (file.size > RECOGNITION_UPLOAD_CONFIG.maxSize) {
    const maxSizeMB = RECOGNITION_UPLOAD_CONFIG.maxSize / (1024 * 1024);
    throw new Error(`文件过大，请上传不超过 ${maxSizeMB}MB 的图片`);
  }

  if (
    file.name.includes('..') ||
    file.name.includes('/') ||
    file.name.includes('\\')
  ) {
    throw new Error('文件名包含非法字符');
  }
}
