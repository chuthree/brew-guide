import type { CoffeeBean } from '@/types/app';
import type { SqliteDriver, SqliteExecutor } from '@/lib/data/sqlite/driver';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { createTauriImageFileStore } from '@/lib/data/images/tauriImageFileStore';
import { decodeImageDataUrl } from '@/lib/data/images/imageBinary';
import {
  processImageFile,
  BEAN_IMAGE_COMPRESSION_OPTIONS,
  type ImageProcessingOptions,
} from '@/lib/images/imageProcessing';
import {
  prepareCoffeeBeanImageWrite,
  cleanupPreparedCoffeeBeanImageFiles,
  type PreparedCoffeeBeanImageWrite,
  type SqliteCoffeeBeanPersistenceOptions,
} from '@/lib/data/sqlite/persistence/coffeeBeanImagePersistence';
import { listCoffeeBeanImageMetadata } from '@/lib/data/sqlite/imageMetadataExecutor';
import { McpToolError } from './validation';

export const MCP_BEAN_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const MCP_BEAN_IMAGE_MAX_DATA_URL_LENGTH =
  Math.ceil(MCP_BEAN_IMAGE_MAX_BYTES / 3) * 4 + 32;
const MAX_PIXELS = 32_000_000;
const MAX_DIMENSION = 16_384;

const invalid = (): never => {
  throw new McpToolError(
    'INVALID_ARGUMENT',
    'Provide a valid PNG, JPEG or WebP image Data URL (at most 8 MiB and 32 megapixels); URLs and filesystem paths are not accepted.'
  );
};

function dimensions(
  bytes: Uint8Array,
  mime: string
): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (offset: number, length: number) =>
    String.fromCharCode(...bytes.slice(offset, offset + length));
  if (mime === 'image/png') {
    if (
      bytes.length < 33 ||
      bytes[0] !== 137 ||
      ascii(1, 7) !== 'PNG\r\n\x1a\n' ||
      ascii(12, 4) !== 'IHDR' ||
      view.getUint32(8) !== 13
    )
      invalid();
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mime === 'image/jpeg') {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) invalid();
    let offset = 2;
    while (offset + 3 < bytes.length) {
      if (bytes[offset++] !== 0xff) invalid();
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) invalid();
      const size = view.getUint16(offset);
      if (size < 2 || offset + size > bytes.length) invalid();
      if (
        [
          0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd,
          0xce, 0xcf,
        ].includes(marker)
      ) {
        if (size < 8) invalid();
        return {
          width: view.getUint16(offset + 5),
          height: view.getUint16(offset + 3),
        };
      }
      offset += size;
    }
    return invalid();
  }
  if (mime === 'image/webp') {
    if (
      bytes.length < 30 ||
      ascii(0, 4) !== 'RIFF' ||
      ascii(8, 4) !== 'WEBP' ||
      view.getUint32(4, true) + 8 !== bytes.length
    )
      invalid();
    const chunk = ascii(12, 4);
    if (chunk === 'VP8X') {
      if (bytes[20] & 2) invalid(); // Animated sources require the app's explicit handling.
      return {
        width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
        height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
      };
    }
    if (
      chunk === 'VP8 ' &&
      bytes[23] === 0x9d &&
      bytes[24] === 1 &&
      bytes[25] === 0x2a
    )
      return {
        width: view.getUint16(26, true) & 0x3fff,
        height: view.getUint16(28, true) & 0x3fff,
      };
    if (chunk === 'VP8L' && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      return {
        width: (bits & 0x3fff) + 1,
        height: ((bits >>> 14) & 0x3fff) + 1,
      };
    }
  }
  return invalid();
}

