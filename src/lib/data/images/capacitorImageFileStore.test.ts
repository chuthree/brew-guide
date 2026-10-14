import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  platform: 'ios',
  filesystem: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
  },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => mocks.platform },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Library: 'LIBRARY' },
  Filesystem: mocks.filesystem,
}));
afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

it('uses the shared private Library image store on iOS', async () => {
  mocks.platform = 'ios';
  const bytes = new Uint8Array([0, 255, 128]);
  mocks.filesystem.stat
    .mockRejectedValueOnce(
      Object.assign(new Error('missing'), { code: 'OS-PLUG-FILE-0008' })
    )
    .mockResolvedValue({
      name: 'ios_image',
      type: 'file',
      size: bytes.byteLength,
    });
  mocks.filesystem.writeFile.mockResolvedValue(undefined);
  mocks.filesystem.readFile.mockResolvedValue({ data: 'AP+A' });
  const { createCapacitorImageFileStore } =
    await import('./capacitorImageFileStore');
  const store = await createCapacitorImageFileStore();
  await store.write('ios_image', bytes);
  expect(mocks.filesystem.writeFile).toHaveBeenCalledWith({
    path: 'images/v1/objects/ios_image',
    directory: 'LIBRARY',
    data: 'AP+A',
    recursive: true,
  });
  await expect(store.read('ios_image')).resolves.toEqual(bytes);
});
