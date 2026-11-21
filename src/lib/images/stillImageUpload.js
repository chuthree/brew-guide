export const STILL_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
];
export const STILL_IMAGE_ACCEPT = STILL_IMAGE_TYPES.join(',');
const MAX_STILL_IMAGE_BYTES = 5 * 1024 * 1024;
export const stillImageHint = maxBytes =>
  `JPG、PNG、WebP、HEIC 或 HEIF，每张最多 ${maxBytes / (1024 * 1024)} MiB`;

function startsWithBytes(bytes, signature, offset = 0) {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

function readAscii(bytes, start, end) {
  return String.fromCharCode(...bytes.slice(start, end));
}

function detectImageMimeTypeFromBytes(bytes) {
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg';
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
    return 'image/gif';
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
    const brands = new Set();

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

/** @param {string} fileName @param {string} mimeType */
export function getImageFileNameForMimeType(fileName, mimeType) {
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
  return /\.[^/.]+$/.test(fileName)
    ? fileName.replace(/\.[^/.]+$/, `.${extension}`)
    : `${fileName}.${extension}`;
}

function withDetectedImageMimeType(file, mimeType) {
  if (file.type === mimeType) return file;

  return new File([file], getImageFileNameForMimeType(file.name, mimeType), {
    type: mimeType,
    lastModified: file.lastModified,
  });
}

/** @param {File} file */
export async function readStillImageFile(
  file,
  maxBytes = MAX_STILL_IMAGE_BYTES
) {
  if (file.size > maxBytes) {
    throw new Error(`文件过大，请选择 ${stillImageHint(maxBytes)}`);
  }
  const header = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const mimeType = detectImageMimeTypeFromBytes(header);
  if (!mimeType && STILL_IMAGE_TYPES.includes(file.type)) {
    throw new Error('文件内容与声明的类型不匹配，请上传有效图片');
  }
  if (!STILL_IMAGE_TYPES.includes(mimeType)) {
    throw new Error(`不支持的文件类型，请选择 ${stillImageHint(maxBytes)}`);
  }
  return withDetectedImageMimeType(file, mimeType);
}
