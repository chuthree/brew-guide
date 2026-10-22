import type { McpPermissions } from './types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import { getCoffeeBean } from '@/lib/data/sqlite/repositories/coffeeBean';
import { listBrewingNoteImageMetadata } from '@/lib/data/sqlite/imageMetadataExecutor';
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
import { listBrewingNotes } from '@/lib/data/sqlite/repositories/brewingNote';
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
type Photo = { imageId: string; position: number; hasThumbnail: boolean };
type Note = {
  id: string;
  version: string;
  imageVersion: string;
  images: Photo[];
  coffeeGrams: number;
  notes: string;
};
type Result = {
  note: Note;
  bean: { id: string; version: string; remainingGrams: number };
  confirmationToken: string;
  version: string;
  replayed: boolean;
};
let db: NodeSqliteTestDatabase;
let files: Files;
let seq = 0;
let beanId: string;
const permissions: McpPermissions = {
  scopes: { beans: 'edit', notes: 'edit' },
};
const call = async (
  name: string,
  args: Record<string, unknown>,
  grants = permissions
) => (await executeMcpTool(name, args, grants)) as Result;
const requestId = () => `note-image-integration-${++seq}`;
const createArgs = () => ({
  requestId: requestId(),
  note: {
    beanId,
    coffeeGrams: 18,
    extractionTimeSeconds: 25,
    liquidWeightGrams: 36,
    notes: 'Own measured note',
  },
  images: [PNG, OTHER],
});
const updateArgs = (note: Note) => ({
  requestId: requestId(),
  id: note.id,
  expectedVersion: note.version,
  expectedImageVersion: note.imageVersion,
});
const remaining = async () =>
  Number((await getCoffeeBean(db.driver, beanId))!.remaining);
const preview = (note: Note, imageId = note.images[0].imageId) =>
  call('preview_delete', { entity: 'brew_note_image', id: note.id, imageId });
