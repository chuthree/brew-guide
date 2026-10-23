import { host } from './host';
import { encodeRawBase64 } from '@/lib/data/images/imageBinary';
export * from '@/lib/images/imagePolicy';
export interface ImageProcessingOptions {
  maxFileSizeBytes?: number;
  compression?: {
    maxSizeMB?: number;
    maxWidthOrHeight?: number;
    initialQuality?: number;
  };
}
export async function processImageFile(
  file: File,
  options: ImageProcessingOptions
): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const dataUrl = `data:${file.type};base64,${encodeRawBase64(bytes)}`;
  return host<{ compressed: string }>('images.process', { dataUrl, options })
    .compressed;
}
