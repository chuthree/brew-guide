import {
  APP_IMAGE_MIME_TYPE,
  JPEG_IMAGE_MIME_TYPE,
} from '@/lib/images/imageFormat';
import { readRecognitionSourceImage } from '@/lib/api/shared/recognitionUpload.js';
import { getImageFileNameForMimeType } from '@/lib/images/stillImageUpload.js';

async function encodeImage(
  source: string,
  options: Base64CompressionOptions
): Promise<Blob> {
  const {
    maxSizeMB = 0.1,
    maxWidthOrHeight = 1200,
    initialQuality = 0.8,
    fileType = APP_IMAGE_MIME_TYPE,
  } = options;
  const target = Math.floor(maxSizeMB * 1024 * 1024);
  if (
    !Number.isFinite(target) ||
    target < 1 ||
    !Number.isFinite(maxWidthOrHeight) ||
    maxWidthOrHeight < 1
  ) {
    throw new Error('图片压缩尺寸或大小上限无效');
  }
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('图片加载失败'));
    image.src = source;
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 canvas context');
  const encode = (type: string, quality: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob =>
          blob && blob.size > 0
            ? resolve(blob)
            : reject(new Error('图片压缩失败')),
        type,
        quality
      );
    });

  if (!image.width || !image.height) throw new Error('图片尺寸无效');
  const scale = Math.min(
    1,
    maxWidthOrHeight / Math.max(image.width, image.height)
  );
  let width = Math.max(1, Math.round(image.width * scale));
  let height = Math.max(1, Math.round(image.height * scale));
  let type = fileType;
  let quality = initialQuality;
  for (;;) {
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, width, height);
    let blob = await encode(type, quality);
    if (blob.type !== type) {
      const pixels = ctx.getImageData(0, 0, width, height).data;
      type = pixels.some((channel, index) => index % 4 === 3 && channel < 255)
        ? 'image/png'
        : JPEG_IMAGE_MIME_TYPE;
      blob = await encode(type, quality);
    }
    while (blob.size > target && blob.type !== 'image/png' && quality > 0.4) {
      quality = Math.max(0.4, quality - 0.1);
      blob = await encode(type, quality);
    }
    if (blob.size <= target) return blob;
    if (width === 1 && height === 1) throw new Error('图片无法压缩到保存上限');
    const ratio = Math.min(0.8, Math.sqrt(target / blob.size));
    width = Math.max(1, Math.floor(width * ratio));
    height = Math.max(1, Math.floor(height * ratio));
  }
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
  return readFileAsDataUrl(await encodeImage(base64, options));
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

/**
 * 智能压缩：根据文件大小自动选择压缩策略
 * @param file 原始图片文件
 * @returns 压缩后的文件
 */
export async function smartCompress(file: File): Promise<File> {
  const sourceFile = await readRecognitionSourceImage(file);
  const fileSizeKB = file.size / 1024;

  // 小图或文字截图很容易被过度压缩后影响 OCR，保留原图更稳
  if (file.size <= 300 * 1024) {
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
  const compressed = await encodeImage(await readFileAsDataUrl(sourceFile), {
    maxWidthOrHeight: 1600,
    initialQuality: 0.82,
    fileType: JPEG_IMAGE_MIME_TYPE,
    maxSizeMB: 0.6,
  });
  return new File(
    [compressed],
    getImageFileNameForMimeType(file.name, compressed.type),
    { type: compressed.type }
  );
}
