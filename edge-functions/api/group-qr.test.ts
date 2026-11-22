import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import onRequest from './group-qr.js';

const png = 'data:image/png;base64,iVBORw0KGgo=';
const jpeg = 'data:image/jpeg;base64,/9j/4A==';
const now = new Date('2026-11-22T08:00:00Z').getTime();
const expiresAt = now + 60_000;
const call = (method = 'GET') =>
  onRequest({
    request: new Request('https://example.com/api/group-qr?fresh=1', {
      method,
    }),
  });

describe('group QR edge function', () => {
  beforeEach(() => vi.spyOn(Date, 'now').mockReturnValue(now));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads the current image and expiry together on every GET', async () => {
    const get = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify({ imageDataUrl: png, expiresAt }))
      .mockResolvedValueOnce(
        JSON.stringify({ imageDataUrl: jpeg, expiresAt: expiresAt + 30_000 })
      );
    vi.stubGlobal('GROUP_QR_KV', { get });
    // Exercise runtimes that only provide the Response constructor.
    vi.spyOn(Response, 'json').mockImplementation(() => {
      throw new TypeError('Response.json is not available');
    });
    const first = await call();
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(first.headers.get('access-control-allow-origin')).toBe('*');
    expect(await first.json()).toEqual({ imageDataUrl: png, expiresAt });
    const second = await call();
    expect(await second.json()).toEqual({
      imageDataUrl: jpeg,
      expiresAt: expiresAt + 30_000,
    });
    expect(get.mock.calls).toEqual([
      ['current_group_qr'],
      ['current_group_qr'],
    ]);
  });

  it.each([
    null,
    'bad JSON',
    JSON.stringify({ imageDataUrl: png, expiresAt: now }),
    JSON.stringify({ imageDataUrl: png, expiresAt: now + 8 * 86_400_000 }),
    JSON.stringify({
      imageDataUrl: 'data:image/svg+xml;base64,AAAA',
      expiresAt,
    }),
    JSON.stringify({ imageDataUrl: 'data:image/png;base64,AAAA', expiresAt }),
  ])('does not serve missing, expired, or invalid values (%s)', async value => {
    vi.stubGlobal('GROUP_QR_KV', {
      get: vi.fn().mockResolvedValue(value),
    });
    const response = await call();
    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('falls back with no binding or a KV failure', async () => {
    expect((await call()).status).toBe(404);
    vi.stubGlobal('GROUP_QR_KV', {
      get: vi.fn().mockRejectedValue(new Error('KV offline')),
    });
    expect((await call()).status).toBe(404);
  });

  it('supports CORS preflight but never accepts writes', async () => {
    expect((await call('OPTIONS')).status).toBe(204);
    const response = await call('PUT');
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, OPTIONS');
  });
});
