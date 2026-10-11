import {
  encodeImageDataUrl,
  type ImageBinary,
} from '@/lib/data/images/imageBinary';
import type {
  BrewingNoteImageMetadata,
  CoffeeBeanImageMetadata,
} from '@/lib/data/sqlite/imageMetadata';
import {
  parseImageRelativePath,
  type NativeImageFileStore,
} from './nativeImageFileStore';

export class StoredImageSourceReadError extends Error {
  constructor(
    readonly table: 'coffee_bean_images' | 'brewing_note_images',
    readonly imageId: string,
    readonly reason: 'file-unavailable' | 'size-mismatch' | 'invalid-bytes'
  ) {
    super(
      `Stored image source is corrupt (${table}, image ${imageId}, ${reason})`
    );
    this.name = 'StoredImageSourceReadError';
  }
}

type StoredImageMetadata = CoffeeBeanImageMetadata | BrewingNoteImageMetadata;

/** Reconstruct a public image string without modifying metadata or files. */
export async function readStoredImageSource(
  metadata: StoredImageMetadata,
  fileStore: NativeImageFileStore
): Promise<string> {
  if (metadata.sourceKind === 'external') return metadata.externalUrl;

  const table =
    'beanId' in metadata ? 'coffee_bean_images' : 'brewing_note_images';
  let bytes: Uint8Array;
  try {
    const objectKey = parseImageRelativePath(metadata.relativePath);
    bytes = await fileStore.read(objectKey);
  } catch {
    throw new StoredImageSourceReadError(
      table,
      metadata.imageId,
      'file-unavailable'
    );
  }

  if (!(bytes instanceof Uint8Array)) {
    throw new StoredImageSourceReadError(
      table,
      metadata.imageId,
      'invalid-bytes'
    );
  }
  if (bytes.byteLength !== metadata.sizeBytes) {
    throw new StoredImageSourceReadError(
      table,
      metadata.imageId,
      'size-mismatch'
    );
  }

  const image: ImageBinary = { mimeType: metadata.mimeType, bytes };
  try {
    return encodeImageDataUrl(image);
  } catch {
    throw new StoredImageSourceReadError(
      table,
      metadata.imageId,
      'invalid-bytes'
    );
  }
}

/** Keep filesystem work bounded while retaining caller order. */
export async function mapWithReadConcurrency<T, R>(
  values: readonly T[],
  read: (value: T, index: number) => Promise<R>,
  concurrency = 4
): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new TypeError('Image read concurrency must be a positive integer');
  }

  const result = new Array<R>(values.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (true) {
        const index = nextIndex;
        nextIndex += 1;
        if (index >= values.length) return;
        result[index] = await read(values[index], index);
      }
    }
  );

  await Promise.all(workers);
  return result;
}
