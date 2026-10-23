import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { encodeImageDataUrl } from '@/lib/data/images/imageBinary';
import { NOTE_IMAGE_COMPRESSION_OPTIONS } from '@/lib/images/imageProcessing';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import { listBrewingNoteImageMetadata } from '@/lib/data/sqlite/imageMetadataExecutor';
import {
  saveBrewingNote,
  getBrewingNote,
} from '@/lib/data/sqlite/repositories/brewingNote';
import {
  prepareBrewingNoteImageWrite,
  cleanupPreparedBrewingNoteImageFiles,
  type PreparedBrewingNoteImageWrite,
} from '@/lib/data/sqlite/persistence/brewingNoteImagePersistence';
import {
  getMcpNoteImageInfo,
  prepareMcpNoteImageMutation,
  type McpNoteImageOperation,
} from './noteImageTools';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const OTHER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/hS0AAAAASUVORK5CYII=';
const note = {
  id: 'photo-note',
  timestamp: 1,
  updatedAt: 1,
  rating: 0,
  taste: {},
  notes: 'Own remark',
  params: { coffee: '18g', extractionTime: 25, liquidWeight: '36g' },
} as BrewingNote;
class Files implements NativeImageFileStore {
  objects = new Map<string, Uint8Array>();
  write = vi.fn(async (key: string, bytes: Uint8Array) => {
    if (this.objects.has(key)) throw new Error('collision');
    this.objects.set(key, bytes.slice());
  });
  read = vi.fn(async (key: string) => {
    const bytes = this.objects.get(key);
    if (!bytes) throw new Error('missing');
    return bytes.slice();
  });
  delete = vi.fn(async (key: string) => {
    this.objects.delete(key);
  });
  exists = vi.fn(async (key: string) => this.objects.has(key));
  listObjectKeys = vi.fn(async () => [...this.objects.keys()]);
}
let db: NodeSqliteTestDatabase;
let files: Files;
const process = vi.fn(async (file: File) =>
  encodeImageDataUrl({
    mimeType: file.type,
    bytes: new Uint8Array(await file.arrayBuffer()),
  })
);
const deps = () => ({ fileStore: files, process });
const mutate = (operation: McpNoteImageOperation) =>
  db.driver.transaction(async tx => {
    const plan = await prepareMcpNoteImageMutation(tx, note, operation, deps());
    await plan.apply(tx);
    return plan;
  });
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  files = new Files();
  process.mockClear();
  await saveBrewingNote(db.driver, note);
});
afterEach(async () => {
  await db.close();
});
describe('MCP note photo prepared writes with real SQLite', () => {
  it('compresses all inputs using shared policy and preserves note fields without inline photos', async () => {
    await mutate({ kind: 'append', dataUrls: [PNG, OTHER] });
    expect(process).toHaveBeenCalledTimes(2);
    expect(process).toHaveBeenCalledWith(expect.any(File), {
      maxFileSizeBytes: 8 * 1024 * 1024,
      compression: NOTE_IMAGE_COMPRESSION_OPTIONS,
    });
    expect(await getBrewingNote(db.driver, note.id)).toEqual(note);
    expect(files.objects.size).toBe(2);
    const info = await getMcpNoteImageInfo(db.driver, note.id);
    expect(info.map(row => row.position)).toEqual([0, 1]);
    expect(info.every(row => !row.hasThumbnail)).toBe(true);
    expect(JSON.stringify(info)).not.toContain('base64');
    for (const key of files.objects.keys())
      expect(JSON.stringify(info)).not.toContain(key);
  });
  it('appends without re-reading existing bytes and preserves every previous photo identity', async () => {
    await mutate({ kind: 'append', dataUrls: [PNG] });
    const before = await listBrewingNoteImageMetadata(db.driver, note.id);
    files.read.mockClear();
    await mutate({ kind: 'append', dataUrls: [OTHER] });
    expect(files.read).not.toHaveBeenCalled();
    expect((await listBrewingNoteImageMetadata(db.driver, note.id))[0]).toEqual(
      before[0]
    );
  });
  it('replaces only chosen photo at same position and deletes old file only after commit', async () => {
    await mutate({ kind: 'append', dataUrls: [PNG, PNG] });
    const before = await getMcpNoteImageInfo(db.driver, note.id);
    const plan = await mutate({
      kind: 'replace',
      imageId: before[0].imageId,
      dataUrl: OTHER,
    });
    const after = await getMcpNoteImageInfo(db.driver, note.id);
    expect(after[1]).toEqual(before[1]);
    expect(after[0].imageId).not.toBe(before[0].imageId);
    expect(after[0].position).toBe(0);
    expect(files.objects.size).toBe(3);
    await cleanupPreparedBrewingNoteImageFiles(
      db.driver,
      files,
      plan.supersededPaths
    );
    expect(files.objects.size).toBe(2);
  });
  it('reuses canonical photo identity and files when replacement bytes are unchanged', async () => {
    await mutate({ kind: 'append', dataUrls: [PNG] });
    const original = (await getMcpNoteImageInfo(db.driver, note.id))[0];
    const plan = await mutate({
      kind: 'replace',
      imageId: original.imageId,
      dataUrl: PNG,
    });
    expect((await getMcpNoteImageInfo(db.driver, note.id))[0]).toEqual(
      original
    );
    expect(plan.created).toEqual([]);
    expect(plan.supersededPaths).toEqual([]);
    expect(files.write).toHaveBeenCalledTimes(1);
  });
  it('removes exactly one photo, compacts order and accepts no arbitrary path or duplicate reorder IDs', async () => {
    await mutate({ kind: 'append', dataUrls: [PNG, OTHER] });
    const before = await getMcpNoteImageInfo(db.driver, note.id);
    await expect(
      mutate({ kind: 'remove', imageId: '/tmp/private.png' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      mutate({
        kind: 'reorder',
        imageIds: [before[0].imageId, before[0].imageId],
      })
    ).rejects.toThrow();
    await mutate({
      kind: 'reorder',
      imageIds: before.map(row => row.imageId).reverse(),
    });
    const plan = await mutate({ kind: 'remove', imageId: before[1].imageId });
    expect(await getMcpNoteImageInfo(db.driver, note.id)).toEqual([
      { ...before[0], position: 0 },
    ]);
    expect(files.objects.size).toBe(2);
    await cleanupPreparedBrewingNoteImageFiles(
      db.driver,
      files,
      plan.supersededPaths
    );
    expect(files.objects.size).toBe(1);
  });
  it('preserves existing external metadata without URL fetch or disclosure', async () => {
    await db.driver.transaction(async tx => {
      const plan = await prepareBrewingNoteImageWrite(tx, files, {
        ...note,
        image: 'https://example.invalid/private?token=secret',
      });
      await plan.apply(tx);
    });
    const before = await listBrewingNoteImageMetadata(db.driver, note.id);
    await mutate({ kind: 'append', dataUrls: [PNG] });
    expect((await listBrewingNoteImageMetadata(db.driver, note.id))[0]).toEqual(
      before[0]
    );
    expect(
      JSON.stringify(await getMcpNoteImageInfo(db.driver, note.id))
    ).not.toContain('secret');
  });
  it('enforces nine-photo and aggregate size limits before processing/writing', async () => {
    await mutate({ kind: 'append', dataUrls: Array(9).fill(PNG) });
    const calls = process.mock.calls.length;
    await expect(mutate({ kind: 'append', dataUrls: [PNG] })).rejects.toThrow(
      'nine'
    );
    expect(process).toHaveBeenCalledTimes(calls);
    expect(files.objects.size).toBe(9);
    const binary = new Uint8Array(5 * 1024 * 1024);
    binary.set(new Uint8Array(Buffer.from(PNG.split(',')[1], 'base64')));
    const huge = encodeImageDataUrl({ mimeType: 'image/png', bytes: binary });
    const fresh = { ...note, id: 'fresh-size' };
    await expect(
      prepareMcpNoteImageMutation(
        db.driver,
        fresh,
        { kind: 'append', dataUrls: [huge, huge] },
        deps()
      )
    ).rejects.toThrow('Combined incoming');
    expect(process).toHaveBeenCalledTimes(calls);
  });
  it('prepares without metadata writes and rolls back replacement without deleting original files', async () => {
    await mutate({ kind: 'append', dataUrls: [PNG] });
    const before = await listBrewingNoteImageMetadata(db.driver, note.id);
    let plan: PreparedBrewingNoteImageWrite | undefined;
    await expect(
      db.driver.transaction(async tx => {
        plan = await prepareMcpNoteImageMutation(
          tx,
          note,
          { kind: 'replace', imageId: before[0].imageId, dataUrl: OTHER },
          deps()
        );
        expect(await listBrewingNoteImageMetadata(tx, note.id)).toEqual(before);
        await plan.apply(tx);
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    await cleanupPreparedBrewingNoteImageFiles(
      db.driver,
      files,
      plan!.created.map(row => row.relativePath)
    );
    expect(await listBrewingNoteImageMetadata(db.driver, note.id)).toEqual(
      before
    );
    expect(files.objects.size).toBe(1);
  });
  it('allows replacing/removing an imported legacy collection above nine photos', async () => {
    await db.driver.transaction(async tx => {
      const plan = await prepareBrewingNoteImageWrite(tx, files, {
        ...note,
        images: Array(10).fill(PNG),
      });
      await plan.apply(tx);
    });
    let info = await getMcpNoteImageInfo(db.driver, note.id);
    const replaced = await mutate({
      kind: 'replace',
      imageId: info[0].imageId,
      dataUrl: OTHER,
    });
    await cleanupPreparedBrewingNoteImageFiles(
      db.driver,
      files,
      replaced.supersededPaths
    );
    info = await getMcpNoteImageInfo(db.driver, note.id);
    expect(info).toHaveLength(10);
    await expect(mutate({ kind: 'append', dataUrls: [PNG] })).rejects.toThrow(
      'nine'
    );
    const removed = await mutate({ kind: 'remove', imageId: info[0].imageId });
    await cleanupPreparedBrewingNoteImageFiles(
      db.driver,
      files,
      removed.supersededPaths
    );
    expect(await getMcpNoteImageInfo(db.driver, note.id)).toHaveLength(9);
  });
  it('cleans partial file-write failures and creates no SQL changes', async () => {
    files.write
      .mockImplementationOnce(async (key, bytes) => {
        files.objects.set(key, bytes.slice());
      })
      .mockRejectedValueOnce(new Error('private storage path'));
    await expect(
      mutate({ kind: 'append', dataUrls: [PNG, OTHER] })
    ).rejects.toThrow('Image storage preparation failed');
    expect(files.objects.size).toBe(0);
    expect(await getMcpNoteImageInfo(db.driver, note.id)).toEqual([]);
  });
});
