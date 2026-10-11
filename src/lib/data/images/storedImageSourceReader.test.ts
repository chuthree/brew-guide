import { describe, expect, it, vi } from 'vitest';
import { decodeImageDataUrl, encodeImageDataUrl } from './imageBinary';
import {
  readStoredImageSource,
  StoredImageSourceReadError,
} from './storedImageSourceReader';
import type { NativeImageFileStore } from './nativeImageFileStore';
import type { CoffeeBeanImageMetadata } from '@/lib/data/sqlite/imageMetadata';

function fileMetadata(
  mimeType = 'image/jpeg',
  sizeBytes = 4
): Extract<CoffeeBeanImageMetadata, { sourceKind: 'file' }> {
  return {
    imageId: 'image-1',
    beanId: 'bean-1',
    slot: 'front',
    variant: 'original',
    sourceKind: 'file',
    relativePath: 'images/v1/objects/object-1',
    mimeType,
    sizeBytes,
  };
}

function storeWith(bytes: Uint8Array): NativeImageFileStore {
  return {
    write: vi.fn(),
    read: vi.fn(async () => bytes),
    delete: vi.fn(),
    exists: vi.fn(),
    listObjectKeys: vi.fn(),
  };
}

describe('stored image source reconstruction', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
  ])('round-trips bytes and preserves the exact %s MIME', async mimeType => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 255]);
    const store = storeWith(bytes);
    const source = await readStoredImageSource(
      fileMetadata(mimeType, bytes.byteLength),
      store
    );

    expect(source.startsWith(`data:${mimeType};base64,`)).toBe(true);
    expect(decodeImageDataUrl(source)).toEqual({ mimeType, bytes });
    expect(store.read).toHaveBeenCalledWith('object-1');
    expect(store.write).not.toHaveBeenCalled();
    expect(store.delete).not.toHaveBeenCalled();
  });

  it('returns an external URL byte-for-byte without touching the FileStore', async () => {
    const externalUrl = 'https://Example.COM/a%2Fb?b=2&a=1#Frag';
    const store = storeWith(new Uint8Array());
    const source = await readStoredImageSource(
      {
        imageId: 'image-external',
        beanId: 'bean-1',
        slot: 'back',
        variant: 'original',
        sourceKind: 'external',
        externalUrl,
      },
      store
    );

    expect(source).toBe(externalUrl);
    expect(store.read).not.toHaveBeenCalled();
  });

  it('rejects missing files and size mismatches without leaking source data', async () => {
    const externalUrl = 'https://private.example/image?token=secret';
    const missingStore = storeWith(new Uint8Array());
    vi.mocked(missingStore.read).mockRejectedValueOnce(
      new Error('private path and token ' + externalUrl)
    );

    const missingError = await readStoredImageSource(
      fileMetadata('image/png', 4),
      missingStore
    ).then(
      () => undefined,
      error => error
    );
    expect(missingError).toMatchObject({
      name: 'StoredImageSourceReadError',
      reason: 'file-unavailable',
    } satisfies Partial<StoredImageSourceReadError>);
    expect(missingError).toBeInstanceOf(Error);
    if (!(missingError instanceof Error))
      throw new Error('Expected read failure');
    expect(missingError.message).not.toContain(externalUrl);
    expect(missingError.message).not.toContain('private path');

    const mismatchStore = storeWith(new Uint8Array([1, 2, 3, 4, 5]));
    await expect(
      readStoredImageSource(fileMetadata('image/png', 4), mismatchStore)
    ).rejects.toMatchObject({ reason: 'size-mismatch' });
  });

  it('uses the shared browser/native Data URL encoder without Node Buffer', () => {
    const binary = { mimeType: 'image/HEIF', bytes: new Uint8Array([7, 8, 9]) };
    const encoded = encodeImageDataUrl(binary);
    expect(decodeImageDataUrl(encoded)).toEqual(binary);
  });
});
