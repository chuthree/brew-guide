import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  pickImages: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@capawesome/capacitor-file-picker', () => ({
  FilePicker: { pickImages: mocks.pickImages },
}));

vi.mock('@capacitor/core', async importOriginal => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => 'android'),
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    readFile: mocks.readFile,
  },
}));

import { pickNativeGalleryImageFiles } from './imageCapture';

describe('pickNativeGalleryImageFiles', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads native gallery photos from path instead of fetching webPath', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchSpy);
    mocks.pickImages.mockResolvedValue({
      files: [
        {
          name: 'photo.jpg',
          size: 11,
          mimeType: 'image/jpeg',
          path: 'file:///cache/photo.jpg',
        },
      ],
    });
    mocks.readFile.mockResolvedValue({ data: 'aW1hZ2UtYnl0ZXM=' });

    const [file] = await pickNativeGalleryImageFiles({ limit: 1 });

    expect(mocks.pickImages).toHaveBeenCalledWith({
      limit: 1,
      skipTranscoding: true,
    });
    expect(mocks.readFile).toHaveBeenCalledWith({
      path: 'file:///cache/photo.jpg',
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(file).toMatchObject({
      name: 'photo.jpg',
      type: 'image/jpeg',
    });
    expect(await file.text()).toBe('image-bytes');
  });
});
