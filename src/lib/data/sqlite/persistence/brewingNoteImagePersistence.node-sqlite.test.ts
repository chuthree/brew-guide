import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import {
  parseImageRelativePath,
  toImageRelativePath,
  type NativeImageFileStore,
} from '@/lib/data/images/nativeImageFileStore';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import type { BrewingNoteImageMetadata } from '../imageMetadata';
import {
  listBrewingNoteImageMetadata,
  replaceBrewingNoteImageMetadata,
} from '../imageMetadataExecutor';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from '../repositories/testing/nodeSqliteTestDriver';
import { createSqliteBrewingNoteRepository } from '../repositories/brewingNote';
import { createSqliteBrewingNotePersistence } from './brewingNoteImagePersistence';

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;
const sqliteLabel = supportsNodeSqlite()
  ? `real SQLite (node:sqlite, Node ${process.versions.node})`
  : `SKIPPED: node:sqlite unavailable on Node ${process.versions.node}`;

const FILE_A = 'data:image/png;base64,AQID';
const FILE_B = 'data:image/png;base64,BAUG';
const FILE_C = 'data:image/png;base64,BwgJ';
const FILE_A_JPEG = 'data:image/jpeg;base64,AQID';
const EXTERNAL_A = 'https://example.com/note/image.png?token=a%2Fb';
const EXTERNAL_B = 'https://example.com/note/image.png?token=a%2fb';
let imageIdSequence = 0;
let objectKeySequence = 0;

type WriteHook = (objectKey: string, bytes: Uint8Array) => Promise<void>;

class FakeNativeImageFileStore implements NativeImageFileStore {
  readonly objects = new Map<string, Uint8Array>();
  readonly writes: Array<{ objectKey: string; bytes: Uint8Array }> = [];
  readonly reads: string[] = [];
  readonly deletes: string[] = [];
  writeCount = 0;
  failWriteAt?: number;
  failDeleteAt?: number;
  writeHook?: WriteHook;

  async write(objectKey: string, bytes: Uint8Array): Promise<void> {
    this.writeCount += 1;
    await this.writeHook?.(objectKey, bytes);
    if (this.writeCount === this.failWriteAt) {
      throw new Error(`injected FileStore write failure ${this.writeCount}`);
    }
    if (this.objects.has(objectKey)) throw new Error('object key collision');
    const copy = bytes.slice();
    this.objects.set(objectKey, copy);
    this.writes.push({ objectKey, bytes: copy });
  }

  async read(objectKey: string): Promise<Uint8Array> {
    this.reads.push(objectKey);
    const value = this.objects.get(objectKey);
    if (!value) throw new Error(`missing object ${objectKey}`);
    return value.slice();
  }

  async delete(objectKey: string): Promise<void> {
    this.deletes.push(objectKey);
    if (this.deletes.length === this.failDeleteAt) {
      throw new Error(
        `injected FileStore delete failure ${this.deletes.length}`
      );
    }
    this.objects.delete(objectKey);
  }

  async exists(objectKey: string): Promise<boolean> {
    return this.objects.has(objectKey);
  }

  async listObjectKeys(): Promise<string[]> {
    return Array.from(this.objects.keys());
  }

  seed(objectKey: string, bytes: Uint8Array): void {
    this.objects.set(objectKey, bytes.slice());
  }
}

function note(
  id: string,
  timestamp = 100,
  extra: Record<string, unknown> = {}
): BrewingNote {
  return {
    id,
    timestamp,
    updatedAt: timestamp,
    rating: 4,
    taste: { sweet: 4 },
    notes: `Note ${id}`,
    ...extra,
  } as BrewingNote;
}

function createPersistence(
  driver: SqliteDriver,
  store: FakeNativeImageFileStore,
  options: Parameters<typeof createSqliteBrewingNotePersistence>[2] = {}
) {
  return createSqliteBrewingNotePersistence(driver, store, {
    imageIdFactory: () => `note-image-${++imageIdSequence}`,
    objectKeyFactory: () => `note-object-${++objectKeySequence}`,
    now: () => 900,
    ...options,
  });
}

async function metadataFor(driver: SqliteDriver, noteId: string) {
  return listBrewingNoteImageMetadata(driver, noteId);
}

function rowAt(
  rows: readonly BrewingNoteImageMetadata[],
  position: number,
  variant: 'original' | 'thumbnail' = 'original'
) {
  return rows.find(row => row.position === position && row.variant === variant);
}

async function subjectJson(
  driver: SqliteDriver,
  noteId: string
): Promise<Record<string, unknown> | undefined> {
  const rows = await driver.query(
    'SELECT record_json FROM brewing_notes WHERE id = ?',
    [noteId]
  );
  return rows.length === 0
    ? undefined
    : (JSON.parse(String(rows[0].record_json)) as Record<string, unknown>);
}

function makeDriverProxy(
  driver: SqliteDriver,
  options: {
    failExecute?: (sql: string) => boolean;
    afterCommitError?: Error;
    onAfterCommit?: () => void;
    failReferenceRead?: () => boolean;
    rollbackDiagnostic?: boolean;
  }
): SqliteDriver {
  return {
    execute: (sql, params) => driver.execute(sql, params),
    query: (sql, params) => {
      if (options.failReferenceRead?.() && sql.includes('relative_path IN')) {
        return Promise.reject(new Error('injected metadata read-back failure'));
      }
      return driver.query(sql, params);
    },
    async transaction(work) {
      try {
        const result = await driver.transaction(async tx => {
          const wrapped: SqliteExecutor = {
            query: (sql, params) => tx.query(sql, params),
            execute: (sql, params) => {
              if (options.failExecute?.(sql)) {
                return Promise.reject(
                  new Error(`injected SQL failure: ${sql}`)
                );
              }
              return tx.execute(sql, params);
            },
          };
          return work(wrapped);
        });
        options.onAfterCommit?.();
        if (options.afterCommitError) throw options.afterCommitError;
        return result;
      } catch (error) {
        if (options.rollbackDiagnostic && error instanceof Error) {
          Object.defineProperty(error, 'rollbackDiagnostic', {
            value: new Error('injected rollback diagnostic failure'),
          });
        }
        throw error;
      }
    },
    close: () => driver.close(),
  };
}

