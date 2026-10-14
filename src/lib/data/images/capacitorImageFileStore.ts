import { Capacitor } from '@capacitor/core';
import {
  decodeRawBase64,
  encodeRawBase64,
} from '@/lib/data/images/imageBinary';
import {
  IMAGE_OBJECT_RELATIVE_ROOT,
  toImageRelativePath,
  validateImageObjectKey,
} from '@/lib/data/images/nativeImageFileStore';
import type {
  ImageObjectKey,
  NativeImageFileStore,
} from '@/lib/data/images/nativeImageFileStore';

const FILESYSTEM_MISSING_ERROR_CODE = 'OS-PLUG-FILE-0008';

interface FilesystemEntry {
  name: string;
  type: 'file' | 'directory';
  size: number;
}

interface FilesystemFacade {
  writeFile(options: {
    path: string;
    directory: string;
    data: string;
    recursive: true;
  }): Promise<unknown>;
  readFile(options: {
    path: string;
    directory: string;
  }): Promise<{ data: string | Blob }>;
  deleteFile(options: { path: string; directory: string }): Promise<void>;
  stat(options: { path: string; directory: string }): Promise<FilesystemEntry>;
  readdir(options: {
    path: string;
    directory: string;
  }): Promise<{ files: FilesystemEntry[] }>;
}

function isFilesystemMissingError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === FILESYSTEM_MISSING_ERROR_CODE
  );
}

function operationError(
  operation: string,
  objectKey: string | undefined,
  cause: unknown,
  platformName: string
): Error {
  const target = objectKey ? ` for object key ${objectKey}` : '';
  return new Error(`${platformName} image file ${operation} failed${target}`, {
    cause,
  });
}

function unexpectedEntryError(
  reason: string,
  platformName: string,
  cause?: unknown
): Error {
  return new Error(
    `${platformName} image object directory invariant failed: ${reason}`,
    {
      ...(cause !== undefined ? { cause } : {}),
    }
  );
}

function createFileStore(
  filesystem: FilesystemFacade,
  directory: string,
  platformName: string
): NativeImageFileStore {
  const inFlightWrites = new Set<ImageObjectKey>();

  async function statOrMissing(
    path: string
  ): Promise<FilesystemEntry | undefined> {
    try {
      return await filesystem.stat({ path, directory });
    } catch (error) {
      if (isFilesystemMissingError(error)) return undefined;
      // iOS can wrap Cocoa not-found errors as generic operation failures.
      // Prove absence by listing the parent, preserving real access errors.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'OS-PLUG-FILE-0013'
      ) {
        const slash = path.lastIndexOf('/');
        const parent = slash < 0 ? '' : path.slice(0, slash);
        const name = path.slice(slash + 1);
        if (parent && !(await statOrMissing(parent))) return undefined;
        const result = await filesystem.readdir({ path: parent, directory });
        if (!result.files.some(entry => entry.name === name)) return undefined;
      }
      throw error;
    }
  }

  async function bestEffortDelete(path: string): Promise<void> {
    try {
      await filesystem.deleteFile({ path, directory });
    } catch {
      // Keep the original write or verification failure as the primary error.
    }
  }

  return {
    async write(objectKey, bytes) {
      validateImageObjectKey(objectKey);
      const path = toImageRelativePath(objectKey);
      const base64 = encodeRawBase64(bytes);

      if (inFlightWrites.has(objectKey)) {
        throw new Error(
          `${platformName} image object write is already in flight for key ${objectKey}`
        );
      }
      // Reserve synchronously before the first await; only this instance is serialized.
      inFlightWrites.add(objectKey);
      let pathWasConfirmedMissing = false;

      try {
        const existing = await statOrMissing(path);
        if (existing) {
          throw new Error(
            `${platformName} image object key already exists: ${objectKey}`
          );
        }
        pathWasConfirmedMissing = true;

        await filesystem.writeFile({
          path,
          directory,
          data: base64,
          recursive: true,
        });

        const written = await filesystem.stat({ path, directory });
        if (written.type !== 'file' || written.size !== bytes.byteLength) {
          throw new Error('Native image file write verification failed');
        }
        pathWasConfirmedMissing = false;
      } catch (error) {
        if (pathWasConfirmedMissing) await bestEffortDelete(path);
        throw operationError('write', objectKey, error, platformName);
      } finally {
        inFlightWrites.delete(objectKey);
      }
    },

    async read(objectKey) {
      validateImageObjectKey(objectKey);
      const path = toImageRelativePath(objectKey);
      try {
        const result = await filesystem.readFile({ path, directory });
        if (typeof result.data !== 'string') {
          throw new TypeError(
            `${platformName} image filesystem returned a non-string binary result`
          );
        }
        return decodeRawBase64(result.data);
      } catch (error) {
        throw operationError('read', objectKey, error, platformName);
      }
    },

    async delete(objectKey) {
      validateImageObjectKey(objectKey);
      const path = toImageRelativePath(objectKey);
      try {
        await filesystem.deleteFile({ path, directory });
      } catch (error) {
        if (isFilesystemMissingError(error)) return;
        if (!(await statOrMissing(path))) return;
        throw operationError('delete', objectKey, error, platformName);
      }
    },

    async exists(objectKey) {
      validateImageObjectKey(objectKey);
      const path = toImageRelativePath(objectKey);
      try {
        const entry = await statOrMissing(path);
        if (!entry) return false;
        if (entry.type !== 'file') {
          throw unexpectedEntryError(
            'object key resolves to a directory',
            platformName
          );
        }
        return true;
      } catch (error) {
        throw operationError('stat', objectKey, error, platformName);
      }
    },

    async listObjectKeys() {
      try {
        // iOS readdir reports a generic operation failure for a missing
        // directory; statOrMissing confirms absence without hiding access errors.
        const root = await statOrMissing(IMAGE_OBJECT_RELATIVE_ROOT);
        if (!root) return [];
        if (root.type !== 'directory') {
          throw unexpectedEntryError(
            'object root is not a directory',
            platformName
          );
        }
        const result = await filesystem.readdir({
          path: IMAGE_OBJECT_RELATIVE_ROOT,
          directory,
        });
        if (!result || !Array.isArray(result.files)) {
          throw unexpectedEntryError(
            'readdir returned an invalid result',
            platformName
          );
        }

        return result.files.map(entry => {
          if (entry.type !== 'file') {
            throw unexpectedEntryError('nested directory found', platformName);
          }
          try {
            validateImageObjectKey(entry.name);
          } catch (error) {
            throw unexpectedEntryError(
              'invalid object filename',
              platformName,
              error
            );
          }
          return entry.name;
        });
      } catch (error) {
        if (isFilesystemMissingError(error)) return [];
        throw operationError('list', undefined, error, platformName);
      }
    },
  };
}

/** Create a per-instance Native store. Load Filesystem only after the platform gate. */
export async function createCapacitorImageFileStore(): Promise<NativeImageFileStore> {
  const platform = Capacitor.getPlatform();
  if (platform !== 'android' && platform !== 'ios') {
    throw new Error(
      `Capacitor Native image file storage is unavailable on platform ${platform}`
    );
  }

  const { Directory, Filesystem } = await import('@capacitor/filesystem');
  return createFileStore(
    Filesystem as unknown as FilesystemFacade,
    Directory.Library,
    platform === 'android' ? 'Android' : 'iOS'
  );
}
