import { beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeRawBase64, encodeRawBase64 } from './imageBinary';
import {
  IMAGE_OBJECT_RELATIVE_ROOT,
  type ImageObjectKey,
} from './nativeImageFileStore';

interface WriteFileOptions {
  path: string;
  directory: string;
  data: string;
  recursive: true;
}

interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
}

const mocks = vi.hoisted(() => ({
  platform: 'android',
  pluginImportCount: 0,
  filesystem: {
    writeFile: vi.fn(),
    readFile: vi.fn(),
    deleteFile: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => mocks.platform,
  },
}));

vi.mock('@capacitor/filesystem', () => {
  mocks.pluginImportCount += 1;
  return {
    Directory: { Library: 'LIBRARY' },
    Filesystem: mocks.filesystem,
  };
});

import { createCapacitorAndroidImageFileStore } from './capacitorAndroidImageFileStore';

const files = new Map<string, Uint8Array>();
const directories = new Set<string>();

function missingError(): Error & { code: string } {
  return Object.assign(new Error('localized missing message'), {
    code: 'OS-PLUG-FILE-0008',
  });
}

function otherFilesystemError(): Error & { code: string } {
  return Object.assign(new Error('storage unavailable'), { code: 'EIO' });
}

function objectPath(key: string): string {
  return `${IMAGE_OBJECT_RELATIVE_ROOT}/${key}`;
}