async function insertCoffeeBeanImageReference(
  driver: SqliteDriver,
  imageId: string,
  relativePath: string
): Promise<void> {
  await driver.execute(
    `INSERT INTO coffee_bean_images (
       image_id, bean_id, slot, variant, source_kind, relative_path,
       mime_type, size_bytes, sha256, external_url, updated_at_ms
     ) VALUES (?, ?, 'front', 'original', 'file', ?, 'image/png', 3, NULL, NULL, 100)`,
    [imageId, 'bean-shared-file', relativePath]
  );
}

describeNodeSqlite(
  `${sqliteLabel} Native BrewingNote aggregate persistence`,
  () => {
    let database: NodeSqliteTestDatabase;
    let store: FakeNativeImageFileStore;
    let persistence: ReturnType<typeof createPersistence>;

    beforeEach(async () => {
      imageIdSequence = 0;
      objectKeySequence = 0;
      database = await createNodeSqliteTestDatabase();
      store = new FakeNativeImageFileStore();
      persistence = createPersistence(database.driver, store);
    });

    afterEach(async () => {
      await database?.close();
    });

    it('stores ordered file and external sources outside the subject JSON', async () => {
      const input = note('multi-image', 100, {
        updatedAt: 123,
        image: EXTERNAL_B,
        images: [FILE_A, EXTERNAL_A, FILE_B],
        futureField: { nested: ['kept', null, 4] },
      });

      const returned = await persistence.saveWithImages(input);
      const rows = await metadataFor(database.driver, input.id);
      const subject = await subjectJson(database.driver, input.id);

      expect(returned).not.toHaveProperty('image');
      expect(returned).not.toHaveProperty('images');
      expect(subject).toMatchObject({
        id: input.id,
        futureField: { nested: ['kept', null, 4] },
      });
      expect(subject).not.toHaveProperty('image');
      expect(subject).not.toHaveProperty('images');
      expect(
        rows.map(row => [row.position, row.variant, row.sourceKind])
      ).toEqual([
        [0, 'original', 'file'],
        [1, 'original', 'external'],
        [2, 'original', 'file'],
      ]);
      expect(rows.every(row => row.variant === 'original')).toBe(true);
      expect(rowAt(rows, 0)).toMatchObject({
        updatedAt: 123,
        mimeType: 'image/png',
      });
      expect(rowAt(rows, 1)).toMatchObject({ externalUrl: EXTERNAL_A });
      expect(rowAt(rows, 2)).toMatchObject({ mimeType: 'image/png' });
      expect(store.writes.map(write => Array.from(write.bytes))).toEqual([
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    it('uses the non-empty images array before image and compacts falsy entries', async () => {
      await persistence.saveWithImages(
        note('precedence', 100, {
          image: EXTERNAL_B,
          images: ['', FILE_A, EXTERNAL_A],
        })
      );
      const rows = await metadataFor(database.driver, 'precedence');

      expect(rows.map(row => row.position)).toEqual([0, 1]);
      expect(rowAt(rows, 0)).toMatchObject({ sourceKind: 'file' });
      expect(rowAt(rows, 1)).toMatchObject({
        sourceKind: 'external',
        externalUrl: EXTERNAL_A,
      });
      expect(store.writes).toHaveLength(1);
    });

    it('falls back to image when images is empty', async () => {
      await persistence.saveWithImages(
        note('single-image', 100, { image: FILE_A, images: [] })
      );

      const rows = await metadataFor(database.driver, 'single-image');
      expect(rows).toHaveLength(1);
      expect(rowAt(rows, 0)).toMatchObject({ sourceKind: 'file' });
    });

    it('does not fall back when a non-empty images array filters to empty', async () => {
      await persistence.saveWithImages(
        note('filtered-empty', 100, { image: FILE_A })
      );
      const old = rowAt(
        await metadataFor(database.driver, 'filtered-empty'),
        0
      );
      if (old?.sourceKind !== 'file') throw new Error('Expected file metadata');

      await persistence.saveWithImages(
        note('filtered-empty', 200, { image: FILE_B, images: [''] })
      );

      expect(await metadataFor(database.driver, 'filtered-empty')).toEqual([]);
      expect(store.objects.has(parseImageRelativePath(old.relativePath))).toBe(
        false
      );
      expect(
        await subjectJson(database.driver, 'filtered-empty')
      ).not.toHaveProperty('image');
      expect(
        await subjectJson(database.driver, 'filtered-empty')
      ).not.toHaveProperty('images');
    });

    it('preserves image rows and thumbnails when neither image field is supplied', async () => {
      await persistence.saveWithImages(
        note('preserve', 100, { image: FILE_A })
      );
      const original = rowAt(await metadataFor(database.driver, 'preserve'), 0);
      if (original?.sourceKind !== 'file')
        throw new Error('Expected original file');
      const thumbnail: BrewingNoteImageMetadata = {
        imageId: 'old-thumbnail',
        noteId: 'preserve',
        position: 0,
        variant: 'thumbnail',
        sourceKind: 'file',
        relativePath: toImageRelativePath('old-thumbnail'),
        mimeType: 'image/webp',
        sizeBytes: 2,
        updatedAt: 99,
      };
      store.seed('old-thumbnail', new Uint8Array([9, 8]));
      await replaceBrewingNoteImageMetadata(database.driver, 'preserve', [
        original,
        thumbnail,
      ]);
      const before = await metadataFor(database.driver, 'preserve');
      const beforeWriteCount = store.writes.length;

      await persistence.saveWithImages(
        note('preserve', 200, { notes: 'text only' })
      );

      expect(await metadataFor(database.driver, 'preserve')).toEqual(before);
      expect(store.writes).toHaveLength(beforeWriteCount);
      expect(store.objects.has('old-thumbnail')).toBe(true);
      expect(await subjectJson(database.driver, 'preserve')).toMatchObject({
        notes: 'text only',
      });
    });

    it('clears originals and thumbnails when an image property is explicitly undefined', async () => {
      await persistence.saveWithImages(
        note('clear-undefined', 100, { image: FILE_A })
      );
      const original = rowAt(
        await metadataFor(database.driver, 'clear-undefined'),
        0
      );
      if (original?.sourceKind !== 'file')
        throw new Error('Expected original file');
      const thumbnail: BrewingNoteImageMetadata = {
        imageId: 'clear-thumbnail',
        noteId: 'clear-undefined',
        position: 0,
        variant: 'thumbnail',
        sourceKind: 'file',
        relativePath: toImageRelativePath('clear-thumbnail'),
        mimeType: 'image/webp',
        sizeBytes: 2,
      };
      store.seed('clear-thumbnail', new Uint8Array([7, 8]));
      await replaceBrewingNoteImageMetadata(
        database.driver,
        'clear-undefined',
        [original, thumbnail]
      );

      await persistence.saveWithImages(
        note('clear-undefined', 200, { image: undefined })
      );

      expect(await metadataFor(database.driver, 'clear-undefined')).toEqual([]);
      expect(store.objects.size).toBe(0);
    });

    it('clears originals when images is explicitly undefined', async () => {
      await persistence.saveWithImages(
        note('images-undefined', 100, { image: FILE_A })
      );

      await persistence.saveWithImages(
        note('images-undefined', 200, { images: undefined })
      );

      expect(await metadataFor(database.driver, 'images-undefined')).toEqual(
        []
      );
      expect(store.objects.size).toBe(0);
    });

    it('clears originals when image is explicitly empty', async () => {
      await persistence.saveWithImages(
        note('image-empty', 100, { image: FILE_A })
      );

      await persistence.saveWithImages(note('image-empty', 200, { image: '' }));

      expect(await metadataFor(database.driver, 'image-empty')).toEqual([]);
      expect(store.objects.size).toBe(0);
    });

    it('uses image as the single source when images is absent', async () => {
      await persistence.saveWithImages(
        note('image-only', 100, { image: FILE_A })
      );

      const rows = await metadataFor(database.driver, 'image-only');
      expect(rows).toHaveLength(1);
      expect(rowAt(rows, 0)).toMatchObject({
        position: 0,
        sourceKind: 'file',
      });
      expect(store.writes).toHaveLength(1);
    });

    it('preserves duplicate sources and compacts mixed falsy image entries', async () => {
      await persistence.saveWithImages(
        note('duplicate-values', 100, {
          images: ['', FILE_A, FILE_A, '', EXTERNAL_A],
        })
      );

      const rows = await metadataFor(database.driver, 'duplicate-values');
      expect(rows.map(row => row.position)).toEqual([0, 1, 2]);
      expect(rows.map(row => row.sourceKind)).toEqual([
        'file',
        'file',
        'external',
      ]);
      expect(rowAt(rows, 0)?.imageId).not.toBe(rowAt(rows, 1)?.imageId);
      expect(store.writes).toHaveLength(2);
    });

    it('reuses same-position file identity and path when MIME and bytes match', async () => {
      await persistence.saveWithImages(note('reuse', 100, { image: FILE_A }));
      const before = rowAt(await metadataFor(database.driver, 'reuse'), 0);
      await persistence.saveWithImages(
        note('reuse', 200, { images: [FILE_A] })
      );
      const after = rowAt(await metadataFor(database.driver, 'reuse'), 0);

      expect(store.writes).toHaveLength(1);
      expect(after).toMatchObject({
        imageId: before?.imageId,
        relativePath: before?.sourceKind === 'file' ? before.relativePath : '',
        updatedAt: 200,
      });
    });

    it('reuses file objects and identities when ordered images are reordered', async () => {
      await persistence.saveWithImages(
        note('reorder', 100, { images: [FILE_A, FILE_B, FILE_A_JPEG] })
      );
      const before = await metadataFor(database.driver, 'reorder');
      const beforeObjects = await store.listObjectKeys();

      await persistence.saveWithImages(
        note('reorder', 200, { images: [FILE_A_JPEG, FILE_A, FILE_B] })
      );

      const after = await metadataFor(database.driver, 'reorder');
      expect(after.map(row => row.position)).toEqual([0, 1, 2]);
      expect(after.map(row => row.imageId)).toEqual([
        before[2].imageId,
        before[0].imageId,
        before[1].imageId,
      ]);
      expect(
        after.map(row => row.sourceKind === 'file' && row.relativePath)
      ).toEqual(
        [before[2], before[0], before[1]].map(
          row => row.sourceKind === 'file' && row.relativePath
        )
      );
      expect(await store.listObjectKeys()).toEqual(beforeObjects);
      expect(store.writes).toHaveLength(3);
      expect(after.every(row => row.updatedAt === 200)).toBe(true);
    });

    it('matches duplicate file sources one-to-one in deterministic prior order', async () => {
      await persistence.saveWithImages(
        note('duplicate-reorder', 100, { images: [FILE_A, FILE_A, FILE_B] })
      );
      const before = await metadataFor(database.driver, 'duplicate-reorder');

      await persistence.saveWithImages(
        note('duplicate-reorder', 200, { images: [FILE_A, FILE_B, FILE_A] })
      );

      const after = await metadataFor(database.driver, 'duplicate-reorder');
      expect(after.map(row => row.imageId)).toEqual([
        before[0].imageId,
        before[2].imageId,
        before[1].imageId,
      ]);
      expect(new Set(after.map(row => row.imageId)).size).toBe(3);
      expect(store.writes).toHaveLength(3);
    });

    it('reorders mixed file and external sources without rewriting file objects', async () => {
      await persistence.saveWithImages(
        note('mixed-reorder', 100, {
          images: [FILE_A, EXTERNAL_A, FILE_B],
        })
      );
      const before = await metadataFor(database.driver, 'mixed-reorder');
      const beforeObjects = await store.listObjectKeys();

      await persistence.saveWithImages(
        note('mixed-reorder', 200, {
          images: [EXTERNAL_A, FILE_B, FILE_A],
        })
      );

      const after = await metadataFor(database.driver, 'mixed-reorder');
      expect(after.map(row => row.imageId)).toEqual([
        before[1].imageId,
        before[2].imageId,
        before[0].imageId,
      ]);
      expect(rowAt(after, 0)).toMatchObject({
        sourceKind: 'external',
        externalUrl: EXTERNAL_A,
      });
      expect(await store.listObjectKeys()).toEqual(beforeObjects);
      expect(store.writes).toHaveLength(2);
    });

    it('rejects a missing old file instead of silently replacing its object', async () => {
      await persistence.saveWithImages(
        note('missing-old-object', 100, { image: FILE_A })
      );
      const before = await metadataFor(database.driver, 'missing-old-object');
      const old = rowAt(before, 0);
      if (old?.sourceKind !== 'file') throw new Error('Expected file metadata');
      store.objects.delete(parseImageRelativePath(old.relativePath));

      await expect(
        persistence.saveWithImages(
          note('missing-old-object', 200, { image: FILE_A })
        )
      ).rejects.toThrow('missing object');

      expect(await metadataFor(database.driver, 'missing-old-object')).toEqual(
        before
      );
      expect(store.writes).toHaveLength(1);
    });

    it('treats MIME changes as new file sources and removes superseded files', async () => {
      await persistence.saveWithImages(note('mime', 100, { image: FILE_A }));
      const old = rowAt(await metadataFor(database.driver, 'mime'), 0);
      if (old?.sourceKind !== 'file') throw new Error('Expected original file');

      await persistence.saveWithImages(
        note('mime', 200, { image: FILE_A_JPEG })
      );

      const next = rowAt(await metadataFor(database.driver, 'mime'), 0);
      expect(next).toMatchObject({
        sourceKind: 'file',
        mimeType: 'image/jpeg',
      });
      expect(next?.imageId).not.toBe(old.imageId);
      expect(store.objects.has(parseImageRelativePath(old.relativePath))).toBe(
        false
      );
      expect(store.objects.size).toBe(1);
    });

    it('treats changed bytes with the same MIME and size as a new source', async () => {
      await persistence.saveWithImages(
        note('changed-bytes', 100, { image: FILE_A })
      );
      const old = rowAt(await metadataFor(database.driver, 'changed-bytes'), 0);
      if (old?.sourceKind !== 'file') throw new Error('Expected file metadata');

      await persistence.saveWithImages(
        note('changed-bytes', 200, {
          image: 'data:image/png;base64,AAEC',
        })
      );

      const next = rowAt(
        await metadataFor(database.driver, 'changed-bytes'),
        0
      );
      expect(next?.imageId).not.toBe(old.imageId);
      expect(next).toMatchObject({
        sourceKind: 'file',
        mimeType: 'image/png',
        sizeBytes: old.sizeBytes,
      });
      expect(store.objects.has(parseImageRelativePath(old.relativePath))).toBe(
        false
      );
      expect(store.objects.size).toBe(1);
    });

    it('clears existing thumbnail metadata on explicit image replacement', async () => {
      await persistence.saveWithImages(
        note('thumbnail-clear', 100, { image: FILE_A })
      );
      const original = rowAt(
        await metadataFor(database.driver, 'thumbnail-clear'),
        0
      );
      if (original?.sourceKind !== 'file')
        throw new Error('Expected original file metadata');
      store.seed('note-old-thumbnail', new Uint8Array([8, 9]));
      await replaceBrewingNoteImageMetadata(
        database.driver,
        'thumbnail-clear',
        [
          original,
          {
            imageId: 'note-old-thumbnail-metadata',
            noteId: 'thumbnail-clear',
            position: 0,
            variant: 'thumbnail',
            sourceKind: 'file',
            relativePath: toImageRelativePath('note-old-thumbnail'),
            mimeType: 'image/webp',
            sizeBytes: 2,
          },
        ]
      );

      await persistence.saveWithImages(
        note('thumbnail-clear', 200, { images: [FILE_B] })
      );

      const rows = await metadataFor(database.driver, 'thumbnail-clear');
      expect(rows.map(row => row.variant)).toEqual(['original']);
      expect(store.objects.has('note-old-thumbnail')).toBe(false);
      expect(store.objects.size).toBe(1);
    });

    it('preserves exact external URL strings and supports source transitions', async () => {
      await persistence.saveWithImages(
        note('external', 100, { image: EXTERNAL_A })
      );
      const first = rowAt(await metadataFor(database.driver, 'external'), 0);
      await persistence.saveWithImages(
        note('external', 200, { image: EXTERNAL_A })
      );
      const same = rowAt(await metadataFor(database.driver, 'external'), 0);
      expect(same?.imageId).toBe(first?.imageId);
      expect(same).toMatchObject({ externalUrl: EXTERNAL_A, updatedAt: 200 });
      expect(store.writes).toHaveLength(0);

      await persistence.saveWithImages(
        note('external', 300, { image: FILE_A })
      );
      expect(
        rowAt(await metadataFor(database.driver, 'external'), 0)
      ).toMatchObject({
        sourceKind: 'file',
      });
      await persistence.saveWithImages(
        note('external', 400, { image: EXTERNAL_B })
      );
      expect(
        rowAt(await metadataFor(database.driver, 'external'), 0)
      ).toMatchObject({
        sourceKind: 'external',
        externalUrl: EXTERNAL_B,
      });
      expect(store.objects.size).toBe(0);
    });

    it('rejects unsupported image input before writing the note or files', async () => {
      await expect(
        persistence.saveWithImages(
          note('invalid', 100, {
            images: [FILE_A, 'file:///private/image.png'],
          })
        )
      ).rejects.toThrow();

      expect(store.writes).toEqual([]);
      expect(await subjectJson(database.driver, 'invalid')).toBeUndefined();
      expect(await metadataFor(database.driver, 'invalid')).toEqual([]);
    });

    it('rejects malformed inline image fields instead of silently stripping them', async () => {
      await expect(
        persistence.saveWithImages(
          note('malformed-images', 100, { images: 'not-an-array' })
        )
      ).rejects.toThrow();

      expect(store.writes).toEqual([]);
      expect(
        await subjectJson(database.driver, 'malformed-images')
      ).toBeUndefined();
    });

    it('compensates earlier file writes when a later file write fails', async () => {
      store.failWriteAt = 2;

      await expect(
        persistence.saveWithImages(
          note('write-failure', 100, { images: [FILE_A, FILE_B] })
        )
      ).rejects.toThrow('injected FileStore write failure 2');

      expect(store.objects.size).toBe(0);
      expect(await metadataFor(database.driver, 'write-failure')).toEqual([]);
      expect(
        await subjectJson(database.driver, 'write-failure')
      ).toBeUndefined();
    });

    it('rolls back subject and metadata writes together and removes new files', async () => {
      const failing = createPersistence(
        makeDriverProxy(database.driver, {
          failExecute: sql => sql.startsWith('INSERT INTO brewing_notes'),
        }),
        store
      );

      await expect(
        failing.saveWithImages(
          note('rollback', 100, { images: [FILE_A, FILE_B] })
        )
      ).rejects.toThrow('injected SQL failure');

      expect(await subjectJson(database.driver, 'rollback')).toBeUndefined();
      expect(await metadataFor(database.driver, 'rollback')).toEqual([]);
      expect(store.objects.size).toBe(0);
    });

    it('retains the old file and metadata when a replacement transaction rolls back', async () => {
      await persistence.saveWithImages(
        note('replace-rollback', 100, { image: FILE_A })
      );
      const oldRows = await metadataFor(database.driver, 'replace-rollback');
      const oldSubject = await subjectJson(database.driver, 'replace-rollback');
      const oldKeys = await store.listObjectKeys();
      const failing = createPersistence(
        makeDriverProxy(database.driver, {
          failExecute: sql => sql.startsWith('INSERT INTO brewing_notes'),
        }),
        store
      );

      await expect(
        failing.saveWithImages(note('replace-rollback', 200, { image: FILE_B }))
      ).rejects.toThrow('injected SQL failure');

      expect(await metadataFor(database.driver, 'replace-rollback')).toEqual(
        oldRows
      );
      expect(await subjectJson(database.driver, 'replace-rollback')).toEqual(
        oldSubject
      );
      expect(await store.listObjectKeys()).toEqual(oldKeys);
    });

    it('retains new files when rollback outcome has a diagnostic failure', async () => {
      const failing = createPersistence(
        makeDriverProxy(database.driver, {
          failExecute: sql => sql.startsWith('INSERT INTO brewing_notes'),
          rollbackDiagnostic: true,
        }),
        store
      );

      await expect(
        failing.saveWithImages(
          note('uncertain-rollback', 100, { image: FILE_A })
        )
      ).rejects.toThrow('injected SQL failure');

      expect(await metadataFor(database.driver, 'uncertain-rollback')).toEqual(
        []
      );
      expect(store.objects.size).toBe(1);
    });

    it('retains committed files after an uncertain post-commit result', async () => {
      const failure = new Error('synthetic error after commit');
      const uncertain = createPersistence(
        makeDriverProxy(database.driver, { afterCommitError: failure }),
        store
      );

      await expect(
        uncertain.saveWithImages(note('uncertain', 100, { image: FILE_A }))
      ).rejects.toBe(failure);

      const rows = await metadataFor(database.driver, 'uncertain');
      expect(rows).toHaveLength(1);
      const original = rowAt(rows, 0);
      if (original?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      expect(
        store.objects.has(parseImageRelativePath(original.relativePath))
      ).toBe(true);
    });

    it('retains files if reference read-back fails after an uncertain commit', async () => {
      let committed = false;
      const uncertain = createPersistence(
        makeDriverProxy(database.driver, {
          afterCommitError: new Error('after commit'),
          onAfterCommit: () => {
            committed = true;
          },
          failReferenceRead: () => committed,
        }),
        store
      );

      await expect(
        uncertain.saveWithImages(note('uncertain-read', 100, { image: FILE_A }))
      ).rejects.toThrow('after commit');

      expect(store.objects.size).toBe(1);
      expect(await metadataFor(database.driver, 'uncertain-read')).toHaveLength(
        1
      );
    });

    it('keeps files referenced by another image table when deleting a note', async () => {
      await persistence.saveWithImages(
        note('shared-reference', 100, { image: FILE_A })
      );
      const original = rowAt(
        await metadataFor(database.driver, 'shared-reference'),
        0
      );
      if (original?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      const objectKey = parseImageRelativePath(original.relativePath);
      await insertCoffeeBeanImageReference(
        database.driver,
        'bean-reference',
        original.relativePath
      );

      await persistence.deleteWithImages('shared-reference');

      expect(await metadataFor(database.driver, 'shared-reference')).toEqual(
        []
      );
      expect(store.objects.has(objectKey)).toBe(true);
    });

    it('keeps a file object referenced by another BrewingNote owner', async () => {
      await persistence.saveWithImages(
        note('shared-note-a', 100, { image: FILE_A })
      );
      const original = rowAt(
        await metadataFor(database.driver, 'shared-note-a'),
        0
      );
      if (original?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      const objectKey = parseImageRelativePath(original.relativePath);
      await replaceBrewingNoteImageMetadata(database.driver, 'shared-note-b', [
        {
          ...original,
          imageId: 'shared-note-b-image',
          noteId: 'shared-note-b',
        },
      ]);

      await persistence.saveWithImages(
        note('shared-note-a', 200, { image: EXTERNAL_A })
      );

      expect(await metadataFor(database.driver, 'shared-note-b')).toHaveLength(
        1
      );
      expect(store.objects.has(objectKey)).toBe(true);
    });

    it('deletes stale file originals and thumbnails after deleteMany', async () => {
      await persistence.saveWithImages(
        note('delete-a', 100, { image: FILE_A })
      );
      await persistence.saveWithImages(
        note('delete-b', 100, { image: FILE_B })
      );
      const rowsA = await metadataFor(database.driver, 'delete-a');
      const original = rowAt(rowsA, 0);
      if (original?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      store.seed('delete-thumb', new Uint8Array([1]));
      await replaceBrewingNoteImageMetadata(database.driver, 'delete-a', [
        original,
        {
          imageId: 'delete-thumbnail',
          noteId: 'delete-a',
          position: 0,
          variant: 'thumbnail',
          sourceKind: 'file',
          relativePath: toImageRelativePath('delete-thumb'),
          mimeType: 'image/webp',
          sizeBytes: 1,
        },
      ]);
      const before = await metadataFor(database.driver, 'delete-b');

      await persistence.deleteManyWithImages(['delete-a', 'delete-a']);

      expect(await metadataFor(database.driver, 'delete-a')).toEqual([]);
      expect(await metadataFor(database.driver, 'delete-b')).toEqual(before);
      expect(
        store.objects.has(parseImageRelativePath(original.relativePath))
      ).toBe(false);
      expect(store.objects.has('delete-thumb')).toBe(false);
      expect(
        await createSqliteBrewingNoteRepository(database.driver).get('delete-a')
      ).toBeUndefined();
    });

    it('returns immediately for empty deleteMany without querying or transacting', async () => {
      const transaction = vi.spyOn(database.driver, 'transaction');
      const query = vi.spyOn(database.driver, 'query');

      await persistence.deleteManyWithImages([]);

      expect(transaction).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
      expect(store.writes).toEqual([]);
      expect(store.deletes).toEqual([]);
    });

    it('deletes duplicate and missing IDs with file and external metadata in one call', async () => {
      await persistence.saveWithImages(
        note('delete-mixed', 100, { images: [FILE_A, EXTERNAL_A] })
      );
      const original = rowAt(
        await metadataFor(database.driver, 'delete-mixed'),
        0
      );
      if (original?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      const objectKey = parseImageRelativePath(original.relativePath);
      const transaction = vi.spyOn(database.driver, 'transaction');

      await persistence.deleteManyWithImages([
        'delete-mixed',
        'missing-note',
        'delete-mixed',
      ]);

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(await metadataFor(database.driver, 'delete-mixed')).toEqual([]);
      expect(
        await createSqliteBrewingNoteRepository(database.driver).get(
          'delete-mixed'
        )
      ).toBeUndefined();
      expect(store.objects.has(objectKey)).toBe(false);
    });

    it('rolls back deleteMany subjects and image metadata together', async () => {
      await persistence.saveWithImages(
        note('delete-rollback', 100, { image: FILE_A })
      );
      const beforeMetadata = await metadataFor(
        database.driver,
        'delete-rollback'
      );
      const original = rowAt(beforeMetadata, 0);
      if (original?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      const objectKey = parseImageRelativePath(original.relativePath);
      const failing = createPersistence(
        makeDriverProxy(database.driver, {
          failExecute: sql => sql.startsWith('DELETE FROM brewing_note_images'),
        }),
        store
      );

      await expect(
        failing.deleteManyWithImages(['delete-rollback', 'missing-note'])
      ).rejects.toThrow('injected SQL failure');

      expect(await metadataFor(database.driver, 'delete-rollback')).toEqual(
        beforeMetadata
      );
      expect(
        await createSqliteBrewingNoteRepository(database.driver).get(
          'delete-rollback'
        )
      ).toBeDefined();
      expect(store.objects.has(objectKey)).toBe(true);
    });

    it('replaceAll preserves omitted-image owners and removes stale owners', async () => {
      await persistence.saveWithImages(
        note('keep-image', 100, { images: [FILE_A, FILE_B] })
      );
      await persistence.saveWithImages(
        note('remove-stale', 100, { image: FILE_A })
      );
      const keptBefore = await metadataFor(database.driver, 'keep-image');

      const changed = await persistence.replaceAllWithImages(
        [note('keep-image', 200, { notes: 'restored without image fields' })],
        { allowDestructiveReplace: true }
      );

      expect(changed).toBe(true);
      expect(await metadataFor(database.driver, 'keep-image')).toEqual(
        keptBefore
      );
      expect(await metadataFor(database.driver, 'remove-stale')).toEqual([]);
      expect(
        await createSqliteBrewingNoteRepository(database.driver).get(
          'remove-stale'
        )
      ).toBeUndefined();
      expect(store.objects.size).toBe(2);
    });

    it('replaceAll applies image precedence, explicit clears, and omission preservation', async () => {
      const ids = [
        'replace-fallback',
        'replace-falsy-array',
        'replace-images-undefined',
        'replace-image-undefined',
        'replace-non-empty',
        'replace-omitted',
      ];
      for (const id of ids) {
        await persistence.saveWithImages(note(id, 100, { image: FILE_A }));
      }
      const omittedBefore = await metadataFor(
        database.driver,
        'replace-omitted'
      );

      await persistence.replaceAllWithImages(
        [
          note('replace-fallback', 200, { image: FILE_B, images: [] }),
          note('replace-falsy-array', 200, {
            image: FILE_B,
            images: [''],
          }),
          note('replace-images-undefined', 200, { images: undefined }),
          note('replace-image-undefined', 200, { image: undefined }),
          note('replace-non-empty', 200, {
            image: EXTERNAL_A,
            images: [FILE_C, FILE_B],
          }),
          note('replace-omitted', 200, { notes: 'text-only replacement' }),
        ],
        { allowDestructiveReplace: true }
      );

      const fallback = (
        await metadataFor(database.driver, 'replace-fallback')
      ).filter(row => row.variant === 'original');
      expect(fallback).toHaveLength(1);
      expect(
        await store.read(
          parseImageRelativePath(
            (
              fallback[0] as Extract<
                BrewingNoteImageMetadata,
                { sourceKind: 'file' }
              >
            ).relativePath
          )
        )
      ).toEqual(new Uint8Array([4, 5, 6]));
      for (const id of [
        'replace-falsy-array',
        'replace-images-undefined',
        'replace-image-undefined',
      ]) {
        expect(await metadataFor(database.driver, id)).toEqual([]);
      }
      const nonEmpty = (
        await metadataFor(database.driver, 'replace-non-empty')
      ).filter(row => row.variant === 'original');
      expect(nonEmpty.map(row => row.position)).toEqual([0, 1]);
      expect(nonEmpty.map(row => row.sourceKind)).toEqual(['file', 'file']);
      expect(await metadataFor(database.driver, 'replace-omitted')).toEqual(
        omittedBefore
      );
    });

    it('replaceAll removes thumbnails and lets the last valid duplicate image record win', async () => {
      await persistence.saveWithImages(
        note('duplicate', 100, { image: FILE_A })
      );
      const original = rowAt(
        await metadataFor(database.driver, 'duplicate'),
        0
      );
      if (original?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      store.seed('duplicate-thumb', new Uint8Array([2]));
      await replaceBrewingNoteImageMetadata(database.driver, 'duplicate', [
        original,
        {
          imageId: 'duplicate-thumbnail',
          noteId: 'duplicate',
          position: 0,
          variant: 'thumbnail',
          sourceKind: 'file',
          relativePath: toImageRelativePath('duplicate-thumb'),
          mimeType: 'image/webp',
          sizeBytes: 1,
        },
      ]);

      await persistence.replaceAllWithImages(
        [
          note('duplicate', 200, { images: [FILE_B] }),
          note('duplicate', 300, { images: [] }),
        ],
        { allowDestructiveReplace: true }
      );

      expect(
        await createSqliteBrewingNoteRepository(database.driver).get(
          'duplicate'
        )
      ).toMatchObject({ timestamp: 300 });
      expect(await metadataFor(database.driver, 'duplicate')).toMatchObject([
        { position: 0, sourceKind: 'file', sizeBytes: 3 },
      ]);
      expect(store.objects.has('duplicate-thumb')).toBe(false);
    });

    it('preplans only the last valid duplicate Note ID image list', async () => {
      await persistence.replaceAllWithImages(
        [
          note('duplicate-effective', 100, { image: FILE_A }),
          note('duplicate-effective', 200, { image: FILE_B }),
        ],
        { allowDestructiveReplace: true }
      );

      const subject = await createSqliteBrewingNoteRepository(
        database.driver
      ).get('duplicate-effective');
      const rows = await metadataFor(database.driver, 'duplicate-effective');
      expect(subject).toMatchObject({ timestamp: 200 });
      expect(rows).toHaveLength(1);
      expect(store.writes).toHaveLength(1);
      expect(
        Array.from(
          await store.read(
            parseImageRelativePath(
              (
                rows[0] as Extract<
                  BrewingNoteImageMetadata,
                  { sourceKind: 'file' }
                >
              ).relativePath
            )
          )
        )
      ).toEqual([4, 5, 6]);
    });

    it('keeps a successful database replacement when old file cleanup fails', async () => {
      const cleanupErrors: string[] = [];
      await persistence.saveWithImages(
        note('cleanup-failure', 100, { image: FILE_A })
      );
      const old = rowAt(
        await metadataFor(database.driver, 'cleanup-failure'),
        0
      );
      if (old?.sourceKind !== 'file') throw new Error('Expected file metadata');
      const objectKey = parseImageRelativePath(old.relativePath);
      store.failDeleteAt = 1;
      persistence = createPersistence(database.driver, store, {
        onCleanupError: message => cleanupErrors.push(message),
      });

      await expect(
        persistence.saveWithImages(
          note('cleanup-failure', 200, { image: EXTERNAL_A })
        )
      ).resolves.toBeDefined();

      expect(
        rowAt(await metadataFor(database.driver, 'cleanup-failure'), 0)
      ).toMatchObject({
        sourceKind: 'external',
        externalUrl: EXTERNAL_A,
      });
      expect(store.objects.has(objectKey)).toBe(true);
      expect(cleanupErrors).toEqual([
        'Failed to remove a superseded image object',
      ]);
      expect(cleanupErrors.join(' ')).not.toContain(EXTERNAL_A);
      expect(cleanupErrors.join(' ')).not.toContain(FILE_A);
    });

    it('protects existing records when destructive replace is skipped', async () => {
      await persistence.saveWithImages(
        note('safe-replace', 100, { image: FILE_A })
      );
      const beforeNotes = await createSqliteBrewingNoteRepository(
        database.driver
      ).list();
      const beforeMetadata = await metadataFor(database.driver, 'safe-replace');

      await expect(
        persistence.replaceAllWithImages([], { allowEmptyReplace: false })
      ).resolves.toBe(false);

      expect(
        await createSqliteBrewingNoteRepository(database.driver).list()
      ).toEqual(beforeNotes);
      expect(await metadataFor(database.driver, 'safe-replace')).toEqual(
        beforeMetadata
      );
      expect(store.objects.size).toBe(1);
    });

    it('clears subjects and note image metadata atomically, preserving shared Bean files', async () => {
      await persistence.saveWithImages(
        note('clear-note', 100, { image: FILE_A })
      );
      const original = rowAt(
        await metadataFor(database.driver, 'clear-note'),
        0
      );
      if (original?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      const objectKey = parseImageRelativePath(original.relativePath);
      await insertCoffeeBeanImageReference(
        database.driver,
        'bean-clear-reference',
        original.relativePath
      );
      const failing = createPersistence(
        makeDriverProxy(database.driver, {
          failExecute: sql => sql === 'DELETE FROM brewing_note_images',
        }),
        store
      );

      await expect(failing.clearWithImages()).rejects.toThrow(
        'injected SQL failure'
      );
      expect(
        await createSqliteBrewingNoteRepository(database.driver).get(
          'clear-note'
        )
      ).toBeDefined();
      expect(await metadataFor(database.driver, 'clear-note')).toHaveLength(1);
      expect(store.objects.has(objectKey)).toBe(true);

      await persistence.clearWithImages();
      expect(
        await createSqliteBrewingNoteRepository(database.driver).list()
      ).toEqual([]);
      expect(await metadataFor(database.driver, 'clear-note')).toEqual([]);
      expect(store.objects.has(objectKey)).toBe(true);
      expect(
        await database.driver.query(
          'SELECT image_id FROM coffee_bean_images WHERE image_id = ?',
          ['bean-clear-reference']
        )
      ).toHaveLength(1);
    });

    it('serializes concurrent writes for one note', async () => {
      let releaseWrite!: () => void;
      let firstWriteStarted!: () => void;
      const gate = new Promise<void>(resolve => {
        releaseWrite = resolve;
      });
      const started = new Promise<void>(resolve => {
        firstWriteStarted = resolve;
      });
      let writes = 0;
      store.writeHook = async () => {
        writes += 1;
        if (writes === 1) {
          firstWriteStarted();
          await gate;
        }
      };
      const secondInstance = createPersistence(database.driver, store);
      const first = persistence.saveWithImages(
        note('same-note-race', 100, { image: FILE_A })
      );
      await started;
      const second = secondInstance.saveWithImages(
        note('same-note-race', 200, { images: [FILE_B] })
      );
      await Promise.resolve();
      expect(writes).toBe(1);
      releaseWrite();
      await Promise.all([first, second]);
      const final = rowAt(
        await metadataFor(database.driver, 'same-note-race'),
        0
      );
      if (final?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      expect(final.updatedAt).toBe(200);
      expect(
        Array.from(await store.read(parseImageRelativePath(final.relativePath)))
      ).toEqual([4, 5, 6]);
    });

    it('allows prewrites for different notes to overlap', async () => {
      let releaseWrites!: () => void;
      let bothStarted!: () => void;
      const gate = new Promise<void>(resolve => {
        releaseWrites = resolve;
      });
      const started = new Promise<void>(resolve => {
        bothStarted = resolve;
      });
      let entered = 0;
      store.writeHook = async () => {
        entered += 1;
        if (entered === 2) bothStarted();
        await gate;
      };

      const first = persistence.saveWithImages(
        note('different-note-a', 100, { image: FILE_A })
      );
      const second = persistence.saveWithImages(
        note('different-note-b', 100, { image: FILE_B })
      );
      await started;
      expect(entered).toBe(2);
      releaseWrites();
      await Promise.all([first, second]);
    });

    it('holds the exclusive dataset lock across replaceAll prewrites and commit', async () => {
      let releaseWrite!: () => void;
      let writeStarted!: () => void;
      const gate = new Promise<void>(resolve => {
        releaseWrite = resolve;
      });
      const started = new Promise<void>(resolve => {
        writeStarted = resolve;
      });
      store.writeHook = async () => {
        writeStarted();
        await gate;
      };
      const replacing = persistence.replaceAllWithImages(
        [note('exclusive-replace', 100, { image: FILE_A })],
        { allowDestructiveReplace: true }
      );
      await started;
      let saveFinished = false;
      const saving = persistence
        .saveWithImages(note('blocked-save', 200))
        .then(() => {
          saveFinished = true;
        });
      await Promise.resolve();
      expect(saveFinished).toBe(false);
      releaseWrite();
      await Promise.all([replacing, saving]);
      expect(saveFinished).toBe(true);
      expect(
        await createSqliteBrewingNoteRepository(database.driver).get(
          'blocked-save'
        )
      ).toBeDefined();
    });
  }
);
