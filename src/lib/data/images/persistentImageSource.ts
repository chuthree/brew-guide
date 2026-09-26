import { decodeImageDataUrl, type ImageBinary } from './imageBinary';

export type PersistentImageSource =
  | { kind: 'file-data-url'; binary: ImageBinary }
  | { kind: 'external'; url: string };

/** Validate an external image reference without normalizing or logging it. */
export function validateExternalImageUrl(value: string): string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value !== value.trim() ||
    /[\u0000-\u0020\u007f\\]/.test(value) ||
    !/^https?:\/\/[^/?#]/i.test(value)
  ) {
    throw new TypeError('Invalid external image URL');
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError('Invalid external image URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError('External image URL must use HTTP or HTTPS');
  }
  if (!parsed.hostname) {
    throw new TypeError('External image URL must include a host');
  }
  const authority = value.slice(value.indexOf('://') + 3).split(/[/?#]/, 1)[0];
  if (authority.includes('@') || parsed.username || parsed.password) {
    throw new TypeError('External image URL credentials are not allowed');
  }

  return value;
}

/** Classify a non-empty persisted image candidate without doing network I/O. */
export function classifyPersistentImageString(
  value: string
): PersistentImageSource {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('Unsupported persistent image value');
  }

  if (value.startsWith('data:')) {
    return { kind: 'file-data-url', binary: decodeImageDataUrl(value) };
  }

  return { kind: 'external', url: validateExternalImageUrl(value) };
}
