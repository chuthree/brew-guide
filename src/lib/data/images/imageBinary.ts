export interface ImageBinary {
  mimeType: string;
  bytes: Uint8Array;
}

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_VALUES = new Int16Array(128).fill(-1);
for (let index = 0; index < BASE64_ALPHABET.length; index += 1) {
  BASE64_VALUES[BASE64_ALPHABET.charCodeAt(index)] = index;
}

const IMAGE_MIME_PATTERN = /^image\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/i;
const BASE64_CHUNK_BYTES = 0x6000;

function assertImageMimeType(mimeType: unknown): asserts mimeType is string {
  if (
    typeof mimeType !== 'string' ||
    !IMAGE_MIME_PATTERN.test(mimeType) ||
    mimeType.toLowerCase() === 'image/*'
  ) {
    throw new TypeError('Invalid image MIME type');
  }
}

function assertCanonicalBase64(
  base64: string,
  context: 'image Data URL' | 'raw base64'
): void {
  // Avoid repeated grouped regexes: multi-MiB images can overflow the engine's stack.
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const payloadLength = base64.length - padding;
  if (base64.length % 4 !== 0) {
    throw new TypeError(`Invalid ${context}: malformed base64 payload`);
  }
  for (let index = 0; index < payloadLength; index++) {
    const code = base64.charCodeAt(index);
    if (code >= BASE64_VALUES.length || BASE64_VALUES[code] < 0) {
      throw new TypeError(`Invalid ${context}: malformed base64 payload`);
    }
  }

  if (base64.endsWith('==')) {
    const secondSextet = BASE64_VALUES[base64.charCodeAt(base64.length - 3)];
    if ((secondSextet & 0x0f) !== 0) {
      throw new TypeError(`Invalid ${context}: malformed base64 padding`);
    }
  } else if (base64.endsWith('=')) {
    const thirdSextet = BASE64_VALUES[base64.charCodeAt(base64.length - 2)];
    if ((thirdSextet & 0x03) !== 0) {
      throw new TypeError(`Invalid ${context}: malformed base64 padding`);
    }
  }
}

function decodeBase64(base64: string): Uint8Array {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array((base64.length / 4) * 3 - padding);
  let byteIndex = 0;

  for (let index = 0; index < base64.length; index += 4) {
    const first = BASE64_VALUES[base64.charCodeAt(index)];
    const second = BASE64_VALUES[base64.charCodeAt(index + 1)];
    const third =
      base64[index + 2] === '='
        ? 0
        : BASE64_VALUES[base64.charCodeAt(index + 2)];
    const fourth =
      base64[index + 3] === '='
        ? 0
        : BASE64_VALUES[base64.charCodeAt(index + 3)];

    bytes[byteIndex] = (first << 2) | (second >> 4);
    byteIndex += 1;
    if (byteIndex < bytes.length) {
      bytes[byteIndex] = ((second & 0x0f) << 4) | (third >> 2);
      byteIndex += 1;
    }
    if (byteIndex < bytes.length) {
      bytes[byteIndex] = ((third & 0x03) << 6) | fourth;
      byteIndex += 1;
    }
  }

  return bytes;
}

export function decodeRawBase64(base64: string): Uint8Array {
  if (typeof base64 !== 'string') {
    throw new TypeError('Invalid raw base64 value');
  }
  assertCanonicalBase64(base64, 'raw base64');
  return decodeBase64(base64);
}

export function encodeRawBase64(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Invalid raw base64 value: bytes must be Uint8Array');
  }
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('Base64 encoding is unavailable in this runtime');
  }

  const chunks: string[] = [];
  for (
    let offset = 0;
    offset < bytes.byteLength;
    offset += BASE64_CHUNK_BYTES
  ) {
    const chunk = bytes.subarray(
      offset,
      Math.min(offset + BASE64_CHUNK_BYTES, bytes.byteLength)
    );
    chunks.push(globalThis.btoa(String.fromCharCode(...chunk)));
  }

  return chunks.join('');
}

export function decodeImageDataUrl(value: string): ImageBinary {
  if (typeof value !== 'string') {
    throw new TypeError('Invalid image Data URL');
  }

  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
  if (!match) {
    throw new TypeError('Invalid image Data URL');
  }

  const [, mimeType, base64] = match;
  assertImageMimeType(mimeType);
  if (base64.length === 0) {
    throw new TypeError('Invalid image Data URL: image payload is empty');
  }
  assertCanonicalBase64(base64, 'image Data URL');

  const bytes = decodeBase64(base64);
  if (bytes.byteLength === 0) {
    throw new TypeError('Invalid image Data URL: image payload is empty');
  }

  return { mimeType, bytes };
}

export function encodeImageDataUrl(image: ImageBinary): string {
  if (!image || typeof image !== 'object') {
    throw new TypeError('Invalid image binary value');
  }

  const { mimeType, bytes } = image;
  assertImageMimeType(mimeType);
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Invalid image binary value: bytes must be Uint8Array');
  }
  if (bytes.byteLength === 0) {
    throw new TypeError('Invalid image binary value: image payload is empty');
  }

  return `data:${mimeType};base64,${encodeRawBase64(bytes)}`;
}