/** Reject remote/path sources and dangerous declared dimensions before browser decoding. */
export function validateMcpBeanImageDataUrl(dataUrl: unknown) {
  if (
    typeof dataUrl !== 'string' ||
    dataUrl.length > MCP_BEAN_IMAGE_MAX_DATA_URL_LENGTH ||
    !/^data:image\/(?:png|jpeg|webp);base64,/.test(dataUrl)
  )
    invalid();
  try {
    const binary = decodeImageDataUrl(dataUrl as string);
    if (!binary.bytes.length || binary.bytes.length > MCP_BEAN_IMAGE_MAX_BYTES)
      invalid();
    const size = dimensions(binary.bytes, binary.mimeType);
    if (
      !size.width ||
      !size.height ||
      size.width > MAX_DIMENSION ||
      size.height > MAX_DIMENSION ||
      size.width * size.height > MAX_PIXELS
    )
      invalid();
    return { ...binary, ...size };
  } catch {
    return invalid();
  }
}

/** Shared mandatory browser decode/compression for MCP raster uploads. */
export async function compressMcpImageDataUrl(
  dataUrl: string,
  compression: ImageProcessingOptions['compression'],
  processor?: McpBeanImageDependencies['process']
): Promise<string> {
  const binary = validateMcpBeanImageDataUrl(dataUrl);
  try {
    const image = await (processor ?? processImageFile)(
      new File(
        [new Uint8Array(binary.bytes)],
        `mcp-image.${binary.mimeType.split('/')[1]}`,
        { type: binary.mimeType }
      ),
      {
        maxFileSizeBytes: MCP_BEAN_IMAGE_MAX_BYTES,
        compression,
      }
    );
    const compressed = validateMcpBeanImageDataUrl(image);
    if (Math.max(compressed.width, compressed.height) > 1200) invalid();
    return image;
  } catch {
    throw new McpToolError(
      'INVALID_ARGUMENT',
      'Image decoding or compression failed; no record or image metadata was changed.'
    );
  }
}

export interface McpBeanImageDependencies {
  fileStore?: NativeImageFileStore;
  process?: (file: File, options: ImageProcessingOptions) => Promise<string>;
  persistence?: SqliteCoffeeBeanPersistenceOptions;
}

/** Call inside the existing MCP mutation transaction, after expectedVersion checks. */
export async function prepareMcpBeanImageMutation(
  tx: SqliteExecutor,
  bean: CoffeeBean,
  side: 'front' | 'back',
  dataUrl: string | null,
  dependencies: McpBeanImageDependencies = {}
): Promise<PreparedCoffeeBeanImageWrite> {
  if (side !== 'front' && side !== 'back') invalid();
  let image: string | null = null;
  if (dataUrl !== null) {
    image = await compressMcpImageDataUrl(
      dataUrl,
      BEAN_IMAGE_COMPRESSION_OPTIONS,
      dependencies.process
    );
  }
  try {
    const fileStore =
      dependencies.fileStore ?? (await createTauriImageFileStore());
    return await prepareCoffeeBeanImageWrite(
      tx,
      fileStore,
      { ...bean, [side === 'front' ? 'image' : 'backImage']: image ?? '' },
      dependencies.persistence
    );
  } catch {
    // Native storage errors can contain private paths; never return them over MCP.
    throw new McpToolError(
      'IMAGE_STORAGE_ERROR',
      'Image storage preparation failed; no bean or image metadata was changed.'
    );
  }
}

/** No bytes, URLs, file paths, or object keys are exposed to the client. */
export async function getMcpBeanImageInfo(tx: SqliteExecutor, beanId: string) {
  const rows = await listCoffeeBeanImageMetadata(tx, beanId);
  return rows
    .filter(row => row.variant === 'original')
    .map(row => ({
      imageId: row.imageId,
      side: row.slot,
      source: row.sourceKind,
      mimeType: row.sourceKind === 'file' ? row.mimeType : null,
      sizeBytes: row.sourceKind === 'file' ? row.sizeBytes : null,
      hasThumbnail: rows.some(
        other => other.slot === row.slot && other.variant === 'thumbnail'
      ),
    }));
}

export async function cleanupMcpBeanImageFiles(
  driver: SqliteDriver,
  paths: readonly string[],
  error?: unknown
) {
  if (!paths.length) return;
  await cleanupPreparedCoffeeBeanImageFiles(
    driver,
    await createTauriImageFileStore(),
    paths,
    error
  );
}
