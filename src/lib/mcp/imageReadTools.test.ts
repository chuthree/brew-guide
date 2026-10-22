import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import { prepareCoffeeBeanImageWrite } from '@/lib/data/sqlite/persistence/coffeeBeanImagePersistence';
import { prepareBrewingNoteImageWrite } from '@/lib/data/sqlite/persistence/brewingNoteImagePersistence';
import { readImageTool } from './imageReadTools';
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
const bean = { id: 'read-bean', name: 'Synthetic', timestamp: 1 } as CoffeeBean;
const note = {
  id: 'read-note',
  timestamp: 1,
  notes: 'Synthetic',
  rating: 0,
  taste: {},
} as BrewingNote;
class Files implements NativeImageFileStore {
  objects = new Map<string, Uint8Array>();
  write = vi.fn(async (key: string, bytes: Uint8Array) => {
    this.objects.set(key, bytes.slice());
  });
  read = vi.fn(async (key: string) => {
    const bytes = this.objects.get(key);
    if (!bytes) throw new Error('/private/path/not-exposed');
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
let beanImageId: string;
let noteImageId: string;
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  files = new Files();
  await db.driver.transaction(async tx => {
    const b = await prepareCoffeeBeanImageWrite(
      tx,
      files,
      { ...bean, image: PNG },
      { generateThumbnails: false }
    );
    await b.apply(tx);
    beanImageId = b.metadata[0].imageId;
    const n = await prepareBrewingNoteImageWrite(tx, files, {
      ...note,
      images: [PNG],
    });
    await n.apply(tx);
    noteImageId = n.metadata[0].imageId;
  });
});
afterEach(async () => {
  await db.close();
});
describe('explicit bounded original image content reads', () => {
  it('returns exact pixels, MIME and dimensions only through explicit owner-bound read', async () => {
    for (const [name, id, imageId] of [
      ['get_bean_image', bean.id, beanImageId],
      ['get_brew_note_image', note.id, noteImageId],
    ]) {
      const result = await readImageTool(
        db.driver,
        name,
        { id, imageId },
        files
      );
      expect(result.image).toMatchObject({
        status: 'available',
        mimeType: 'image/png',
        dataUrl: PNG,
        width: 1,
        height: 1,
      });
      expect(JSON.stringify(result)).not.toContain('relativePath');
      for (const key of files.objects.keys())
        expect(JSON.stringify(result)).not.toContain(key);
    }
  });
  it('rejects cross-owner IDs, paths, unknown fields and missing owners before file access', async () => {
    for (const [name, args] of [
      ['get_bean_image', { id: bean.id, imageId: noteImageId }],
      ['get_brew_note_image', { id: note.id, imageId: '/tmp/photo' }],
      [
        'get_bean_image',
        { id: bean.id, imageId: beanImageId, path: '/private' },
      ],
      ['get_bean_image', { id: 'missing', imageId: beanImageId }],
    ] as const)
      await expect(
        readImageTool(db.driver, name, args, files)
      ).rejects.toThrow();
    expect(files.read).not.toHaveBeenCalled();
  });
  it('does not fetch or disclose external URLs', async () => {
    let externalId = '';
    await db.driver.transaction(async tx => {
      const p = await prepareBrewingNoteImageWrite(tx, files, {
        ...note,
        image: 'https://example.invalid/private?token=secret',
      });
      await p.apply(tx);
      externalId = p.metadata[0].imageId;
    });
    const result = await readImageTool(
      db.driver,
      'get_brew_note_image',
      { id: note.id, imageId: externalId },
      files
    );
    expect(result.image.status).toBe('external-unavailable');
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(files.read).not.toHaveBeenCalled();
  });
  it('rejects oversize metadata before file access and returns other formats as opaque resources', async () => {
    await db.driver.execute(
      'UPDATE coffee_bean_images SET size_bytes=? WHERE image_id=?',
      [8 * 1024 * 1024 + 1, beanImageId]
    );
    expect(
      (
        await readImageTool(
          db.driver,
          'get_bean_image',
          { id: bean.id, imageId: beanImageId },
          files
        )
      ).image.status
    ).toBe('size-limit');
    await db.driver.execute(
      "UPDATE brewing_note_images SET mime_type='image/svg+xml' WHERE image_id=?",
      [noteImageId]
    );
    expect(
      (
        await readImageTool(
          db.driver,
          'get_brew_note_image',
          { id: note.id, imageId: noteImageId },
          files
        )
      ).image.status
    ).toBe('opaque');
    expect(files.read).toHaveBeenCalledTimes(1);
  });
  it.each(['image/gif', 'image/heif'])(
    'returns bounded %s bytes opaquely, never as renderable pixels',
    async mimeType => {
      const encoded = 'AAECAwQFBgc=';
      let id = '';
      await db.driver.transaction(async tx => {
        const plan = await prepareBrewingNoteImageWrite(tx, files, {
          ...note,
          image: `data:${mimeType};base64,${encoded}`,
        });
        await plan.apply(tx);
        id = plan.metadata[0].imageId;
      });
      const result = await readImageTool(
        db.driver,
        'get_brew_note_image',
        { id: note.id, imageId: id },
        files
      );
      expect(result.image).toMatchObject({
        status: 'opaque',
        mimeType: 'application/octet-stream',
        originalMimeType: mimeType,
        blob: encoded,
        sizeBytes: 8,
      });
      expect(result.image).not.toHaveProperty('dataUrl');
      await db.driver.execute(
        'UPDATE brewing_note_images SET size_bytes=? WHERE image_id=?',
        [8 * 1024 * 1024 + 1, id]
      );
      expect(
        (
          await readImageTool(
            db.driver,
            'get_brew_note_image',
            { id: note.id, imageId: id },
            files
          )
        ).image.status
      ).toBe('size-limit');
    }
  );
  it('sanitizes missing/corrupt source and size mismatch errors', async () => {
    files.read.mockRejectedValueOnce(new Error('/private/secret/path'));
    await expect(
      readImageTool(
        db.driver,
        'get_bean_image',
        { id: bean.id, imageId: beanImageId },
        files
      )
    ).rejects.toMatchObject({ code: 'IMAGE_UNAVAILABLE' });
    await db.driver.execute(
      'UPDATE brewing_note_images SET size_bytes=size_bytes+1 WHERE image_id=?',
      [noteImageId]
    );
    await expect(
      readImageTool(
        db.driver,
        'get_brew_note_image',
        { id: note.id, imageId: noteImageId },
        files
      )
    ).rejects.toThrow('could not be read safely');
  });
});
