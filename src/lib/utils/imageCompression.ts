/**
 * 图片压缩工具
 * 用于在上传前压缩图片，减少网络传输时间
 */

import {
  APP_IMAGE_MIME_TYPE,
  GIF_IMAGE_MIME_TYPE,
  JPEG_IMAGE_MIME_TYPE,
} from '@/lib/images/imageFormat';

const LOSSLESS_METADATA_MIME_TYPES = new Set([
  JPEG_IMAGE_MIME_TYPE,
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

export interface CompressionOptions {
  maxWidth?: number; // 最大宽度，默认 1920
  maxHeight?: number; // 最大高度，默认 1920
  quality?: number; // 图片质量 0-1，默认 0.8
  mimeType?: string; // 输出格式，默认应用内图片格式
  maxSizeMB?: number; // 最大文件大小（MB），如果指定则会循环压缩直到达到目标
}

/**
 * 压缩图片文件
 * @param file 原始图片文件
 * @param options 压缩选项
 * @returns 压缩后的文件
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  if (file.type.toLowerCase() === GIF_IMAGE_MIME_TYPE) {
    return file;
  }

  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.8,
    mimeType = APP_IMAGE_MIME_TYPE,
    maxSizeMB,
  } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = e => {
      const img = new Image();

      img.onload = async () => {
        // 计算压缩后的尺寸
        let { width, height } = img;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        // 创建 canvas 进行压缩
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 canvas context'));
          return;
        }

        // 设置高质量渲染
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 绘制图片
        ctx.drawImage(img, 0, 0, width, height);

        const createBlob = (type: string, outputQuality: number) =>
          new Promise<Blob>((resolveBlob, rejectBlob) => {
            canvas.toBlob(
              blob =>
                blob
                  ? resolveBlob(blob)
                  : rejectBlob(new Error('图片压缩失败')),
              type,
              outputQuality
            );
          });

        const compressOnce = async (outputQuality: number) => {
          const blob = await createBlob(mimeType, outputQuality);
          const actualType = blob.type || 'image/png';

          if (actualType === mimeType || mimeType === 'image/png') {
            return blob;
          }

          return createBlob(JPEG_IMAGE_MIME_TYPE, outputQuality);
        };

        try {
          const targetSize = maxSizeMB ? maxSizeMB * 1024 * 1024 : 0;
          let currentQuality = quality;
          let blob = await compressOnce(currentQuality);

          while (
            targetSize > 0 &&
            blob.size > targetSize &&
            currentQuality > 0.1
          ) {
            currentQuality = Math.max(0.1, currentQuality - 0.1);
            blob = await compressOnce(currentQuality);
          }

          const actualType = blob.type || mimeType;
          const compressedFile = new File(
            [blob],
            getImageFileNameForMimeType(file.name, actualType),
            {
              type: actualType,
              lastModified: Date.now(),
            }
          );

          console.log(
            `📦 图片压缩完成: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% 压缩率${maxSizeMB ? `, 质量: ${Math.round(currentQuality * 100)}%` : ''})`
          );

          resolve(compressedFile);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('文件读取失败'));
    };

    reader.readAsDataURL(file);
  });
}

export interface Base64CompressionOptions {
  /** 最大文件大小（MB），默认 0.1MB (100KB) */
  maxSizeMB?: number;
  /** 最大宽度或高度，默认 1200px */
  maxWidthOrHeight?: number;
  /** 图片质量，0-1之间，默认 0.8 */
  initialQuality?: number;
  /** 输出格式，默认应用内图片格式 */
  fileType?: string;
}

export async function compressBase64Image(
  base64: string,
  options: Base64CompressionOptions = {}
): Promise<string> {
  if (base64.startsWith(`data:${GIF_IMAGE_MIME_TYPE}`)) {
    return base64;
  }

  const {
    maxSizeMB = 0.1,
    maxWidthOrHeight = 1200,
    initialQuality = 0.8,
    fileType = APP_IMAGE_MIME_TYPE,
  } = options;

  const sourceFile = base64ToFile(base64, 'image');
  const compressedFile = await compressImage(sourceFile, {
    maxWidth: maxWidthOrHeight,
    maxHeight: maxWidthOrHeight,
    quality: initialQuality,
    mimeType: fileType,
    maxSizeMB,
  });

  return readFileAsDataUrl(compressedFile);
}

export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error(`图片读取结果异常：${typeof reader.result}`));
    };
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.onabort = () => reject(new Error('文件读取被中断'));
    reader.readAsDataURL(file);
  });
}

