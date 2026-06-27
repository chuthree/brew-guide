import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressBase64Image, smartCompress } from './imageCompression';

const readBlobAsDataUrl = async (blob: Blob) => {
  const bytes = Buffer.from(await blob.arrayBuffer());
  return `data:${blob.type};base64,${bytes.toString('base64')}`;
};

describe('smartCompress', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('preserves small images while correcting a mismatched WebP MIME type', async () => {
    const webpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x08, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const file = new File([webpBytes], 'cover.jpg', { type: 'image/jpeg' });

    const result = await smartCompress(file);

    expect(result.type).toBe('image/webp');
    expect(result.name).toBe('cover.webp');
    expect(result.size).toBe(file.size);
  });

  it('falls back to JPEG when canvas cannot encode WebP', async () => {
    class MockFileReader {
      result: string | null = null;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

      async readAsDataURL(blob: Blob) {
        this.result = await readBlobAsDataUrl(blob);
        this.onload?.({} as ProgressEvent<FileReader>);
      }
    }

    class MockImage {
      width = 2400;
      height = 1600;
      onload: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }
    }

    const toBlob = vi.fn(
      (callback: BlobCallback, type = 'image/png', _quality?: number): void => {
        const actualType = type === 'image/webp' ? 'image/png' : type;
        callback(new Blob(['compressed'], { type: actualType }));
      }
    );

    vi.stubGlobal('FileReader', MockFileReader);
    vi.stubGlobal('Image', MockImage);
    vi.stubGlobal('document', {
      createElement: () => ({
        getContext: () => ({
          drawImage: vi.fn(),
          imageSmoothingEnabled: false,
          imageSmoothingQuality: 'low',
        }),
        toBlob,
      }),
    });

    const result = await compressBase64Image('data:image/png;base64,c291cmNl');

    expect(result.startsWith('data:image/jpeg;base64,')).toBe(true);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/webp',
      0.8
    );
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      0.8
    );
  });

  it('does not recompress GIF data URLs', async () => {
    const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

    await expect(compressBase64Image(gifDataUrl)).resolves.toBe(gifDataUrl);
  });
});
