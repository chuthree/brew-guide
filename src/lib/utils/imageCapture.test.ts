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

  it('reads valid photos from path and skips oversized or excess selections', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetchSpy);
    mocks.pickImages.mockResolvedValue({
      files: [
        { name: 'large.jpg', size: 12, path: 'file:///cache/large.jpg' },
        {
          name: 'photo.jpg',
          size: 11,
          mimeType: 'image/jpeg',
          path: 'file:///cache/photo.jpg',
        },
        { name: 'extra.jpg', size: 11, path: 'file:///cache/extra.jpg' },
      ],
    });
    mocks.readFile.mockResolvedValue({ data: 'aW1hZ2UtYnl0ZXM=' });

    const { files, errors } = await pickNativeGalleryImageFiles({
      limit: 1,
      maxFileSizeBytes: 11,
    });
    const [file] = files;
    expect(files).toHaveLength(1);
    expect(errors).toEqual([
      expect.stringContaining('large.jpg'),
      '最多选择 1 张图片',
    ]);
    expect(mocks.readFile).toHaveBeenCalledTimes(1);

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
