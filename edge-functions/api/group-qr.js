/* global GROUP_QR_KV */

export const GROUP_QR_KEY = 'current_group_qr';
export const MAX_QR_DATA_URL_LENGTH = 1_400_000;
export const MAX_QR_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Cache-Control': 'no-store',
};

export function validateGroupQr(record, now = Date.now()) {
  const { imageDataUrl, expiresAt } = record ?? {};
  if (
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= now ||
    expiresAt > now + MAX_QR_LIFETIME_MS ||
    typeof imageDataUrl !== 'string' ||
    imageDataUrl.length > MAX_QR_DATA_URL_LENGTH
  ) {
    return null;
  }

  const match = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
    imageDataUrl
  );
  if (!match || match[0] !== imageDataUrl) return null;

  const [, mediaType, data] = match;
  if (data.length % 4 !== 0) return null;
  const signature = mediaType === 'png' ? '\x89PNG\r\n\x1a\n' : '\xff\xd8\xff';
  if (!atob(data.slice(0, 12)).startsWith(signature)) return null;
  return { imageDataUrl, expiresAt };
}

export default async function onRequest({ request }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== 'GET') {
    return new Response(null, {
      status: 405,
      headers: { ...headers, Allow: 'GET, OPTIONS' },
    });
  }

  let code = null;
  try {
    const kv =
      globalThis.GROUP_QR_KV ||
      (typeof GROUP_QR_KV !== 'undefined' ? GROUP_QR_KV : null);
    const raw = await kv?.get(GROUP_QR_KEY);
    if (raw) code = validateGroupQr(JSON.parse(raw));
  } catch {
    // An unavailable or invalid record must never hide the offline fallback.
  }
  return code
    ? new Response(JSON.stringify(code), {
        headers: {
          ...headers,
          'Content-Type': 'application/json; charset=utf-8',
        },
      })
    : new Response(null, { status: 404, headers });
}
