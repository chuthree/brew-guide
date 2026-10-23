import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import {
  validateImageObjectKey,
  toImageRelativePath,
} from '@/lib/data/images/nativeImageFileStore';
import {
  encodeRawBase64,
  decodeRawBase64,
} from '@/lib/data/images/imageBinary';
import { host } from './host';
export async function createTauriImageFileStore(): Promise<NativeImageFileStore> {
  const path = (key: string) => {
    validateImageObjectKey(key);
    return toImageRelativePath(key);
  };
  return {
    async read(key) {
      return decodeRawBase64(
        host<{ base64: string }>('files.read', { relativePath: path(key) })
          .base64
      );
    },
    async write(key, bytes) {
      host('files.write', {
        relativePath: path(key),
        dataBase64: encodeRawBase64(bytes),
      });
    },
    async delete(key) {
      host('files.delete', { relativePath: path(key) });
    },
    async exists(key) {
      return host<boolean>('files.exists', { relativePath: path(key) });
    },
    async listObjectKeys() {
      const keys = host<string[]>('files.list');
      keys.forEach(validateImageObjectKey);
      return keys;
    },
  };
}
