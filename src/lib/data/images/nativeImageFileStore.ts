/** Opaque file identity; it is separate from SQLite image_id and entity IDs. */
export type ImageObjectKey = string;

/**
 * Storage primitives scoped to Brew Guide's private image-object directory.
 * Implementations must validate every key and must not expose device paths or URIs.
 */
export interface NativeImageFileStore {
  /** Persist bytes under a new key; reject collisions instead of overwriting. */
  write(objectKey: ImageObjectKey, bytes: Uint8Array): Promise<void>;
  /** Read one object; reject when the key does not exist. */
  read(objectKey: ImageObjectKey): Promise<Uint8Array>;
  /** Delete one object; deleting a missing key succeeds. */
  delete(objectKey: ImageObjectKey): Promise<void>;
  /** Check only this key inside the fixed image-object root. */
  exists(objectKey: ImageObjectKey): Promise<boolean>;
  /**
   * Maintenance-only listing of validated direct object keys in objects/.
   * Never recurse or return paths/URIs.
   */
  listObjectKeys(): Promise<ImageObjectKey[]>;
}

// Keep the path grammar and helpers in one pure module shared by adapters.
export {
  createImageObjectKey,
  IMAGE_OBJECT_RELATIVE_ROOT,
  parseImageRelativePath,
  toImageRelativePath,
  validateImageObjectKey,
} from './imageObjectPath';