const deleteArgs = (note: Note, token: string) => ({
  requestId: requestId(),
  id: note.id,
  imageId: note.images[0].imageId,
  expectedVersion: note.version,
  confirmationToken: token,
});
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  files = new Files();
  native.driver = db.driver;
  native.files = files;
  native.failProcessing = false;
  native.processes = 0;
  beanId = (
    await call('create_bean', {
      requestId: requestId(),
      bean: { name: 'Photo inventory fixture', capacityGrams: 100 },
    })
  ).bean.id;
});
afterEach(async () => {
  native.driver = undefined;
  native.files = undefined;
  await db.close();
});
describe('MCP note images centralized transactions (real SQLite)', () => {
  it('atomically creates note/dose/photos and replays without duplicate consumption or files', async () => {
    const args = createArgs();
    const result = await call('create_brew_note', args);
    expect(await remaining()).toBe(82);
    expect(result.note.images).toHaveLength(2);
    expect(result.note.images.every(photo => !photo.hasThumbnail)).toBe(true);
    expect(files.objects.size).toBe(2);
    expect(await call('create_brew_note', args)).toEqual({
      ...result,
      replayed: true,
    });
    expect(await remaining()).toBe(82);
    expect(files.objects.size).toBe(2);
    expect(native.processes).toBe(2);
    const saved = (await listBrewingNotes(db.driver))[0];
    expect(saved).not.toHaveProperty('images');
    expect(saved.params).toMatchObject({
      coffee: '18g',
      extractionTime: 25,
      liquidWeight: '36g',
    });
    const text = JSON.stringify([
      result,
      await call('get_brew_note', { id: result.note.id }),
      await call('list_brew_notes', {}),
      await call('list_mcp_activity', {}),
      await db.driver.query('SELECT * FROM mcp_operations'),
      await db.driver.query('SELECT * FROM mcp_activity'),
    ]);
    expect(text).not.toContain('base64');
    expect(text).not.toContain('relative_path');
    for (const key of files.objects.keys()) expect(text).not.toContain(key);
  });
  it('explicit photo content reads are note-scoped and never contaminate ordinary projections', async () => {
    const first = await call('create_brew_note', createArgs());
    const args = { id: first.note.id, imageId: first.note.images[0].imageId };
    const content = await executeMcpTool('get_brew_note_image', args, {
      scopes: { notes: 'read' },
    });
    expect(content).toMatchObject({
      image: { status: 'available', dataUrl: PNG, width: 1, height: 1 },
    });
    const reads = files.read.mock.calls.length;
    await expect(
      executeMcpTool('get_brew_note_image', args, {
        scopes: { beans: 'read' },
      })
    ).rejects.toThrow();
    expect(files.read).toHaveBeenCalledTimes(reads);
    expect(
      JSON.stringify(await call('get_brew_note', { id: first.note.id }))
    ).not.toContain('base64');
    expect(JSON.stringify(await call('list_mcp_activity', {}))).not.toContain(
      'base64'
    );
  });
  it('image-only append and targeted replacement preserve dose, measurement snapshot and untouched identities', async () => {
    const first = await call('create_brew_note', createArgs());
    const args = { ...updateArgs(first.note), appendImages: [PNG] };
    const added = await call('update_brew_note', args);
    expect(added.note.images.slice(0, 2)).toEqual(first.note.images);
    expect(await remaining()).toBe(82);
    expect(files.objects.size).toBe(3);
    expect(await call('update_brew_note', args)).toEqual({
      ...added,
      replayed: true,
    });
    const replaced = await call('update_brew_note', {
      ...updateArgs(added.note),
      replaceImage: { imageId: added.note.images[0].imageId, dataUrl: OTHER },
    });
    expect(replaced.note.images.slice(1)).toEqual(added.note.images.slice(1));
    expect(files.objects.size).toBe(3);
    expect(await remaining()).toBe(82);
    const note = (await listBrewingNotes(db.driver))[0];
    expect(note.notes).toBe('Own measured note');
    expect(note.params).toMatchObject({
      coffee: '18g',
      extractionTime: 25,
      liquidWeight: '36g',
    });
  });
  it('commits mixed dose/photo edits together and rolls both back on compression failure', async () => {
    const first = await call('create_brew_note', createArgs());
    const changed = await call('update_brew_note', {
      ...updateArgs(first.note),
      changes: { coffeeGrams: 20 },
      appendImages: [PNG],
    });
    expect(await remaining()).toBe(80);
    expect(files.objects.size).toBe(3);
    native.failProcessing = true;
    await expect(
      call('update_brew_note', {
        ...updateArgs(changed.note),
        changes: { coffeeGrams: 30 },
        replaceImage: {
          imageId: changed.note.images[0].imageId,
          dataUrl: OTHER,
        },
      })
    ).rejects.toThrow('Image decoding or compression failed');
    expect(await remaining()).toBe(80);
    expect(files.objects.size).toBe(3);
    expect((await call('get_brew_note', { id: first.note.id })).note).toEqual(
      changed.note
    );
  });
  it('edit permits targeted photo replacement and confirmed removal', async () => {
    const first = await call('create_brew_note', createArgs());
    const changed = await call(
      'update_brew_note',
      {
        ...updateArgs(first.note),
        replaceImage: { imageId: first.note.images[0].imageId, dataUrl: OTHER },
      },
      {
        scopes: { beans: 'edit', notes: 'edit' },
      }
    );
    expect(changed.note.images).toHaveLength(2);
    expect(await remaining()).toBe(82);
    const p = await preview(changed.note);
    await expect(
      call(
        'delete_brew_note_image',
        deleteArgs(changed.note, p.confirmationToken),
        {
          scopes: { beans: 'edit', notes: 'edit' },
        }
      )
    ).resolves.toMatchObject({ note: { images: [expect.any(Object)] } });
  });
  it('reorders only existing photo handles without rewriting pixels or changing dose', async () => {
    const first = await call('create_brew_note', createArgs());
    const writes = files.write.mock.calls.length;
    const ids = first.note.images.map(image => image.imageId).reverse();
    const args = { ...updateArgs(first.note), reorderImageIds: ids };
    const changed = await call('update_brew_note', args);
    expect(changed.note.images.map(image => image.imageId)).toEqual(ids);
    expect(changed.note.images.map(image => image.position)).toEqual([0, 1]);
    expect(files.write).toHaveBeenCalledTimes(writes);
    expect(await remaining()).toBe(82);
    expect(await call('update_brew_note', args)).toEqual({
      ...changed,
      replayed: true,
    });
    await expect(
      call('update_brew_note', {
        ...updateArgs(changed.note),
        reorderImageIds: [ids[0], ids[0]],
      })
    ).rejects.toThrow();
    expect((await call('get_brew_note', { id: first.note.id })).note).toEqual(
      changed.note
    );
  });
  it('rejects metadata-only concurrent changes before compression or file writes', async () => {
    const first = await call('create_brew_note', createArgs());
    const count = native.processes;
    const objects = [...files.objects.keys()];
    await db.driver.execute(
      'UPDATE brewing_note_images SET updated_at_ms=updated_at_ms+1 WHERE note_id=?',
      [first.note.id]
    );
    await expect(
      call('update_brew_note', {
        ...updateArgs(first.note),
        appendImages: [PNG],
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(native.processes).toBe(count);
    expect([...files.objects.keys()]).toEqual(objects);
    expect(await remaining()).toBe(82);
  });
  it('previewed single-photo deletion needs delete permission, preserves dose; whole-note deletion restores dose and cleans all files', async () => {
    const first = await call('create_brew_note', createArgs());
    const p = await preview(first.note);
    const args = deleteArgs(first.note, p.confirmationToken);
    await expect(
      call('delete_brew_note_image', args, {
        scopes: { beans: 'edit', notes: 'read' },
      })
    ).rejects.toThrow();
    const removed = await call('delete_brew_note_image', args);
    expect(removed.note.images).toHaveLength(1);
    expect(removed.note.images[0].imageId).toBe(first.note.images[1].imageId);
    expect(files.objects.size).toBe(1);
    expect(await remaining()).toBe(82);
    expect(await call('delete_brew_note_image', args)).toEqual({
      ...removed,
      replayed: true,
    });
    const whole = await call('preview_delete', {
      entity: 'brew_note',
      id: first.note.id,
    });
    await call('delete_brew_note', {
      requestId: requestId(),
      id: first.note.id,
      expectedVersion: removed.note.version,
      confirmationToken: whole.confirmationToken,
    });
    expect(files.objects.size).toBe(0);
    expect(await remaining()).toBe(100);
    expect(await listBrewingNotes(db.driver)).toEqual([]);
  });
  it('failed image processing rolls back dose and SQL failure after apply cleans new objects with no partial record', async () => {
    native.failProcessing = true;
    await expect(call('create_brew_note', createArgs())).rejects.toThrow(
      'Image decoding or compression failed'
    );
    native.failProcessing = false;
    expect(await remaining()).toBe(100);
    expect(await listBrewingNotes(db.driver)).toEqual([]);
    expect(files.objects.size).toBe(0);
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
    await expect(call('create_brew_note', createArgs())).rejects.toThrow(
      'Injected audit failure'
    );
    expect(await remaining()).toBe(100);
    expect(await listBrewingNotes(db.driver)).toEqual([]);
    expect(files.objects.size).toBe(0);
    expect(await db.driver.query('SELECT * FROM brewing_note_images')).toEqual(
      []
    );
  });
  it('invalidates photo deletion previews after metadata changes and refuses guessed paths', async () => {
    const first = await call('create_brew_note', createArgs());
    const p = await preview(first.note);
    await db.driver.execute(
      'UPDATE brewing_note_images SET updated_at_ms=updated_at_ms+1 WHERE note_id=?',
      [first.note.id]
    );
    await expect(
      call(
        'delete_brew_note_image',
        deleteArgs(first.note, p.confirmationToken)
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const fresh = await call('get_brew_note', { id: first.note.id });
    await expect(
      call('update_brew_note', {
        ...updateArgs(fresh.note),
        replaceImage: { imageId: '/tmp/private.png', dataUrl: PNG },
      })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(
      await listBrewingNoteImageMetadata(db.driver, first.note.id)
    ).toHaveLength(2);
    expect(await remaining()).toBe(82);
  });
});