function base64ToFile(base64: string, fileName: string): File {
  const [header = '', payload = ''] = base64.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || JPEG_IMAGE_MIME_TYPE;
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], `${fileName}.${mime.split('/')[1] || 'jpg'}`, {
    type: mime,
  });
}

function startsWithBytes(
  bytes: Uint8Array,
  signature: number[],
  offset = 0
): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function readAscii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.slice(start, end));
}

function detectImageMimeTypeFromBytes(bytes: Uint8Array): string | null {
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return JPEG_IMAGE_MIME_TYPE;
  }

  if (
    startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  ) {
    return 'image/png';
  }

  if (
    startsWithBytes(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWithBytes(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'image/webp';
  }

  if (
    startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWithBytes(bytes, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return GIF_IMAGE_MIME_TYPE;
  }

  if (bytes.length >= 12 && readAscii(bytes, 4, 8) === 'ftyp') {
    const boxSize = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    ).getUint32(0);
    const brandEnd = Math.min(
      bytes.length,
      boxSize >= 16 ? boxSize : bytes.length,
      64
    );
    const brands = new Set<string>();

    for (let offset = 8; offset + 4 <= brandEnd; offset += 4) {
      const brand = readAscii(bytes, offset, offset + 4);
      if (/^[\x20-\x7e]{4}$/.test(brand)) {
        brands.add(brand);
      }
    }

    if (['avif', 'avis'].some(brand => brands.has(brand))) {
      return 'image/avif';
    }

    if (
      ['heic', 'heix', 'hevc', 'hevx', 'heis', 'heim'].some(brand =>
        brands.has(brand)
      )
    ) {
      return 'image/heic';
    }

    if (['mif1', 'msf1'].some(brand => brands.has(brand))) {
      return 'image/heif';
    }
  }

  return null;
}

async function detectImageMimeTypeFromFile(file: File): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  return detectImageMimeTypeFromBytes(bytes);
}

function getImageFileNameForMimeType(fileName: string, mimeType: string) {
  const extension =
    mimeType === JPEG_IMAGE_MIME_TYPE ? 'jpg' : mimeType.split('/')[1];
  return /\.[^/.]+$/.test(fileName)
    ? fileName.replace(/\.[^/.]+$/, `.${extension}`)
    : `${fileName}.${extension}`;
}

function withDetectedImageMimeType(file: File, mimeType: string): File {
  if (file.type === mimeType) return file;

  return new File([file], getImageFileNameForMimeType(file.name, mimeType), {
    type: mimeType,
    lastModified: file.lastModified,
  });
}

/**
 * 智能压缩：根据文件大小自动选择压缩策略
 * @param file 原始图片文件
 * @returns 压缩后的文件
 */
export async function smartCompress(file: File): Promise<File> {
  const detectedMimeType = await detectImageMimeTypeFromFile(file);
  const sourceFile = detectedMimeType
    ? withDetectedImageMimeType(file, detectedMimeType)
    : file;
  const fileSizeKB = file.size / 1024;

  // 小图或文字截图很容易被过度压缩后影响 OCR，保留原图更稳
  if (
    file.size <= 300 * 1024 &&
    (!detectedMimeType || LOSSLESS_METADATA_MIME_TYPES.has(detectedMimeType))
  ) {
    console.log(
      `📸 原始图片大小: ${fileSizeKB.toFixed(1)}KB，已足够小，跳过压缩以保留文字细节`
    );
    return sourceFile;
  }

  // AI 识别专用：大图再做压缩，兼顾速度和可读性
  console.log(
    `📸 原始图片大小: ${fileSizeKB.toFixed(1)}KB，开始压缩以加速 AI 识别...`
  );

  // 对大图压到更温和的体积，避免小字和细线信息损失过多
  return compressImage(sourceFile, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
    mimeType: JPEG_IMAGE_MIME_TYPE,
    maxSizeMB: 0.6,
  });
}
