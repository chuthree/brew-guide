import { describe, expect, it } from 'vitest';
import {
  createImageObjectKey,
  IMAGE_OBJECT_RELATIVE_ROOT,
  parseImageRelativePath,
  toImageRelativePath,
  validateImageObjectKey,
} from './imageObjectPath';

describe('image object keys and relative paths', () => {
  it('generates a high-entropy runtime key in the accepted grammar', () => {
    const objectKey = createImageObjectKey();

    expect(objectKey).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(() => validateImageObjectKey(objectKey)).not.toThrow();
  });

  it('accepts deterministic migration-compatible keys', () => {
    const objectKey = 'migration-coffeeBeans-bean_42-front-original';

    expect(() => validateImageObjectKey(objectKey)).not.toThrow();
    expect(toImageRelativePath(objectKey)).toBe(
      `${IMAGE_OBJECT_RELATIVE_ROOT}/${objectKey}`
    );
  });

  it('round-trips an exact object-root relative path', () => {
    const objectKey = 'Az09_-_migration_key';
    const path = toImageRelativePath(objectKey);

    expect(path).toBe(`images/v1/objects/${objectKey}`);
    expect(parseImageRelativePath(path)).toBe(objectKey);
  });

  it.each([
    '',
    '.',
    '..',
    '../x',
    'a/../b',
    'a/b',
    '\\a',
    '/a',
    'C:\\x',
    'file://x',
    'content://x',
    'http://x',
    'has space',
    'has\nnewline',
    'has\u0000nul',
    'has\u001fcontrol',
    'x'.repeat(129),
  ])('rejects unsafe object key %j', objectKey => {
    expect(() => validateImageObjectKey(objectKey)).toThrow(
      'Invalid image object key'
    );
    expect(() => toImageRelativePath(objectKey)).toThrow(
      'Invalid image object key'
    );
  });

  it.each([
    '../x',
    'a/../b',
    'a/b',
    '\\a',
    '/a',
    'C:\\x',
    'file://x',
    'content://x',
    'http://x',
    'images/v1/objects/../x',
    'images/v1/objects/a/b',
    'images/v2/objects/x',
    'other-root/x',
    `images/v1/objects/has\u0000nul`,
    `images/v1/objects/has\nnewline`,
  ])('rejects unsafe relative path %j', path => {
    expect(() => parseImageRelativePath(path)).toThrow(
      'Invalid image relative path'
    );
  });
});
