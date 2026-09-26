import { describe, expect, it } from 'vitest';
import {
  classifyPersistentImageString,
  validateExternalImageUrl,
} from './persistentImageSource';

describe('persistent image source classifier', () => {
  it.each([
    ['data:image/jpeg;base64,/9j/AA==', 'image/jpeg'],
    ['data:image/png;base64,iVBORw0KGgo=', 'image/png'],
    ['data:image/webp;base64,UklGRg==', 'image/webp'],
    ['data:image/gif;base64,R0lGODlhAQAB', 'image/gif'],
  ])('classifies strict %s values as file Data URLs', (value, mimeType) => {
    expect(classifyPersistentImageString(value)).toMatchObject({
      kind: 'file-data-url',
      binary: { mimeType },
    });
  });

  it.each([
    'https://example.com/a.jpg',
    'http://example.com/a.jpg',
    'https://Example.COM/a%2Fb?b=2&a=1#Frag',
    'https://example.com/image.jpg?signature=fake-token#preview',
  ])('preserves an accepted external URL exactly: %s', value => {
    expect(classifyPersistentImageString(value)).toEqual({
      kind: 'external',
      url: value,
    });
    expect(validateExternalImageUrl(value)).toBe(value);
  });

  it.each([
    'image-id-123',
    'aGVsbG8=',
    'relative/image.jpg',
    '//example.com/image.jpg',
    'blob:https://example.com/opaque-id',
    'file:///tmp/image.jpg',
    'content://provider/image.jpg',
    'capacitor://localhost/image.jpg',
    'ftp://example.com/image.jpg',
    'javascript:alert(1)',
    'http:///image.jpg',
    ' https://example.com/image.jpg',
    'https://example.com/image.jpg ',
  ])('rejects unsupported reference %s', value => {
    expect(() => classifyPersistentImageString(value)).toThrow();
  });

  it.each([
    'https://user@example.com/image.jpg',
    'https://user:secret@example.com/image.jpg?token=fake-secret',
    'https://@example.com/image.jpg',
    'https://:@example.com/image.jpg',
  ])('rejects credentials without exposing the supplied URL: %s', value => {
    let errorMessage = '';
    try {
      classifyPersistentImageString(value);
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    expect(errorMessage).toMatch(/credentials are not allowed/);
    expect(errorMessage).not.toContain('secret');
    expect(errorMessage).not.toContain('token=');
    expect(errorMessage).not.toContain(value);
  });

  it.each([
    'data:image/jpeg;base64,',
    'data:image/png;charset=utf-8;base64,AAAA',
    'data:text/plain;base64,SGVsbG8=',
    'data:https://example.com/image.jpg',
  ])(
    'rejects malformed or non-image Data URL without URL fallback: %s',
    value => {
      expect(() => classifyPersistentImageString(value)).toThrow();
    }
  );

  it('rejects empty candidates without assigning patch semantics', () => {
    expect(() => classifyPersistentImageString('')).toThrow(
      'Unsupported persistent image value'
    );
  });
});
