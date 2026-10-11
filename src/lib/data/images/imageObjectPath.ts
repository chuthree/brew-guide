import { nanoid } from 'nanoid';

const IMAGE_OBJECT_KEY_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

export const IMAGE_OBJECT_RELATIVE_ROOT = 'images/v1/objects';

export function validateImageObjectKey(
  value: unknown
): asserts value is string {
  if (typeof value !== 'string' || !IMAGE_OBJECT_KEY_PATTERN.test(value)) {
    throw new TypeError('Invalid image object key');
  }
}

export function createImageObjectKey(): string {
  const objectKey = nanoid(21);
  validateImageObjectKey(objectKey);
  return objectKey;
}

export function toImageRelativePath(objectKey: string): string {
  validateImageObjectKey(objectKey);
  return `${IMAGE_OBJECT_RELATIVE_ROOT}/${objectKey}`;
}

export function parseImageRelativePath(relativePath: string): string {
  if (typeof relativePath !== 'string') {
    throw new TypeError('Invalid image relative path');
  }

  const prefix = `${IMAGE_OBJECT_RELATIVE_ROOT}/`;
  if (!relativePath.startsWith(prefix)) {
    throw new TypeError('Invalid image relative path');
  }

  const objectKey = relativePath.slice(prefix.length);
  try {
    validateImageObjectKey(objectKey);
  } catch {
    throw new TypeError('Invalid image relative path');
  }
  return objectKey;
}
