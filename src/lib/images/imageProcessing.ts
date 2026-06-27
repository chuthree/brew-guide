import {
  GIF_IMAGE_MIME_TYPE,
  isHeifImageMimeType,
  isSupportedSourceImageFile,
  normalizeImageMimeType,
} from '@/lib/images/imageFormat';
import {
  Base64CompressionOptions,
  compressBase64Image,
  readFileAsDataUrl,
} from '@/lib/utils/imageCompression';

const DEFAULT_MAX_IMAGE_SIZE_BYTES = 50 * 1024 * 1024;
export const NOTE_IMAGE_COMPRESSION_OPTIONS = {
  maxSizeMB: 0.1,
  maxWidthOrHeight: 1200,
  initialQuality: 0.8,
} satisfies Base64CompressionOptions;
export const NOTE_IMAGE_MAX_SIZE_BYTES =
  NOTE_IMAGE_COMPRESSION_OPTIONS.maxSizeMB * 1024 * 1024;

type ImageProcessingErrorCode =
  | 'unsupported-type'
  | 'too-large'
  | 'decode-failed'
  | 'read-failed';

interface ImageFailureDiagnostics {
  fileName: string;
  declaredType: string;
  size: string;
  runtime: string;
  reason: string;
}

export class ImageProcessingError extends Error {
  constructor(
    message: string,
    readonly code: ImageProcessingErrorCode,
    readonly file?: File,
    readonly originalError?: unknown,
    readonly diagnostics?: ImageFailureDiagnostics
  ) {
    super(message);
    this.name = 'ImageProcessingError';
  }
}

export interface ImageProcessingOptions {
  maxFileSizeBytes?: number;
  compression?: Base64CompressionOptions;
}

export interface ImageBatchProcessingOptions extends ImageProcessingOptions {
  limit?: number;
}

export interface ImageBatchProcessingResult {
  images: string[];
  errors: ImageProcessingError[];
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return '未知';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)}${units[unitIndex]}`;
}

function getRuntimeLabel() {
  if (typeof navigator === 'undefined') return 'unknown';

  const userAgent = navigator.userAgent || '';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macOS';
  if (/Windows/i.test(userAgent)) return 'Windows';
  return navigator.platform || 'browser';
}

function getErrorReason(error: unknown) {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return `${error.name}: ${error.message || '无详细信息'}`;
  }

  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  return typeof error === 'string' ? error : '未知错误';
}

function getImageFailureDiagnostics(
  file: File,
  error: unknown
): ImageFailureDiagnostics {
  return {
    fileName: file.name || '未命名文件',
    declaredType: file.type || '空',
    size: formatBytes(file.size),
    runtime: getRuntimeLabel(),
    reason: getErrorReason(error),
  };
}

function createImageReadFailedError(file: File, error: unknown) {
  const diagnostics = getImageFailureDiagnostics(file, error);
  return new ImageProcessingError(
    [
      '图片读取失败，请重试',
      `诊断信息：文件=${diagnostics.fileName}，类型=${diagnostics.declaredType}，大小=${diagnostics.size}，平台=${diagnostics.runtime}，原因=${diagnostics.reason}`,
    ].join('\n'),
    'read-failed',
    file,
    error,
    diagnostics
  );
}

export async function processImageFile(
  file: File,
  options: ImageProcessingOptions = {}
) {
  const { maxFileSizeBytes = DEFAULT_MAX_IMAGE_SIZE_BYTES, compression } =
    options;
  const mimeType = normalizeImageMimeType(file);

  if (!isSupportedSourceImageFile(file)) {
    throw new ImageProcessingError(
      '请上传 JPG、PNG、WebP、GIF 或 HEIF/HEIC 格式的图片',
      'unsupported-type',
      file
    );
  }

  if (file.size > maxFileSizeBytes) {
    throw new ImageProcessingError(
      '图片文件过大，请选择小于50MB的图片',
      'too-large',
      file
    );
  }

  let dataUrl: string;
  try {
    dataUrl = await readFileAsDataUrl(file);
  } catch (error) {
    const readError = createImageReadFailedError(file, error);
    console.error('Image file read failed', readError.diagnostics);
    throw readError;
  }

  if (mimeType === GIF_IMAGE_MIME_TYPE) {
    return dataUrl;
  }

  try {
    return await compressBase64Image(dataUrl, compression);
  } catch (error) {
    const message = isHeifImageMimeType(mimeType)
      ? '当前浏览器无法解码 HEIF/HEIC 图片，请在系统相册中转换为 JPG 或 PNG 后再添加'
      : '图片解码或压缩失败，请更换图片后重试';
    throw new ImageProcessingError(message, 'decode-failed', file, error);
  }
}

export async function processImageFiles(
  files: FileList | File[],
  options: ImageBatchProcessingOptions = {}
): Promise<ImageBatchProcessingResult> {
  const selectedFiles = Array.from(files).slice(0, options.limit);
  const result: ImageBatchProcessingResult = {
    images: [],
    errors: [],
  };

  for (const file of selectedFiles) {
    try {
      result.images.push(await processImageFile(file, options));
    } catch (error) {
      result.errors.push(
        error instanceof ImageProcessingError
          ? error
          : new ImageProcessingError(
              '图片处理失败，请更换图片后重试',
              'decode-failed',
              file
            )
      );
    }
  }

  return result;
}

export function getImageProcessingErrorMessage(errors: ImageProcessingError[]) {
  if (errors.length === 0) return '';

  const uniqueMessages = Array.from(
    new Set(errors.map(error => error.message))
  );
  return uniqueMessages.length === 1
    ? uniqueMessages[0]
    : uniqueMessages.join('\n');
}
