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

it('serializes native image reads and continues after a failure', async () => {
  let finishFirst!: (value: { data: string }) => void;
  mocks.filesystem.readFile
    .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
    .mockRejectedValueOnce(new Error('read failed'))
    .mockResolvedValueOnce({ data: 'Aw==' });
  const { createCapacitorImageFileStore } =
    await import('./capacitorImageFileStore');
  const store = await createCapacitorImageFileStore();
  const first = store.read('first');
  const second = store.read('second');
  const third = store.read('third');
  await vi.waitFor(() => expect(mocks.filesystem.readFile).toHaveBeenCalledTimes(1));
  finishFirst({ data: 'AQ==' });
  await expect(first).resolves.toEqual(new Uint8Array([1]));
  await expect(second).rejects.toThrow('image file read failed');
  await expect(third).resolves.toEqual(new Uint8Array([3]));
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

it('checks a missing iOS object directory before attempting readdir', async () => {
  mocks.platform = 'ios';
  mocks.filesystem.stat.mockRejectedValue({ code: 'OS-PLUG-FILE-0008' });
  const { createCapacitorImageFileStore } =
    await import('./capacitorImageFileStore');
  const store = await createCapacitorImageFileStore();
  await expect(store.listObjectKeys()).resolves.toEqual([]);
  expect(mocks.filesystem.readdir).not.toHaveBeenCalled();
});

it('does not hide iOS filesystem access errors as an empty directory', async () => {
  mocks.filesystem.stat.mockRejectedValue({ code: 'OS-PLUG-FILE-0013' });
  mocks.filesystem.readdir.mockRejectedValue(new Error('permission denied'));
  const { createCapacitorImageFileStore } =
    await import('./capacitorImageFileStore');
  const store = await createCapacitorImageFileStore();
  await expect(store.listObjectKeys()).rejects.toThrow(
    'image file list failed'
  );
});

it('proves absence when iOS wraps a missing file as a generic failure', async () => {
  mocks.filesystem.stat.mockRejectedValue({ code: 'OS-PLUG-FILE-0013' });
  mocks.filesystem.deleteFile.mockRejectedValue({ code: 'OS-PLUG-FILE-0013' });
  mocks.filesystem.readdir.mockResolvedValue({ files: [] });
  const { createCapacitorImageFileStore } =
    await import('./capacitorImageFileStore');
  const store = await createCapacitorImageFileStore();
  await expect(store.listObjectKeys()).resolves.toEqual([]);
  await expect(store.exists('missing_image')).resolves.toBe(false);
  await expect(store.delete('missing_image')).resolves.toBeUndefined();
});

it('preserves a generic stat failure when the file exists in its parent', async () => {
  mocks.filesystem.stat
    .mockRejectedValueOnce({ code: 'OS-PLUG-FILE-0013' })
    .mockResolvedValue({ type: 'directory' });
  mocks.filesystem.readdir.mockResolvedValue({
    files: [{ name: 'existing_image' }],
  });
  const { createCapacitorImageFileStore } =
    await import('./capacitorImageFileStore');
  const store = await createCapacitorImageFileStore();
  await expect(store.exists('existing_image')).rejects.toThrow(
    'image file stat failed'
  );
});
