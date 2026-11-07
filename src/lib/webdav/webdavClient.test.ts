import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloudFetch } from '@/lib/sync/cloudHttp';
import { WebDAVClient } from './webdavClient';
import { detectAppRuntime } from '@/lib/app/runtime';

vi.mock('@/lib/sync/cloudHttp', () => ({ cloudFetch: vi.fn() }));
vi.mock('@/lib/app/runtime', () => ({ detectAppRuntime: vi.fn() }));

const fetch = vi.mocked(cloudFetch);
const key = 'brew-guide-data.json';
const probe = '.brew-guide-sync-check-test.json';
const client = () =>
  new WebDAVClient({
    url: 'https://dav.example.com',
    username: 'user',
    password: 'password',
    remotePath: 'brew',
  });

function respond(status: number, headers?: HeadersInit, body?: string) {
  fetch.mockResolvedValueOnce(new Response(body ?? null, { status, headers }));
}

function verifiedProbe() {
  respond(200, { 'Lock-Token': '<urn:uuid:probe>' });
  respond(423);
  respond(412);
  respond(204);
  respond(204);
  respond(412);
}

describe('WebDAV locked sync upload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(detectAppRuntime).mockReturnValue({
      runtime: 'web',
      capacitorPlatform: null,
    });
  });

  it('does not mistake note text for a WebDAV error response', async () => {
    const content = JSON.stringify({
      data: { note: '<d:error> ObjectNotFound does not exist' },
    });
    respond(200, { ETag: '"v1"' }, content);
    expect(await client().readSyncFile(key)).toEqual({ content, etag: '"v1"' });
  });

  it.each(['web', 'tauri', 'capacitor'] as const)(
    'prevents cached reads without adding browser preflight headers (%s)',
    async runtime => {
      vi.mocked(detectAppRuntime).mockReturnValue({
        runtime,
        capacitorPlatform: runtime === 'capacitor' ? 'android' : null,
      });
      respond(200, { ETag: '"v1"' }, '{}');
      await client().readSyncFile(key);
      const request = fetch.mock.calls[0][1];
      const headers = new Headers(request?.headers);
      expect(headers.get('Cache-Control')).toBe(
        runtime === 'web' ? null : 'no-cache'
      );
      expect(headers.has('Authorization')).toBe(true);
      expect(request?.cache).toBe('no-store');
    }
  );

  it('still rejects an XML error returned with a successful HTTP status', async () => {
    respond(
      200,
      { ETag: '"v1"' },
      ' <d:error xmlns:d="DAV:">ObjectNotFound</d:error>'
    );
    await expect(client().readSyncFile(key)).rejects.toThrow(
      'WebDAV 返回错误响应'
    );
  });

  it('verifies the proxy, rereads under lock, and writes with its token', async () => {
    verifiedProbe();
    respond(200, { 'Lock-Token': '<urn:uuid:main>' });
    respond(200, { ETag: '"v1"' }, '{}');
    respond(200);
    respond(204);
    respond(204);
    expect(
      await client().uploadFileWithLock(key, '{"merged":true}', '"v1"', probe)
    ).toBe(true);
    const main = fetch.mock.calls.filter(([url]) => url.endsWith(key));
    expect(main.map(([, init]) => init?.method || 'GET')).toEqual([
      'LOCK',
      'GET',
      'LOCK',
      'PUT',
      'UNLOCK',
    ]);
    expect(new Headers(main[3][1]?.headers).get('If')).toBe(
      '(<urn:uuid:main>)'
    );
    expect(main[3][1]?.body).toBe('{"merged":true}');
    expect(main[2][1]?.body).toBeUndefined();
  });

  it('does not write when another device changed the version before locking', async () => {
    verifiedProbe();
    respond(200, { 'Lock-Token': '<urn:uuid:main>' });
    respond(200, { ETag: '"v2"' }, '{}');
    respond(204);
    expect(
      await client().uploadFileWithLock(key, '{}', '"v1"', probe)
    ).toMatchObject({ success: false });
    expect(
      fetch.mock.calls.some(
        ([url, init]) => url.endsWith(key) && init?.method === 'PUT'
      )
    ).toBe(false);
    expect(fetch.mock.calls.at(-1)?.[1]?.method).toBe('UNLOCK');
  });

  it('rejects a proxy that strips If even if LOCK succeeds', async () => {
    respond(200, { 'Lock-Token': '<urn:uuid:probe>' });
    respond(204);
    respond(204);
    respond(204);
    expect(
      await client().uploadFileWithLock(key, '{}', '"v1"', probe)
    ).toMatchObject({ success: false });
    expect(fetch.mock.calls.every(([url]) => url.endsWith(probe))).toBe(true);
  });

  it('rejects servers accepting a released token before touching real data', async () => {
    respond(200, { 'Lock-Token': '<urn:uuid:probe>' });
    respond(423);
    respond(412);
    respond(204);
    respond(204);
    respond(204);
    expect(
      await client().uploadFileWithLock(key, '{}', '"v1"', probe)
    ).toMatchObject({ success: false });
    expect(fetch.mock.calls.every(([url]) => url.endsWith(probe))).toBe(true);
  });

  it('treats lock expiry during the final PUT as failure and releases the lock', async () => {
    verifiedProbe();
    respond(200, { 'Lock-Token': '<urn:uuid:main>' });
    respond(200, { ETag: '"v1"' }, '{}');
    respond(200);
    respond(412);
    respond(409);
    expect(
      await client().uploadFileWithLock(key, '{}', '"v1"', probe)
    ).toMatchObject({ success: false });
    expect(fetch.mock.calls.at(-1)?.[1]?.method).toBe('UNLOCK');
  });

  it('creates a new file only when LOCK reserved a previously unmapped URL', async () => {
    verifiedProbe();
    respond(201, { 'Lock-Token': '<urn:uuid:main>' });
    respond(200, { ETag: '"empty"' }, '');
    respond(200);
    respond(201);
    respond(204);
    expect(await client().uploadFileWithLock(key, '{}', null, probe)).toBe(
      true
    );
  });

  it('does not overwrite a file created by another device after the initial GET', async () => {
    verifiedProbe();
    respond(200, { 'Lock-Token': '<urn:uuid:main>' });
    respond(204);
    expect(
      await client().uploadFileWithLock(key, '{}', null, probe)
    ).toMatchObject({ success: false });
    expect(
      fetch.mock.calls.some(
        ([url, init]) => url.endsWith(key) && init?.method === 'PUT'
      )
    ).toBe(false);
  });

  it('cleans up its empty reservation on refresh failure without replacing the error', async () => {
    verifiedProbe();
    respond(201, { 'Lock-Token': '<urn:uuid:main>' });
    respond(200, { ETag: '"empty"' }, '');
    respond(412);
    respond(200, { ETag: '"empty"' }, '');
    respond(204);
    expect(
      await client().uploadFileWithLock(key, '{}', null, probe)
    ).toMatchObject({ success: false, error: expect.stringContaining('续期') });
    expect(fetch.mock.calls.at(-1)?.[1]?.method).toBe('DELETE');
    expect(new Headers(fetch.mock.calls.at(-1)?.[1]?.headers).get('If')).toBe(
      '(<urn:uuid:main>)'
    );
  });

  it('does not delete a potentially committed first upload when its response is lost', async () => {
    verifiedProbe();
    respond(201, { 'Lock-Token': '<urn:uuid:main>' });
    respond(200, { ETag: '"empty"' }, '');
    respond(200);
    fetch.mockRejectedValueOnce(new Error('connection reset'));
    respond(200, { ETag: '"saved"' }, '{"saved":true}');
    respond(204);
    expect(
      await client().uploadFileWithLock(key, '{"saved":true}', null, probe)
    ).toMatchObject({ success: false });
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(
      false
    );
  });

  it('preserves a successful upload and records an unlock warning', async () => {
    verifiedProbe();
    respond(200, { 'Lock-Token': '<urn:uuid:main>' });
    respond(200, { ETag: '"v1"' }, '{}');
    respond(200);
    respond(204);
    respond(500);
    const dav = client();
    expect(await dav.uploadFileWithLock(key, '{}', '"v1"', probe)).toBe(true);
    expect(dav.getLastDiagnostic()).toMatchObject({
      operation: 'unlock',
      ok: false,
    });
  });

  it('never reacquires a lock after refresh fails', async () => {
    verifiedProbe();
    respond(200, { 'Lock-Token': '<urn:uuid:main>' });
    respond(200, { ETag: '"v1"' }, '{}');
    respond(412);
    respond(409);
    expect(
      await client().uploadFileWithLock(key, '{}', '"v1"', probe)
    ).toMatchObject({ success: false, error: expect.stringContaining('续期') });
    const main = fetch.mock.calls.filter(([url]) => url.endsWith(key));
    expect(main.map(([, init]) => init?.method || 'GET')).toEqual([
      'LOCK',
      'GET',
      'LOCK',
      'UNLOCK',
    ]);
    expect(main[2][1]?.body).toBeUndefined();
  });
});
