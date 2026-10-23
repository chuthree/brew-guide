import { describe, expect, it } from 'vitest';
import {
  decodeImageDataUrl,
  decodeRawBase64,
  encodeImageDataUrl,
  encodeRawBase64,
  type ImageBinary,
} from './imageBinary';

describe('image binary Data URL helpers', () => {
  it('validates and decodes a full 8 MiB payload without regex stack overflow', () => {
    const bytes = new Uint8Array(8 * 1024 * 1024);
    bytes[0] = 255;
    bytes[bytes.length - 1] = 127;
    const encoded = encodeImageDataUrl({ mimeType: 'image/png', bytes });
    const decoded = decodeImageDataUrl(encoded).bytes;
    expect(decoded.length).toBe(bytes.length);
    expect(decoded[0]).toBe(255);
    expect(decoded[decoded.length - 1]).toBe(127);
  });
  it.each([
    'A===',
    'AA=A',
    'AAAA=',
    '=AAA',
    'AA==AA==',
    'ＡAAA',
    'AA A',
    'AB==',
    'AAB=',
  ])('rejects malformed/noncanonical padding %s', value => {
    expect(() => decodeRawBase64(value)).toThrow();
  });

  it.each([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/HEIC',
  ])('preserves the supplied MIME type for %s', mimeType => {
    const image: ImageBinary = { mimeType, bytes: new Uint8Array([0, 255, 1]) };

    const decoded = decodeImageDataUrl(encodeImageDataUrl(image));

    expect(decoded.mimeType).toBe(mimeType);
    expect(decoded.bytes).toEqual(image.bytes);
  });

  it('preserves exact arbitrary bytes including zero and high-bit values', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x80, 0x01, 0x7f, 0x42]);
    const dataUrl = encodeImageDataUrl({ mimeType: 'image/png', bytes });

    expect(dataUrl).toBe('data:image/png;base64,AP+AAX9C');
    expect(decodeImageDataUrl(dataUrl).bytes).toEqual(bytes);
  });

  it('preserves UTF-8 text bytes without treating them as text', () => {
    const bytes = new TextEncoder().encode('咖啡 ☕🌱');
    const decoded = decodeImageDataUrl(
      encodeImageDataUrl({ mimeType: 'image/webp', bytes })
    );

    expect(decoded.bytes).toEqual(bytes);
    expect(new TextDecoder().decode(decoded.bytes)).toBe('咖啡 ☕🌱');
  });

  it('decodes an existing GIF Data URL fixture exactly', () => {
    const dataUrl = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    const decoded = decodeImageDataUrl(dataUrl);

    expect(decoded.mimeType).toBe('image/gif');
    expect(encodeImageDataUrl(decoded)).toBe(dataUrl);
  });

  it('round-trips raw base64 without a Data URL header', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x80, 0x01, 0x7f, 0x42]);
    const base64 = encodeRawBase64(bytes);

    expect(base64).toBe('AP+AAX9C');
    expect(decodeRawBase64(base64)).toEqual(bytes);
  });

  it('preserves empty raw bytes while Data URL images remain non-empty', () => {
    expect(encodeRawBase64(new Uint8Array())).toBe('');
    expect(decodeRawBase64('')).toEqual(new Uint8Array());
    expect(() => decodeImageDataUrl('data:image/png;base64,')).toThrow(
      'image payload is empty'
    );
  });

  it.each(['?', 'AA?=', 'A===', 'AB==', 'AAB='])(
    'rejects malformed raw base64 %s',
    base64 => {
      expect(() => decodeRawBase64(base64)).toThrow();
    }
  );

  it('encodes large values in bounded browser-compatible chunks', () => {
    const bytes = new Uint8Array(0x6000 + 7);
    bytes[0] = 0xff;
    bytes[0x6000] = 0x80;
    bytes[bytes.length - 1] = 0x01;

    expect(
      decodeImageDataUrl(encodeImageDataUrl({ mimeType: 'image/png', bytes }))
        .bytes
    ).toEqual(bytes);
  });

  it.each([
    '',
    'https://example.com/image.png',
    'blob:https://example.com/image',
    'images/v1/objects/image-key',
    '/private/image.png',
    'data:image/png,AAAA',
    'data:image/png;charset=utf-8;base64,AAAA',
    'data:text/plain;base64,AAAA',
    'data:image/png;base64,AA?=',
    'data:image/png;base64,A===',
    'data:image/png;base64,AB==',
    'data:image/png;base64,AAB=',
    'data:image/png;base64,',
    'data:image/*;base64,AAAA',
  ])('rejects unsupported or malformed value %s', value => {
    expect(() => decodeImageDataUrl(value)).toThrow();
  });

  it.each(['', 'text/plain', 'image/*', 'image/png\n'])(
    'rejects invalid MIME type %s when encoding',
    mimeType => {
      expect(() =>
        encodeImageDataUrl({ mimeType, bytes: new Uint8Array([1]) })
      ).toThrow('Invalid image MIME type');
    }
  );

  it('rejects empty binary payloads and non-Uint8Array values', () => {
    expect(() =>
      encodeImageDataUrl({ mimeType: 'image/png', bytes: new Uint8Array() })
    ).toThrow('image payload is empty');
    expect(() =>
      encodeImageDataUrl({
        mimeType: 'image/png',
        bytes: new ArrayBuffer(1) as unknown as Uint8Array,
      })
    ).toThrow('bytes must be Uint8Array');
  });
});
