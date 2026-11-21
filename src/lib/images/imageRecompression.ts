import type { Base64CompressionOptions } from '@/lib/utils/imageCompression';
import { compressBase64Image } from '@/lib/utils/imageCompression';

export interface ImageRecompressionProfile {
  maxSizeBytes: number;
  compression: Base64CompressionOptions;
}

export interface ImageRecompressionStats {
  scannedCount: number;
  candidateCount: number;
  compressedCount: number;
  failedCount: number;
  savedBytes: number;
}

export interface ImageRecompressionResult {
  image: string;
  attempted: boolean;
  changed: boolean;
  failed: boolean;
  beforeBytes: number;
  afterBytes: number;
  savedBytes: number;
  error?: unknown;
}

export const createImageRecompressionStats = (): ImageRecompressionStats => ({
  scannedCount: 0,
  candidateCount: 0,
  compressedCount: 0,
  failedCount: 0,
  savedBytes: 0,
});

export const mergeImageRecompressionStats = (
  stats: ImageRecompressionStats[]
): ImageRecompressionStats =>
  stats.reduce((total, current) => {
    total.scannedCount += current.scannedCount;
    total.candidateCount += current.candidateCount;
    total.compressedCount += current.compressedCount;
    total.failedCount += current.failedCount;
    total.savedBytes += current.savedBytes;
    return total;
  }, createImageRecompressionStats());

export const getDataUrlBytes = (dataUrl: string): number | null => {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1 || !dataUrl.slice(0, commaIndex).includes(';base64')) {
    return null;
  }

  const payload = dataUrl.slice(commaIndex + 1);
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((payload.length * 3) / 4) - padding;
};

export const shouldRecompressStoredImage = (
  image: string,
  profile: ImageRecompressionProfile
): boolean => {
  if (!image.startsWith('data:image/') || /^data:image\/gif[;,]/i.test(image)) {
    return false;
  }

  const bytes = getDataUrlBytes(image);
  return bytes !== null && bytes > profile.maxSizeBytes;
};

export async function recompressStoredImage(
  image: string,
  profile: ImageRecompressionProfile
): Promise<ImageRecompressionResult> {
  const beforeBytes = getDataUrlBytes(image) || image.length;

  if (!shouldRecompressStoredImage(image, profile)) {
    return {
      image,
      attempted: false,
      changed: false,
      failed: false,
      beforeBytes,
      afterBytes: beforeBytes,
      savedBytes: 0,
    };
  }

  try {
    const compressed = await compressBase64Image(image, profile.compression);
    const afterBytes = getDataUrlBytes(compressed) || compressed.length;

    if (afterBytes >= beforeBytes) {
      return {
        image,
        attempted: true,
        changed: false,
        failed: false,
        beforeBytes,
        afterBytes,
        savedBytes: 0,
      };
    }

    return {
      image: compressed,
      attempted: true,
      changed: true,
      failed: false,
      beforeBytes,
      afterBytes,
      savedBytes: beforeBytes - afterBytes,
    };
  } catch (error) {
    return {
      image,
      attempted: true,
      changed: false,
      failed: true,
      beforeBytes,
      afterBytes: beforeBytes,
      savedBytes: 0,
      error,
    };
  }
}

export const applyImageRecompressionResultToStats = (
  stats: ImageRecompressionStats,
  result: ImageRecompressionResult
): void => {
  if (!result.attempted) return;

  stats.candidateCount += 1;

  if (result.failed) {
    stats.failedCount += 1;
    return;
  }

  if (result.changed) {
    stats.compressedCount += 1;
    stats.savedBytes += result.savedBytes;
  }
};
