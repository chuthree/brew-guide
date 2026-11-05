import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requestFile: vi.fn(),
  files: new Map<string, Uint8Array>(),
  readFailure: false,
  deleteFile: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({ requestFile: mocks.requestFile }),
  CapacitorHttp: { request: vi.fn() },
}));
vi.mock('@/lib/app/runtime', () => ({
  detectAppRuntime: () => ({
    runtime: 'capacitor',
    capacitorPlatform: 'android',
  }),
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Cache: 'CACHE' },
  Filesystem: {
    writeFile: async ({ path, data }: { path: string; data: string }) => {
      mocks.files.set(path, Buffer.from(data, 'base64'));
    },
    appendFile: async ({ path, data }: { path: string; data: string }) => {
      const bytes = Buffer.from(data, 'base64');
      expect(bytes.length).toBeLessThanOrEqual(256 * 1024);
      mocks.files.set(path, Buffer.concat([mocks.files.get(path)!, bytes]));
    },
    readFileInChunks: async (
      { path, chunkSize }: { path: string; chunkSize: number },
      callback: (chunk: { data: string } | null, error?: Error) => void
    ) => {
      if (mocks.readFailure) {
        callback(null, new Error('read failed'));
        return 'callback';
      }
      const bytes = mocks.files.get(path)!;
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        callback({
          data: Buffer.from(
            bytes.subarray(offset, offset + chunkSize)
          ).toString('base64'),
        });
      }
      callback({ data: '' });
      return 'callback';
    },
    deleteFile: mocks.deleteFile,
  },
}));

import { cloudFetch } from './cloudHttp';

describe('Android cloud HTTP file transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.files.clear();
    mocks.readFailure = false;
    mocks.deleteFile.mockImplementation(async ({ path }: { path: string }) => {
      mocks.files.delete(path);
    });
  });

  it('transfers large Unicode and binary bodies exactly through bounded chunks', async () => {
    const text = '咖啡🌱'.repeat(300000);
    const bytes = new TextEncoder().encode(text);
    bytes[0] = 0;
    bytes[1] = 255;
    mocks.requestFile.mockImplementation(async options => {
      expect(options.body).toBeUndefined();
      expect(options.headers['if-match']).toBe('"version"');
      expect(
        Buffer.compare(Buffer.from(mocks.files.get(options.bodyFile)!), bytes)
      ).toBe(0);
      mocks.files.set(options.responseFile, bytes);
      return {
        status: 200,
        headers: { ETag: '"next"' },
      };
    });

    const response = await cloudFetch('https://example.com/data', {
      method: 'PUT',
      headers: { 'If-Match': '"version"' },
      body: bytes,
    });

    expect(
      Buffer.compare(Buffer.from(await response.arrayBuffer()), bytes)
    ).toBe(0);
    expect(response.headers.get('etag')).toBe('"next"');
    expect(mocks.files.size).toBe(0);
    expect(mocks.deleteFile).toHaveBeenCalledTimes(2);
  });

  it('preserves an HTTP error response without a request body', async () => {
    mocks.requestFile.mockImplementation(async options => {
      expect(options.bodyFile).toBeUndefined();
      mocks.files.set(
        options.responseFile,
        new TextEncoder().encode('conflict')
      );
      return { status: 412, headers: {} };
    });
    const response = await cloudFetch('https://example.com/data');
    expect(response.status).toBe(412);
    expect(await response.text()).toBe('conflict');
    expect(mocks.files.size).toBe(0);
  });

  it.each([
    ['HEAD', 200],
    ['GET', 204],
    ['GET', 304],
  ])('returns no body for %s with status %i', async (method, status) => {
    mocks.readFailure = true;
    mocks.requestFile.mockResolvedValue({
      status,
      headers: {},
    });
    const response = await cloudFetch('https://example.com/data', { method });
    expect(response.status).toBe(status);
    expect(await response.text()).toBe('');
    expect(mocks.files.size).toBe(0);
  });

  it.each(['request', 'read'])(
    'removes temporary files after a %s failure',
    async failure => {
      mocks.readFailure = failure === 'read';
      mocks.requestFile.mockImplementation(async options => {
        mocks.files.set(options.responseFile, new Uint8Array([1]));
        if (failure === 'request') throw new Error('request failed');
        return { status: 200, headers: {} };
      });
      await expect(
        cloudFetch('https://example.com/data', { method: 'PUT', body: 'test' })
      ).rejects.toThrow(`${failure} failed`);
      expect(mocks.files.size).toBe(0);
    }
  );
});