describe('Capacitor Android NativeImageFileStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.platform = 'android';
    files.clear();
    directories.clear();

    mocks.filesystem.writeFile.mockImplementation(
      async (options: WriteFileOptions) => {
        directories.add(IMAGE_OBJECT_RELATIVE_ROOT);
        files.set(options.path, decodeRawBase64(options.data));
        return undefined;
      }
    );
    mocks.filesystem.readFile.mockImplementation(
      async ({ path }: { path: string }) => {
        const bytes = files.get(path);
        if (!bytes) throw missingError();
        return { data: encodeRawBase64(bytes) };
      }
    );
    mocks.filesystem.deleteFile.mockImplementation(
      async ({ path }: { path: string }) => {
        if (!files.delete(path)) throw missingError();
      }
    );
    mocks.filesystem.stat.mockImplementation(
      async ({ path }: { path: string }): Promise<FileEntry> => {
        const bytes = files.get(path);
        if (bytes) {
          return {
            name: path.split('/').pop() || '',
            type: 'file',
            size: bytes.byteLength,
          };
        }
        if (directories.has(path)) {
          return {
            name: path.split('/').pop() || '',
            type: 'directory',
            size: 0,
          };
        }
        throw missingError();
      }
    );
    mocks.filesystem.readdir.mockImplementation(
      async ({ path }: { path: string }) => {
        if (!directories.has(path)) throw missingError();
        const prefix = `${path}/`;
        const result = [...files.entries()]
          .filter(([entryPath]) => entryPath.startsWith(prefix))
          .map(([entryPath, bytes]) => ({
            name: entryPath.slice(prefix.length),
            type: 'file' as const,
            size: bytes.byteLength,
          }));
        return { files: result };
      }
    );
  });

  it.each(['web', 'ios', 'electron'])(
    '%s rejects before loading the Filesystem plugin',
    async platform => {
      mocks.platform = platform;
      const pluginImportsBefore = mocks.pluginImportCount;

      await expect(createCapacitorAndroidImageFileStore()).rejects.toThrow(
        `unavailable on platform ${platform}`
      );
      expect(mocks.pluginImportCount).toBe(pluginImportsBefore);
    }
  );

  it('creates independent store instances only on Android', async () => {
    const first = await createCapacitorAndroidImageFileStore();
    const second = await createCapacitorAndroidImageFileStore();

    expect(first).not.toBe(second);
    expect(mocks.filesystem.stat).not.toHaveBeenCalled();
  });

  it('writes raw base64 under Library recursively and verifies exact byte size', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_write_binary';
    const bytes = new Uint8Array([0x00, 0xff, 0x80, 0x01, 0x42]);

    await expect(store.exists(key)).resolves.toBe(false);
    await store.write(key, bytes);

    expect(mocks.filesystem.writeFile).toHaveBeenCalledWith({
      path: objectPath(key),
      directory: 'LIBRARY',
      data: 'AP+AAUI=',
      recursive: true,
    });
    expect(mocks.filesystem.stat).toHaveBeenLastCalledWith({
      path: objectPath(key),
      directory: 'LIBRARY',
    });
    await expect(store.read(key)).resolves.toEqual(bytes);
  });

  it('allows empty bytes because the FileStore contract is storage-only', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_empty_binary';

    await store.write(key, new Uint8Array());

    expect(mocks.filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ data: '', directory: 'LIBRARY' })
    );
    await expect(store.read(key)).resolves.toEqual(new Uint8Array());
  });

  it('rejects an existing object without overwriting or cleaning it up', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_immutable_object';
    const original = new Uint8Array([0x00, 0xff, 0x01]);

    await store.write(key, original);
    await expect(
      store.write(key, new Uint8Array([0x11, 0x22]))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining('already exists'),
      }),
    });

    await expect(store.read(key)).resolves.toEqual(original);
    expect(mocks.filesystem.writeFile).toHaveBeenCalledTimes(1);
    expect(mocks.filesystem.deleteFile).not.toHaveBeenCalled();
  });

  it('rejects same-instance concurrent writes before either can overwrite', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_same_key_race';
    const firstBytes = new Uint8Array([0x01, 0xff]);
    const secondBytes = new Uint8Array([0x02, 0xfe]);

    const outcomes = await Promise.allSettled([
      store.write(key, firstBytes),
      store.write(key, secondBytes),
    ]);

    expect(
      outcomes.filter(result => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      outcomes.filter(result => result.status === 'rejected')
    ).toHaveLength(1);
    expect(mocks.filesystem.writeFile).toHaveBeenCalledTimes(1);
    await expect(store.read(key)).resolves.toEqual(firstBytes);
  });

  it('does not serialize writes to different keys', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const pending: Array<{
      options: WriteFileOptions;
      resolve: (value: unknown) => void;
    }> = [];
    mocks.filesystem.writeFile.mockImplementation(
      (options: WriteFileOptions) =>
        new Promise(resolve => {
          pending.push({ options, resolve });
        })
    );

    const writes = [
      store.write('stage3g2_parallel_a', new Uint8Array([0xa1])),
      store.write('stage3g2_parallel_b', new Uint8Array([0xb2])),
    ];

    await vi.waitFor(() => expect(pending).toHaveLength(2));
    for (const write of pending) {
      directories.add(IMAGE_OBJECT_RELATIVE_ROOT);
      files.set(write.options.path, decodeRawBase64(write.options.data));
      write.resolve(undefined);
    }
    await expect(Promise.all(writes)).resolves.toEqual([undefined, undefined]);
  });

  it('cleans a partial write and preserves the original write failure as cause', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_partial_write';
    const writeError = new Error('native write failed');
    mocks.filesystem.writeFile.mockImplementationOnce(
      async (options: WriteFileOptions) => {
        files.set(options.path, new Uint8Array([0x01]));
        throw writeError;
      }
    );

    const caught = await store
      .write(key, new Uint8Array([0x11]))
      .catch(error => error);

    expect(caught).toMatchObject({ cause: writeError });
    expect(mocks.filesystem.deleteFile).toHaveBeenCalledWith({
      path: objectPath(key),
      directory: 'LIBRARY',
    });
    await expect(store.exists(key)).resolves.toBe(false);
  });

  it('keeps the original write failure primary when cleanup also fails', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_cleanup_failure';
    const writeError = new Error('original write failure');
    mocks.filesystem.writeFile.mockImplementationOnce(
      async (options: WriteFileOptions) => {
        files.set(options.path, new Uint8Array([0x01]));
        throw writeError;
      }
    );
    mocks.filesystem.deleteFile.mockRejectedValueOnce(
      new Error('cleanup failure')
    );

    const caught = await store
      .write(key, new Uint8Array([0x11]))
      .catch(error => error);

    expect(caught.cause).toBe(writeError);
    expect(caught.message).toContain('write failed');
    expect(caught.message).not.toContain('cleanup failure');
  });

  it('does not clean or write when preflight stat fails for another reason', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    mocks.filesystem.stat.mockRejectedValueOnce(otherFilesystemError());

    await expect(
      store.write('stage3g2_preflight_error', new Uint8Array([0x01]))
    ).rejects.toThrow('Android image file write failed');
    expect(mocks.filesystem.writeFile).not.toHaveBeenCalled();
    expect(mocks.filesystem.deleteFile).not.toHaveBeenCalled();
  });

  it('cleans an object whose post-write stat has the wrong size', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_size_mismatch';
    mocks.filesystem.stat
      .mockRejectedValueOnce(missingError())
      .mockResolvedValueOnce({
        name: key,
        type: 'file',
        size: 99,
      });

    await expect(
      store.write(key, new Uint8Array([0x01, 0x02]))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining('write verification failed'),
      }),
    });
    expect(mocks.filesystem.deleteFile).toHaveBeenCalledWith({
      path: objectPath(key),
      directory: 'LIBRARY',
    });
    await expect(store.exists(key)).resolves.toBe(false);
  });

  it('cleans an object whose post-write stat reports a directory', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_type_mismatch';
    mocks.filesystem.stat
      .mockRejectedValueOnce(missingError())
      .mockResolvedValueOnce({
        name: key,
        type: 'directory',
        size: 1,
      });

    await expect(
      store.write(key, new Uint8Array([0x01]))
    ).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining('write verification failed'),
      }),
    });
    expect(mocks.filesystem.deleteFile).toHaveBeenCalledWith({
      path: objectPath(key),
      directory: 'LIBRARY',
    });
  });

  it('reads exact raw bytes and rejects a Web-only Blob result', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_read_binary';
    const bytes = new Uint8Array([0x00, 0xff, 0x12]);
    files.set(objectPath(key), bytes);

    await expect(store.read(key)).resolves.toEqual(bytes);
    expect(mocks.filesystem.readFile).toHaveBeenCalledWith({
      path: objectPath(key),
      directory: 'LIBRARY',
    });

    mocks.filesystem.readFile.mockResolvedValueOnce({
      data: new Blob([bytes]),
    });
    await expect(store.read(key)).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining('non-string binary result'),
      }),
    });
  });

  it('rejects corrupted raw base64 and missing reads', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    mocks.filesystem.readFile.mockResolvedValueOnce({ data: 'AA?=' });
    await expect(store.read('stage3g2_corrupt')).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining('malformed base64'),
      }),
    });

    await expect(store.read('stage3g2_missing')).rejects.toThrow(
      'Android image file read failed'
    );
  });

  it('implements exists with stat and distinguishes missing from other errors', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_exists';

    await expect(store.exists(key)).resolves.toBe(false);
    files.set(objectPath(key), new Uint8Array([0x01]));
    await expect(store.exists(key)).resolves.toBe(true);

    mocks.filesystem.stat.mockRejectedValueOnce(otherFilesystemError());
    await expect(store.exists(key)).rejects.toThrow(
      'Android image file stat failed'
    );
    expect(mocks.filesystem.readFile).not.toHaveBeenCalled();
  });

  it('makes delete idempotent while propagating non-missing errors', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const key = 'stage3g2_delete';
    files.set(objectPath(key), new Uint8Array([0x01]));

    await expect(store.delete(key)).resolves.toBeUndefined();
    await expect(store.delete(key)).resolves.toBeUndefined();
    mocks.filesystem.deleteFile.mockRejectedValueOnce(otherFilesystemError());
    await expect(store.delete(key)).rejects.toThrow(
      'Android image file delete failed'
    );
  });

  it('returns an empty list for a missing object directory', async () => {
    const store = await createCapacitorAndroidImageFileStore();

    await expect(store.listObjectKeys()).resolves.toEqual([]);
    expect(mocks.filesystem.readdir).toHaveBeenCalledWith({
      path: IMAGE_OBJECT_RELATIVE_ROOT,
      directory: 'LIBRARY',
    });
  });

  it('lists only validated direct file keys without adding an order contract', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    await store.write('stage3g2_list_a', new Uint8Array([0xa1]));
    await store.write('stage3g2_list_b', new Uint8Array([0xb2]));

    const keys = await store.listObjectKeys();
    expect(new Set(keys)).toEqual(
      new Set(['stage3g2_list_a', 'stage3g2_list_b'])
    );
  });

  it.each([
    [{ name: '../outside', type: 'file', size: 1 }],
    [{ name: 'nested', type: 'directory', size: 0 }],
  ])('rejects invalid or nested directory entries', async entry => {
    const store = await createCapacitorAndroidImageFileStore();
    directories.add(IMAGE_OBJECT_RELATIVE_ROOT);
    mocks.filesystem.readdir.mockResolvedValueOnce({ files: [entry] });

    await expect(store.listObjectKeys()).rejects.toMatchObject({
      cause: expect.objectContaining({
        message: expect.stringContaining(
          'Android image object directory invariant failed'
        ),
      }),
    });
  });

  it('runtime-validates every object key before calling the plugin', async () => {
    const store = await createCapacitorAndroidImageFileStore();
    const invalidKey = '../escape' as ImageObjectKey;

    await expect(store.write(invalidKey, new Uint8Array([1]))).rejects.toThrow(
      'Invalid image object key'
    );
    await expect(store.read(invalidKey)).rejects.toThrow(
      'Invalid image object key'
    );
    await expect(store.delete(invalidKey)).rejects.toThrow(
      'Invalid image object key'
    );
    await expect(store.exists(invalidKey)).rejects.toThrow(
      'Invalid image object key'
    );
    expect(mocks.filesystem.writeFile).not.toHaveBeenCalled();
    expect(mocks.filesystem.readFile).not.toHaveBeenCalled();
    expect(mocks.filesystem.deleteFile).not.toHaveBeenCalled();
    expect(mocks.filesystem.stat).not.toHaveBeenCalled();
  });
});
