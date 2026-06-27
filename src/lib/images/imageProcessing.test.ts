import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageProcessingError, processImageFile } from './imageProcessing';

describe('processImageFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps FileReader diagnostics when reading an image fails', async () => {
    const readError = new DOMException(
      'Scoped storage permission denied',
      'NotReadableError'
    );

    const FailingFileReader = class {
      error = readError;
      result = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsDataURL() {
        this.onerror?.({} as ProgressEvent<FileReader>);
      }
    } as unknown as typeof FileReader;

    vi.stubGlobal('FileReader', FailingFileReader);
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
      platform: 'Linux armv8',
    });

    const file = new File(['image-bytes'], 'photo.jpg', {
      type: 'image/jpeg',
    });

    let error: unknown;
    try {
      await processImageFile(file);
    } catch (caughtError) {
      error = caughtError;
    }

    expect(error).toBeInstanceOf(ImageProcessingError);
    expect(error).toMatchObject({
      code: 'read-failed',
      diagnostics: {
        fileName: 'photo.jpg',
        declaredType: 'image/jpeg',
        runtime: 'Android',
        reason: 'NotReadableError: Scoped storage permission denied',
      },
    });
  });

  it('keeps GIF images as original data URLs', async () => {
    const gifDataUrl = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

    const SuccessfulFileReader = class {
      result = gifDataUrl;
      onload: ((event: ProgressEvent<FileReader>) => void) | null = null;
      onerror: ((event: ProgressEvent<FileReader>) => void) | null = null;

      readAsDataURL() {
        this.onload?.({} as ProgressEvent<FileReader>);
      }
    } as unknown as typeof FileReader;

    vi.stubGlobal('FileReader', SuccessfulFileReader);

    const file = new File(['gif-bytes'], 'loop.gif', {
      type: 'image/gif',
    });

    await expect(processImageFile(file)).resolves.toBe(gifDataUrl);
  });
});
