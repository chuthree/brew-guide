import type { McpPermissions } from './types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import { listCoffeeBeans } from '@/lib/data/sqlite/repositories/coffeeBean';
import { listCoffeeBeanImageMetadata } from '@/lib/data/sqlite/imageMetadataExecutor';
const native = vi.hoisted(() => ({
  driver: undefined as SqliteDriver | undefined,
  files: undefined as NativeImageFileStore | undefined,
  failProcessing: false,
  processes: 0,
}));
vi.mock('@/lib/data/sqlite/tauriSqliteDriver', () => ({
  openTauriSqliteDriver: async () => {
    if (!native.driver) throw new Error('No fixture');
    return native.driver;
  },
}));
vi.mock('@/lib/data/images/tauriImageFileStore', () => ({
  createTauriImageFileStore: async () => {
    if (!native.files) throw new Error('No fixture');
    return native.files;
  },
}));
vi.mock('@/lib/images/imageProcessing', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/images/imageProcessing')>()),
  processImageFile: async (file: File) => {
    native.processes++;
    if (native.failProcessing) throw new Error('Decode failed');
    return `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`;
  },
}));
import { executeMcpTool } from './tools';
import { MCP_TOOLS } from './toolDefinitions';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const OTHER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/hS0AAAAASUVORK5CYII=';
class Files implements NativeImageFileStore {
  objects = new Map<string, Uint8Array>();
  write = vi.fn(async (key: string, bytes: Uint8Array) => {
    if (this.objects.has(key)) throw new Error('Collision');
    this.objects.set(key, bytes.slice());
  });
  read = vi.fn(async (key: string) => {
    const bytes = this.objects.get(key);
    if (!bytes) throw new Error('Missing');
    return bytes.slice();
  });
  delete = vi.fn(async (key: string) => {
    this.objects.delete(key);
  });
  exists = vi.fn(async (key: string) => this.objects.has(key));
  listObjectKeys = vi.fn(async () => [...this.objects.keys()]);
}
type Bean = {
  imageVersion: string;
  id: string;
  version: string;
  remainingGrams: number;
  capacityGrams: number;
  images: { side: string; source: string; sizeBytes: number }[];
};
type Result = {
  bean: Bean;
  items: Bean[];
  confirmationToken: string;
  version: string;
};
let db: NodeSqliteTestDatabase;
let files: Files;
let seq = 0;
const permissions: McpPermissions = {
  allowWrite: true,
  allowDelete: true,
  grantedDomains: ['beans', 'notes'],
};
const call = async (
  name: string,
  args: Record<string, unknown>,
  grants = permissions
) => (await executeMcpTool(name, args, grants)) as Result;
const requestId = () => `image-integration-${++seq}`;
const create = async (image?: { side: string; dataUrl: string }) =>
  call('create_bean', {
    requestId: requestId(),
    bean: { name: 'Synthetic image bean', capacityGrams: 125 },
    ...(image ? { image } : {}),
  });
const setArgs = (bean: Bean, side = 'front', dataUrl = PNG) => ({
  requestId: requestId(),
  id: bean.id,
  expectedVersion: bean.version,
  expectedImageVersion: bean.imageVersion,
  side,
  dataUrl,
});
const preview = (bean: Bean, side = 'front') =>
  call('preview_delete', { entity: 'bean_image', id: bean.id, side });
