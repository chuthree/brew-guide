import { createServer, type Server } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { WebDAVClient } from './webdavClient';

// Opt in with a disposable local SFTPGo portable instance; never use user storage.
const serverUrl = process.env.SFTPGO_TEST_URL;
describe.skipIf(!serverUrl)(
  'real SFTPGo through the browser proxy transport',
  () => {
    let proxy: Server;
    let proxyUrl: string;
    const root = `brew-guide-test-${crypto.randomUUID()}`;
    const authorization = `Basic ${btoa('brew-test:brew-test-only')}`;
    let stripIf = false;
    let delayOperation = '';
    let target = '';

    const client = () =>
      new WebDAVClient({
        url: serverUrl!,
        username: 'brew-test',
        password: 'brew-test-only',
        remotePath: root,
        proxyUrl,
      });

    beforeAll(async () => {
      if (new URL(serverUrl!).hostname !== '127.0.0.1') {
        throw new Error(
          'Integration tests only support disposable loopback servers'
        );
      }
      proxy = createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, 'http://127.0.0.1').searchParams.get(
            'url'
          )!;
          if (
            url !== `${serverUrl}/${root}` &&
            !url.startsWith(`${serverUrl}/${root}/`)
          )
            throw new Error('Unexpected target');
          const chunks: Buffer[] = [];
          for await (const chunk of req) chunks.push(Buffer.from(chunk));
          const body = Buffer.concat(chunks);
          const headers = new Headers();
          for (const [key, value] of Object.entries(req.headers)) {
            if (
              value &&
              !['host', 'connection', 'content-length'].includes(key)
            ) {
              headers.set(key, Array.isArray(value) ? value.join(',') : value);
            }
          }
          if (stripIf) headers.delete('If');
          if (url.endsWith(`/${target}`) && delayOperation) {
            if (req.method === 'LOCK') headers.set('Timeout', 'Second-1');
            if (
              (delayOperation === 'refresh' &&
                req.method === 'LOCK' &&
                !body.length) ||
              (delayOperation === 'put' && req.method === 'PUT')
            )
              await delay(1200);
          }
          const upstream = await fetch(url, {
            method: req.method,
            headers,
            body: body.length ? body : undefined,
          });
          const data = Buffer.from(await upstream.arrayBuffer());
          res.writeHead(upstream.status, Object.fromEntries(upstream.headers));
          res.end(data);
        } catch {
          res.writeHead(502).end();
        }
      });
      await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
      const address = proxy.address();
      if (!address || typeof address === 'string')
        throw new Error('Missing proxy address');
      proxyUrl = `http://127.0.0.1:${address.port}/?url=`;
      expect(await client().uploadFile('seed.json', '{}')).toBe(true);
    });

    beforeEach(() => {
      stripIf = false;
      delayOperation = '';
      target = `${crypto.randomUUID()}.json`;
    });

    afterAll(async () => {
      try {
        if (proxyUrl) {
          const deleted = await fetch(`${serverUrl}/${root}`, {
            method: 'DELETE',
            headers: { Authorization: authorization },
          });
          expect(deleted.ok || deleted.status === 404).toBe(true);
        }
      } finally {
        if (proxy)
          await new Promise<void>((resolve, reject) =>
            proxy.close(error => (error ? reject(error) : resolve()))
          );
      }
    });

    async function probe(dav: WebDAVClient) {
      const key = `.probe-${crypto.randomUUID()}.json`;
      expect(await dav.uploadFile(key, '{}')).toBe(true);
      return key;
    }

    it('reproduces ignored HTTP conditional headers, then creates and updates with locks', async () => {
      const dav = client();
      const check = await probe(dav);
      expect(await dav.uploadFile(check, '{}', '"missing"')).toBe(true);
      expect(await dav.uploadFile(check, '{}', null)).toBe(true);
      expect(await dav.readSyncFile(target)).toBeNull();
      expect(
        await dav.uploadFileWithLock(target, '{"first":true}', null, check)
      ).toBe(true);
      const first = await dav.readSyncFile(target);
      expect(first?.content).toBe('{"first":true}');
      expect(
        await dav.uploadFileWithLock(
          target,
          '{"second":true}',
          first!.etag,
          check
        )
      ).toBe(true);
      expect((await dav.readSyncFile(target))?.content).toBe('{"second":true}');
    });

    it.each(['create', 'update'])(
      'allows only one of two concurrent %s writers',
      async mode => {
        const devices = [client(), client()];
        let etag: string | null = null;
        if (mode === 'update') {
          expect(await devices[0].uploadFile(target, '{"base":true}')).toBe(
            true
          );
          etag = (await devices[0].readSyncFile(target))!.etag;
        }
        const checks = await Promise.all(devices.map(probe));
        const contents = ['{"device":"a"}', '{"device":"b"}'];
        const results = await Promise.all(
          devices.map((dav, i) =>
            dav.uploadFileWithLock(target, contents[i], etag, checks[i])
          )
        );
        expect(results.filter(result => result === true)).toHaveLength(1);
        expect((await devices[0].readSyncFile(target))?.content).toBe(
          contents[results.indexOf(true)]
        );
      }
    );

    it.each(['refresh', 'put'])(
      'rejects a token that expires before %s without changing existing content',
      async operation => {
        const dav = client();
        expect(await dav.uploadFile(target, '{"base":true}')).toBe(true);
        const etag = (await dav.readSyncFile(target))!.etag;
        const check = await probe(dav);
        delayOperation = operation;
        expect(
          await dav.uploadFileWithLock(target, '{"changed":true}', etag, check)
        ).toMatchObject({ success: false });
        expect((await dav.readSyncFile(target))?.content).toBe('{"base":true}');
      }
    );

    it('rejects a proxy that strips If', async () => {
      const dav = client();
      const check = await probe(dav);
      stripIf = true;
      expect(
        await dav.uploadFileWithLock(target, '{}', null, check)
      ).toMatchObject({ success: false });
      expect(await dav.readSyncFile(target)).toBeNull();
    });
  }
);
