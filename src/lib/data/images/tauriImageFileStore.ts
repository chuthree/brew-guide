import { encodeRawBase64 } from '@/lib/data/images/imageBinary';
import {
  validateImageObjectKey,
  type NativeImageFileStore,
} from './nativeImageFileStore';

export async function createTauriImageFileStore(): Promise<NativeImageFileStore> {
  if (typeof window === 'undefined' || !('__TAURI__' in window)) {
    throw new Error('Desktop image storage requires Tauri');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  function command<T>(
    operation: string,
    objectKey?: string,
    data?: string
  ): Promise<T> {
    if (objectKey !== undefined) validateImageObjectKey(objectKey);
    return invoke('storage_image', {
      request: {
        operation,
        objectKey,
        data,
      },
    });
  }
  return {
    write: (key, bytes) => command<void>('write', key, encodeRawBase64(bytes)),
    read: async key => new Uint8Array(await command<number[]>('read', key)),
    delete: key => command<void>('delete', key),
    exists: key => command<boolean>('exists', key),
    listObjectKeys: async () => {
      const keys = await command<string[]>('list');
      keys.forEach(validateImageObjectKey);
      return keys;
    },
  };
}