const deletion = (bean: Bean, token: string, side = 'front') => ({
  requestId: requestId(),
  id: bean.id,
  expectedVersion: bean.version,
  side,
  confirmationToken: token,
});
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  files = new Files();
  native.driver = db.driver;
  native.files = files;
  native.failProcessing = false;
  native.processes = 0;
});
afterEach(async () => {
  native.driver = undefined;
  native.files = undefined;
  await db.close();
});
describe('MCP image central transaction integration (real SQLite)', () => {
  it('registers the bounded tool catalog and creates a bean/photo atomically without exposing image bodies', async () => {
    expect(MCP_TOOLS.length).toBeLessThanOrEqual(96);
    expect(new Set(MCP_TOOLS.map(tool => tool.name)).size).toBe(
      MCP_TOOLS.length
    );
    const result = await create({ side: 'front', dataUrl: PNG });
    expect(result.bean).toMatchObject({
      remainingGrams: 125,
      capacityGrams: 125,
      images: [{ side: 'front', source: 'file' }],
    });
    expect(files.objects.size).toBe(1);
    expect(native.processes).toBe(1);
    const get = await call('get_bean', { id: result.bean.id });
    const list = await call('list_beans', {});
    const activity = await call('list_mcp_activity', {});
    const serialized = JSON.stringify([result, get, list, activity]);
    expect(serialized).not.toContain('base64');
    expect(serialized).not.toContain('relativePath');
    expect(serialized).not.toContain('relative_path');
    for (const key of files.objects.keys())
      expect(serialized).not.toContain(key);
    const rows = await db.driver.query(
      'SELECT * FROM mcp_operations UNION ALL SELECT request_id,tool,summary,snapshots_json,timestamp_ms FROM mcp_activity'
    );
    expect(JSON.stringify(rows)).not.toContain(PNG);
  });
  it('explicit bean photo reads require the bean domain and an owned image handle', async () => {
    const first = await create({ side: 'front', dataUrl: PNG });
    const info = (
      await listCoffeeBeanImageMetadata(db.driver, first.bean.id)
    )[0];
    const args = { id: first.bean.id, imageId: info.imageId };
    expect(
      await executeMcpTool('get_bean_image', args, {
        allowWrite: false,
        allowDelete: false,
        grantedDomains: ['beans'],
      })
    ).toMatchObject({ image: { status: 'available', dataUrl: PNG } });
    const reads = files.read.mock.calls.length;
    await expect(
      executeMcpTool('get_bean_image', args, {
        allowWrite: false,
        allowDelete: false,
        grantedDomains: ['notes'],
      })
    ).rejects.toThrow();
    expect(files.read).toHaveBeenCalledTimes(reads);
  });
  it('set/replace preserves both side inventory; request replay writes no extra files', async () => {
    const first = await create({ side: 'front', dataUrl: PNG });
    const args = setArgs(first.bean, 'back');
    const second = await call('set_bean_image', args);
    const objects = [...files.objects.keys()];
    const replay = await call('set_bean_image', args);
    expect(replay).toEqual({ ...second, replayed: true });
    expect([...files.objects.keys()]).toEqual(objects);
    expect(native.processes).toBe(2);
    const third = await call(
      'set_bean_image',
      setArgs(second.bean, 'front', OTHER)
    );
    expect(third.bean.remainingGrams).toBe(125);
    expect(third.bean.images.map(image => image.side).sort()).toEqual([
      'back',
      'front',
    ]);
    expect(files.objects.size).toBe(2);
    expect(files.delete).toHaveBeenCalledTimes(1);
    await expect(
      call('set_bean_image', setArgs(first.bean))
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(files.objects.size).toBe(2);
  });
  it('requires delete grant, matched side/token and fresh metadata; removes only selected side', async () => {
    let result = await create({ side: 'front', dataUrl: PNG });
    result = await call('set_bean_image', setArgs(result.bean, 'back'));
    const p = await preview(result.bean);
    const args = deletion(result.bean, p.confirmationToken);
    await expect(
      call('delete_bean_image', args, {
        allowWrite: true,
        allowDelete: false,
        grantedDomains: ['beans', 'notes'],
      })
    ).rejects.toThrow();
    await expect(
      call(
        'delete_bean_image',
        deletion(result.bean, p.confirmationToken, 'back')
      )
    ).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    // A concurrent app metadata edit may not bump the bean version; the preview fingerprint must still reject it.
    await db.driver.execute(
      'UPDATE coffee_bean_images SET updated_at_ms=updated_at_ms+1 WHERE bean_id=?',
      [result.bean.id]
    );
    await expect(call('delete_bean_image', args)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    const fresh = await preview(result.bean);
    const freshArgs = deletion(result.bean, fresh.confirmationToken);
    const removed = await call('delete_bean_image', freshArgs);
    expect(removed.bean.images.map(image => image.side)).toEqual(['back']);
    expect(removed.bean.remainingGrams).toBe(125);
    expect(files.objects.size).toBe(1);
    expect(await call('delete_bean_image', freshArgs)).toEqual({
      ...removed,
      replayed: true,
    });
  });
  it('rejects metadata-only concurrent image changes and altered request retries before decoding or writes', async () => {
    const first = await create({ side: 'front', dataUrl: PNG });
    const args = setArgs(first.bean, 'back');
    const second = await call('set_bean_image', args);
    const count = native.processes;
    const objects = [...files.objects.keys()];
    await expect(
      call('set_bean_image', { ...args, dataUrl: OTHER })
    ).rejects.toThrow();
    await expect(
      call('set_bean_image', setArgs(second.bean), {
        allowWrite: false,
        allowDelete: false,
        grantedDomains: ['beans', 'notes'],
      })
    ).rejects.toThrow();
    await db.driver.execute(
      'UPDATE coffee_bean_images SET updated_at_ms=updated_at_ms+1 WHERE bean_id=?',
      [first.bean.id]
    );
    await expect(
      call('set_bean_image', setArgs(second.bean))
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(native.processes).toBe(count);
    expect([...files.objects.keys()]).toEqual(objects);
  });
  it('invalid image/processor failures leave no bean, metadata, activity or file objects', async () => {
    await expect(
      create({ side: 'front', dataUrl: 'file:///private/image.png' })
    ).rejects.toThrow();
    native.failProcessing = true;
    await expect(create({ side: 'front', dataUrl: PNG })).rejects.toThrow(
      'Image decoding or compression failed'
    );
    expect(await listCoffeeBeans(db.driver)).toEqual([]);
    expect(files.objects.size).toBe(0);
    expect(await db.driver.query('SELECT * FROM coffee_bean_images')).toEqual(
      []
    );
    expect(await db.driver.query('SELECT * FROM mcp_activity')).toEqual([]);
  });
  it('SQL failure after image metadata apply rolls back bean/photo/activity and cleans new objects', async () => {
    const first = await create({ side: 'front', dataUrl: PNG });
    const before = await listCoffeeBeanImageMetadata(db.driver, first.bean.id);
    const objects = [...files.objects.keys()];
    native.driver = {
      ...db.driver,
      execute: db.driver.execute.bind(db.driver),
      query: db.driver.query.bind(db.driver),
      close: db.driver.close.bind(db.driver),
      transaction: work =>
        db.driver.transaction(tx =>
          work({
            ...tx,
            execute: async (sql, args) => {
              if (sql.startsWith('INSERT INTO mcp_activity'))
                throw new Error('Injected audit failure');
              return tx.execute(sql, args);
            },
          })
        ),
    };
    await expect(
      call('set_bean_image', setArgs(first.bean, 'front', OTHER))
    ).rejects.toThrow('Injected audit failure');
    expect(await listCoffeeBeanImageMetadata(db.driver, first.bean.id)).toEqual(
      before
    );
    expect([...files.objects.keys()]).toEqual(objects);
    expect((await call('get_bean', { id: first.bean.id })).bean.version).toBe(
      first.bean.version
    );
    expect(await db.driver.query('SELECT * FROM mcp_activity')).toHaveLength(1);
    await expect(create({ side: 'front', dataUrl: OTHER })).rejects.toThrow(
      'Injected audit failure'
    );
    expect(await listCoffeeBeans(db.driver)).toHaveLength(1);
    expect([...files.objects.keys()]).toEqual(objects);
  });
});
