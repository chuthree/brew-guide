import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import {
  parseImageRelativePath,
  type NativeImageFileStore,
} from '@/lib/data/images/nativeImageFileStore';
import {
  listCoffeeBeanImageMetadata,
  replaceCoffeeBeanImageMetadata,
} from '../imageMetadataExecutor';
import type { SqliteDriver, SqliteExecutor } from '../driver';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from '../repositories/testing/nodeSqliteTestDriver';
import { createSqliteCoffeeBeanPersistence } from './coffeeBeanImagePersistence';

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;
const sqliteLabel = supportsNodeSqlite()
  ? `real SQLite (node:sqlite, Node ${process.versions.node})`
  : `SKIPPED: node:sqlite unavailable on Node ${process.versions.node}`;

const FRONT_A = 'data:image/png;base64,AQID';
const FRONT_B = 'data:image/png;base64,BAUG';
const SAME_BYTES_JPEG = 'data:image/jpeg;base64,AQID';
const THUMBNAIL = 'data:image/webp;base64,BwgJ';
const BACK_A = 'data:image/png;base64,CgsM';
const EXTERNAL_A = 'https://example.com/bean/front.png?token=a%2Fb';
const EXTERNAL_B = 'https://example.com/bean/front.png?token=a%2fb';
let imageIdSequence = 0;
let objectKeySequence = 0;

type WriteHook = (objectKey: string, bytes: Uint8Array) => Promise<void>;

class FakeNativeImageFileStore implements NativeImageFileStore {
  readonly objects = new Map<string, Uint8Array>();
  readonly writes: Array<{ objectKey: string; bytes: Uint8Array }> = [];
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
    if (this.objects.has(objectKey)) {
      throw new Error('object key collision');
    }
    const copy = bytes.slice();
    this.objects.set(objectKey, copy);
    this.writes.push({ objectKey, bytes: copy });
  }

  async read(objectKey: string): Promise<Uint8Array> {
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
}

function bean(
  id: string,
  timestamp = 100,
  extra: Record<string, unknown> = {}
): CoffeeBean {
  return { id, timestamp, name: `Bean ${id}`, ...extra } as CoffeeBean;
}

function createPersistence(
  driver: SqliteDriver,
  store: FakeNativeImageFileStore,
  options: Parameters<typeof createSqliteCoffeeBeanPersistence>[2] = {}
) {
  return createSqliteCoffeeBeanPersistence(driver, store, {
    imageIdFactory: () => `image-${++imageIdSequence}`,
    objectKeyFactory: () => `object-${++objectKeySequence}`,
    now: () => 900,
    thumbnailGenerator: async () => THUMBNAIL,
    ...options,
  });
}

async function metadataFor(driver: SqliteDriver, beanId: string) {
  return listCoffeeBeanImageMetadata(driver, beanId);
}

function pathsOf(rows: Awaited<ReturnType<typeof metadataFor>>): string[] {
  return rows.flatMap(row =>
    row.sourceKind === 'file' ? [row.relativePath] : []
  );
}

function rowFor(
  rows: Awaited<ReturnType<typeof metadataFor>>,
  slot: 'front' | 'back',
  variant: 'original' | 'thumbnail' = 'original'
) {
  return rows.find(row => row.slot === slot && row.variant === variant);
}

async function subjectJson(
  driver: SqliteDriver,
  beanId: string
): Promise<Record<string, unknown> | undefined> {
  const rows = await driver.query(
    'SELECT record_json FROM coffee_beans WHERE id = ?',
    [beanId]
  );
  if (rows.length === 0) return undefined;
  return JSON.parse(String(rows[0].record_json)) as Record<string, unknown>;
}

function makeDriverProxy(
  driver: SqliteDriver,
  options: {
    failExecute?: (sql: string) => boolean;
    afterCommitError?: Error;
    failReadBack?: () => boolean;
    rollbackDiagnostic?: boolean;
  }
): SqliteDriver {
  return {
    execute: (sql, params) => driver.execute(sql, params),
    query: (sql, params) => {
      if (options.failReadBack?.() && sql.includes('relative_path IN')) {
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

describeNodeSqlite(
  `${sqliteLabel} Native CoffeeBean aggregate persistence`,
  () => {
    let database: NodeSqliteTestDatabase | undefined;
    let store: FakeNativeImageFileStore;
    let persistence: ReturnType<typeof createPersistence>;

    const driver = (): SqliteDriver => {
      if (!database) throw new Error('Node SQLite database is not open');
      return database.driver;
    };

    beforeEach(async () => {
      database = await createNodeSqliteTestDatabase();
      store = new FakeNativeImageFileStore();
      persistence = createPersistence(driver(), store);
    });

    afterEach(async () => {
      await database?.close();
      database = undefined;
    });

    it('stores file bytes and external references while keeping the SQLite subject image-free', async () => {
      const input = bean('bean-main', 123, {
        image: FRONT_A,
        backImage: EXTERNAL_A,
        unknownFutureField: { nested: ['retained', null, 4] },
      });

      const returned = await persistence.saveWithImages(input);
      const rows = await metadataFor(driver(), input.id);
      const subject = await subjectJson(driver(), input.id);

      expect(Object.hasOwn(returned, 'image')).toBe(false);
      expect(Object.hasOwn(returned, 'backImage')).toBe(false);
      expect(subject).toMatchObject({
        id: input.id,
        unknownFutureField: { nested: ['retained', null, 4] },
      });
      expect(subject).not.toHaveProperty('image');
      expect(subject).not.toHaveProperty('backImage');
      expect(rowFor(rows, 'front')).toMatchObject({
        sourceKind: 'file',
        variant: 'original',
        mimeType: 'image/png',
        sizeBytes: 3,
        updatedAt: 123,
      });
      expect(rowFor(rows, 'front', 'thumbnail')).toMatchObject({
        sourceKind: 'file',
        mimeType: 'image/webp',
        sizeBytes: 3,
      });
      expect(rowFor(rows, 'back')).toMatchObject({
        sourceKind: 'external',
        externalUrl: EXTERNAL_A,
      });
      expect(rows).toHaveLength(3);
      expect(store.writes).toHaveLength(2);
      expect(Array.from(store.writes[0].bytes)).toEqual([1, 2, 3]);
    });

    it('preserves the untouched side source and identity while advancing the shared timestamp', async () => {
      await persistence.saveWithImages(
        bean('partial', 101, { image: FRONT_A, backImage: BACK_A })
      );
      const before = await metadataFor(driver(), 'partial');
      const oldBack = rowFor(before, 'back');
      const oldBackThumb = rowFor(before, 'back', 'thumbnail');

      await persistence.saveWithImages(
        bean('partial', 202, { image: FRONT_B })
      );

      const after = await metadataFor(driver(), 'partial');
      const afterFront = rowFor(after, 'front');
      expect(rowFor(after, 'back')).toMatchObject({
        imageId: oldBack?.imageId,
        relativePath:
          oldBack?.sourceKind === 'file' ? oldBack.relativePath : undefined,
        updatedAt: 202,
      });
      expect(rowFor(after, 'back', 'thumbnail')).toMatchObject({
        imageId: oldBackThumb?.imageId,
        relativePath:
          oldBackThumb?.sourceKind === 'file'
            ? oldBackThumb.relativePath
            : undefined,
        updatedAt: 202,
      });
      if (afterFront?.sourceKind !== 'file') {
        throw new Error('Expected updated front file metadata');
      }
      expect(
        store.objects.has(parseImageRelativePath(afterFront.relativePath))
      ).toBe(true);
    });

    it('distinguishes a missing image property from an own undefined property', async () => {
      await persistence.saveWithImages(
        bean('undefined-patch', 100, { image: FRONT_A })
      );
      const before = await metadataFor(driver(), 'undefined-patch');
      const beforeOriginal = rowFor(before, 'front');
      const beforeThumbnail = rowFor(before, 'front', 'thumbnail');

      await persistence.saveWithImages(bean('undefined-patch', 222));
      const afterMissing = await metadataFor(driver(), 'undefined-patch');
      expect(rowFor(afterMissing, 'front')).toEqual(beforeOriginal);
      expect(rowFor(afterMissing, 'front', 'thumbnail')).toEqual(
        beforeThumbnail
      );

      await persistence.saveWithImages(
        bean('undefined-patch', 333, { image: undefined })
      );
      const afterUndefined = await metadataFor(driver(), 'undefined-patch');
      expect(rowFor(afterUndefined, 'front')).toMatchObject({
        imageId: beforeOriginal?.imageId,
        relativePath:
          beforeOriginal?.sourceKind === 'file'
            ? beforeOriginal.relativePath
            : undefined,
        updatedAt: 333,
      });
      expect(rowFor(afterUndefined, 'front', 'thumbnail')).toMatchObject({
        imageId: beforeThumbnail?.imageId,
        updatedAt: 333,
      });
    });

    it('clears only an explicitly empty side and deletes its original and thumbnail files', async () => {
      await persistence.saveWithImages(
        bean('clear-side', 111, { image: FRONT_A, backImage: BACK_A })
      );
      const before = await metadataFor(driver(), 'clear-side');
      const frontPaths = pathsOf(before.filter(row => row.slot === 'front'));
      const backRows = before.filter(row => row.slot === 'back');

      await persistence.saveWithImages(bean('clear-side', 222, { image: '' }));

      const after = await metadataFor(driver(), 'clear-side');
      expect(after.filter(row => row.slot === 'front')).toEqual([]);
      expect(after.filter(row => row.slot === 'back')).toEqual(
        backRows.map(row => ({ ...row, updatedAt: 222 }))
      );
      expect(frontPaths).toHaveLength(2);
      expect(
        frontPaths.every(
          path => !store.objects.has(parseImageRelativePath(path))
        )
      ).toBe(true);
    });

    it('reuses image identity and path when MIME and file bytes are unchanged', async () => {
      await persistence.saveWithImages(
        bean('same-file', 100, { image: FRONT_A })
      );
      const before = await metadataFor(driver(), 'same-file');
      const writeCount = store.writes.length;

      await persistence.saveWithImages(
        bean('same-file', 200, { image: FRONT_A })
      );
      const after = await metadataFor(driver(), 'same-file');
      const beforeOriginal = rowFor(before, 'front');
      const expectedPath =
        beforeOriginal?.sourceKind === 'file'
          ? beforeOriginal.relativePath
          : undefined;

      expect(store.writes).toHaveLength(writeCount);
      expect(rowFor(after, 'front')?.imageId).toBe(beforeOriginal?.imageId);
      expect(rowFor(after, 'front')).toMatchObject({
        relativePath: expectedPath,
        updatedAt: 200,
      });
    });

    it('treats equal bytes with a different MIME as a new file source', async () => {
      await persistence.saveWithImages(
        bean('mime-change', 100, { image: FRONT_A })
      );
      const before = await metadataFor(driver(), 'mime-change');
      await persistence.saveWithImages(
        bean('mime-change', 200, { image: SAME_BYTES_JPEG })
      );
      const after = await metadataFor(driver(), 'mime-change');

      expect(rowFor(after, 'front')?.imageId).not.toBe(
        rowFor(before, 'front')?.imageId
      );
      expect(rowFor(after, 'front')).toMatchObject({ mimeType: 'image/jpeg' });
      const beforeOriginal = rowFor(before, 'front');
      expect(
        store.objects.has(
          parseImageRelativePath(
            beforeOriginal?.sourceKind === 'file'
              ? beforeOriginal.relativePath
              : ''
          )
        )
      ).toBe(false);
    });

    it('uses exact external URL equality and safely transitions file and external sources', async () => {
      await persistence.saveWithImages(
        bean('source-switch', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      const fileBefore = rowFor(
        await metadataFor(driver(), 'source-switch'),
        'front'
      );
      const fileWrites = store.writes.length;

      await persistence.saveWithImages(
        bean('source-switch', 200, { image: EXTERNAL_A })
      );
      const external = rowFor(
        await metadataFor(driver(), 'source-switch'),
        'front'
      );
      expect(external).toMatchObject({
        sourceKind: 'external',
        externalUrl: EXTERNAL_A,
      });
      expect(external?.imageId).not.toBe(fileBefore?.imageId);
      expect(store.writes).toHaveLength(fileWrites);
      expect(store.objects.size).toBe(0);

      await persistence.saveWithImages(
        bean('source-switch', 300, { image: EXTERNAL_A })
      );
      const sameExternal = rowFor(
        await metadataFor(driver(), 'source-switch'),
        'front'
      );
      expect(sameExternal?.imageId).toBe(external?.imageId);

      await persistence.saveWithImages(
        bean('source-switch', 400, { image: EXTERNAL_B })
      );
      const differentExternal = rowFor(
        await metadataFor(driver(), 'source-switch'),
        'front'
      );
      expect(differentExternal?.imageId).not.toBe(external?.imageId);

      await persistence.saveWithImages(
        bean('source-switch', 500, { image: FRONT_B }),
        { generateThumbnails: false }
      );
      expect(
        rowFor(await metadataFor(driver(), 'source-switch'), 'front')
      ).toMatchObject({ sourceKind: 'file', mimeType: 'image/png' });
      expect(store.writes).toHaveLength(fileWrites + 1);
    });

    it('rejects unsupported input before writing either side', async () => {
      await expect(
        persistence.saveWithImages(
          bean('invalid-source', 100, {
            image: FRONT_A,
            backImage: 'file:///private/photo.png',
          })
        )
      ).rejects.toThrow();

      expect(store.writes).toEqual([]);
      expect(await subjectJson(driver(), 'invalid-source')).toBeUndefined();
      expect(await metadataFor(driver(), 'invalid-source')).toEqual([]);
    });

    it('compensates an earlier authoritative prewrite when a later file write fails', async () => {
      store.failWriteAt = 2;

      await expect(
        persistence.saveWithImages(
          bean('file-write-failure', 100, {
            image: FRONT_A,
            backImage: BACK_A,
          }),
          { generateThumbnails: false }
        )
      ).rejects.toThrow('injected FileStore write failure 2');

      expect(store.objects.size).toBe(0);
      expect(await metadataFor(driver(), 'file-write-failure')).toEqual([]);
      expect(await subjectJson(driver(), 'file-write-failure')).toBeUndefined();
    });

    it('validates every effective replaceAll image source before writing any file', async () => {
      await expect(
        persistence.replaceAllWithImages(
          [
            bean('replace-valid-first', 100, { image: FRONT_A }),
            bean('replace-invalid-second', 100, {
              image: 'relative/image.png',
            }),
          ],
          { allowDestructiveReplace: true }
        )
      ).rejects.toThrow();

      expect(store.writes).toEqual([]);
      expect(await driver().query('SELECT id FROM coffee_beans')).toEqual([]);
      expect(
        await driver().query('SELECT image_id FROM coffee_bean_images')
      ).toEqual([]);
    });

    it('omits a soft-failed thumbnail and invalidates the stale thumbnail on change', async () => {
      const softFailurePersistence = createPersistence(driver(), store, {
        thumbnailGenerator: async () => undefined,
      });
      await persistence.saveWithImages(
        bean('soft-thumb', 100, { image: FRONT_A })
      );
      const oldThumb = rowFor(
        await metadataFor(driver(), 'soft-thumb'),
        'front',
        'thumbnail'
      );

      await softFailurePersistence.saveWithImages(
        bean('soft-thumb', 200, { image: FRONT_B })
      );
      expect(
        rowFor(await metadataFor(driver(), 'soft-thumb'), 'front', 'thumbnail')
      ).toBe(undefined);
      if (oldThumb?.sourceKind === 'file') {
        expect(
          store.objects.has(parseImageRelativePath(oldThumb.relativePath))
        ).toBe(false);
      }
    });

    it('propagates hard thumbnail-generator rejection before any FileStore writes', async () => {
      const rejecting = createPersistence(driver(), store, {
        thumbnailGenerator: async () => {
          throw new Error('thumbnail generator rejected');
        },
      });

      await expect(
        rejecting.saveWithImages(bean('hard-thumb', 100, { image: FRONT_A }))
      ).rejects.toThrow('thumbnail generator rejected');
      expect(store.writes).toEqual([]);
      expect(await subjectJson(driver(), 'hard-thumb')).toBeUndefined();
    });

    it('treats a thumbnail FileStore failure as derived-thumbnail resilience', async () => {
      store.failWriteAt = 2;
      const onCleanupError = vi.fn();
      const withDiagnostic = createPersistence(driver(), store, {
        onCleanupError,
      });

      await withDiagnostic.saveWithImages(
        bean('thumb-write-fail', 100, { image: FRONT_A })
      );

      const rows = await metadataFor(driver(), 'thumb-write-fail');
      expect(rowFor(rows, 'front')?.variant).toBe('original');
      expect(rowFor(rows, 'front', 'thumbnail')).toBeUndefined();
      expect(store.objects.size).toBe(1);
      expect(onCleanupError).toHaveBeenCalledWith(
        'Thumbnail file write failed; original image was kept'
      );
    });

    it('preserves the previous thumbnail when generation is disabled', async () => {
      await persistence.saveWithImages(
        bean('no-thumb-change', 100, { image: FRONT_A })
      );
      const before = await metadataFor(driver(), 'no-thumb-change');

      await persistence.saveWithImages(
        bean('no-thumb-change', 200, { image: FRONT_B }),
        { generateThumbnails: false }
      );
      const after = await metadataFor(driver(), 'no-thumb-change');
      const beforeThumbnail = rowFor(before, 'front', 'thumbnail');

      expect(rowFor(after, 'front', 'thumbnail')).toMatchObject({
        imageId: beforeThumbnail?.imageId,
        relativePath:
          beforeThumbnail?.sourceKind === 'file'
            ? beforeThumbnail.relativePath
            : undefined,
        updatedAt: 200,
      });
    });

    it('fails closed when an existing file is missing during equality comparison', async () => {
      await persistence.saveWithImages(
        bean('missing-old-file', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      store.objects.clear();

      await expect(
        persistence.saveWithImages(
          bean('missing-old-file', 200, { image: FRONT_A }),
          { generateThumbnails: false }
        )
      ).rejects.toThrow(/missing object/);
      expect(await subjectJson(driver(), 'missing-old-file')).toMatchObject({
        name: 'Bean missing-old-file',
      });
      expect(
        rowFor(await metadataFor(driver(), 'missing-old-file'), 'front')
      ).toMatchObject({
        imageId: rowFor(
          await metadataFor(driver(), 'missing-old-file'),
          'front'
        )?.imageId,
      });
    });

    it('deletes subject and file metadata atomically, then removes unreferenced files', async () => {
      await persistence.saveWithImages(
        bean('delete-one', 100, { image: FRONT_A, backImage: EXTERNAL_A })
      );
      const fileCount = store.objects.size;

      await persistence.deleteWithImages('delete-one');

      expect(await subjectJson(driver(), 'delete-one')).toBeUndefined();
      expect(await metadataFor(driver(), 'delete-one')).toEqual([]);
      expect(store.objects.size).toBe(0);
      expect(fileCount).toBe(2);
    });

    it('cleans image metadata even when deleteWithImages has no subject row', async () => {
      await persistence.saveWithImages(
        bean('orphan-owner', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      await driver().execute('DELETE FROM coffee_beans WHERE id = ?', [
        'orphan-owner',
      ]);

      await persistence.deleteWithImages('orphan-owner');

      expect(await metadataFor(driver(), 'orphan-owner')).toEqual([]);
      expect(store.objects.size).toBe(0);
    });

    it('deletes a batch in one transaction and tolerates duplicate and missing IDs', async () => {
      await persistence.saveWithImages(
        bean('delete-a', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      await persistence.saveWithImages(
        bean('delete-b', 100, { image: BACK_A }),
        { generateThumbnails: false }
      );
      const transactionSpy = vi.spyOn(driver(), 'transaction');

      await persistence.deleteManyWithImages([
        'delete-a',
        'delete-a',
        'missing-delete',
        'delete-b',
      ]);

      expect(transactionSpy).toHaveBeenCalledTimes(1);
      expect(await metadataFor(driver(), 'delete-a')).toEqual([]);
      expect(await metadataFor(driver(), 'delete-b')).toEqual([]);
      expect(store.objects.size).toBe(0);
    });

    it('rolls back the entire deleteMany batch if a later owner metadata delete fails', async () => {
      await persistence.saveWithImages(
        bean('delete-rollback-a', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      await persistence.saveWithImages(
        bean('delete-rollback-b', 100, { image: BACK_A }),
        { generateThumbnails: false }
      );
      let deletes = 0;
      const failing = createPersistence(
        makeDriverProxy(driver(), {
          failExecute: sql => {
            if (!sql.startsWith('DELETE FROM coffee_bean_images')) return false;
            deletes += 1;
            return deletes === 2;
          },
        }),
        store
      );
      const beforeKeys = await store.listObjectKeys();

      await expect(
        failing.deleteManyWithImages(['delete-rollback-a', 'delete-rollback-b'])
      ).rejects.toThrow('injected SQL failure');

      expect(await subjectJson(driver(), 'delete-rollback-a')).toBeDefined();
      expect(await subjectJson(driver(), 'delete-rollback-b')).toBeDefined();
      expect(await metadataFor(driver(), 'delete-rollback-a')).toHaveLength(1);
      expect(await metadataFor(driver(), 'delete-rollback-b')).toHaveLength(1);
      expect(await store.listObjectKeys()).toEqual(beforeKeys);
    });

    it('does no writes or metadata changes when the destructive replace guard blocks', async () => {
      const many = Array.from({ length: 20 }, (_, index) =>
        bean(`guard-${index}`, index + 1)
      );
      await persistence.replaceAllWithImages(many);
      const before = await driver().query(
        'SELECT id, record_json FROM coffee_beans ORDER BY id'
      );

      const result = await persistence.replaceAllWithImages([
        bean('guard-next', 999, { image: FRONT_A }),
      ]);

      expect(result).toBe(false);
      expect(store.writes).toEqual([]);
      expect(
        await driver().query(
          'SELECT id, record_json FROM coffee_beans ORDER BY id'
        )
      ).toEqual(before);
      expect(await driver().query('SELECT * FROM coffee_bean_images')).toEqual(
        []
      );
    });

    it('replaceAll preserves omitted images, clears explicit empty images, and removes omitted owners', async () => {
      await persistence.replaceAllWithImages(
        [
          bean('keep-image', 100, { image: FRONT_A, backImage: BACK_A }),
          bean('clear-image', 100, { image: FRONT_A }),
          bean('remove-image', 100, { image: BACK_A }),
        ],
        { allowDestructiveReplace: true }
      );
      await persistence.saveWithImages(
        bean('keep-image', 150, { image: FRONT_B })
      );
      const keepBefore = await metadataFor(driver(), 'keep-image');
      const keepOriginal = rowFor(keepBefore, 'front');
      const keepThumbnail = rowFor(keepBefore, 'front', 'thumbnail');

      await persistence.replaceAllWithImages(
        [
          bean('keep-image', 200),
          bean('clear-image', 200, { image: undefined }),
          bean('new-image', 200, { image: EXTERNAL_A }),
        ],
        { allowDestructiveReplace: true }
      );

      expect(
        rowFor(await metadataFor(driver(), 'keep-image'), 'front')
      ).toEqual(keepOriginal);
      expect(
        rowFor(await metadataFor(driver(), 'keep-image'), 'front', 'thumbnail')
      ).toEqual(keepThumbnail);
      expect(await metadataFor(driver(), 'clear-image')).toEqual([]);
      expect(await subjectJson(driver(), 'remove-image')).toBeUndefined();
      expect(await metadataFor(driver(), 'remove-image')).toEqual([]);
      expect(
        rowFor(await metadataFor(driver(), 'new-image'), 'front')
      ).toMatchObject({
        sourceKind: 'external',
        externalUrl: EXTERNAL_A,
      });
    });

    it('replaceAll writes only the last effective duplicate-ID image record and no thumbnails', async () => {
      await persistence.replaceAllWithImages(
        [bean('duplicate', 100, { image: FRONT_A })],
        { allowDestructiveReplace: true }
      );
      const beforeWrites = store.writes.length;

      await persistence.replaceAllWithImages(
        [
          bean('duplicate', 200, { name: 'first duplicate', image: FRONT_A }),
          bean('duplicate', 300, { name: 'last duplicate', image: FRONT_B }),
        ],
        { allowDestructiveReplace: true }
      );

      const rows = await metadataFor(driver(), 'duplicate');
      expect(await subjectJson(driver(), 'duplicate')).toMatchObject({
        name: 'last duplicate',
      });
      expect(rowFor(rows, 'front')).toMatchObject({ sizeBytes: 3 });
      expect(rowFor(rows, 'front', 'thumbnail')).toBeUndefined();
      expect(store.writes).toHaveLength(beforeWrites + 1);
      const original = rowFor(rows, 'front');
      if (original?.sourceKind === 'file') {
        const bytes = await store.read(
          parseImageRelativePath(original.relativePath)
        );
        expect(Array.from(bytes)).toEqual([4, 5, 6]);
      }
    });

    it('removes thumbnail-only metadata and its file when replaceAll removes the owner', async () => {
      await persistence.saveWithImages(bean('thumbnail-only-owner', 100));
      const thumbnailOnly = {
        imageId: 'thumbnail-only-row',
        beanId: 'thumbnail-only-owner',
        slot: 'front' as const,
        variant: 'thumbnail' as const,
        sourceKind: 'file' as const,
        relativePath: 'images/v1/objects/orphan-thumb',
        mimeType: 'image/webp',
        sizeBytes: 3,
      };
      store.objects.set('orphan-thumb', new Uint8Array([7, 8, 9]));
      await replaceCoffeeBeanImageMetadata(driver(), 'thumbnail-only-owner', [
        thumbnailOnly,
      ]);

      await persistence.replaceAllWithImages([bean('remaining-owner', 200)], {
        allowDestructiveReplace: true,
      });

      expect(await metadataFor(driver(), 'thumbnail-only-owner')).toEqual([]);
      expect(store.objects.has('orphan-thumb')).toBe(false);
    });

    it('reuses the original identity for an unchanged replaceAll source while removing thumbnail metadata', async () => {
      await persistence.saveWithImages(
        bean('replace-same', 100, { image: FRONT_A })
      );
      const before = await metadataFor(driver(), 'replace-same');
      const writesBefore = store.writes.length;

      await persistence.replaceAllWithImages(
        [bean('replace-same', 200, { image: FRONT_A })],
        { allowDestructiveReplace: true }
      );

      const after = await metadataFor(driver(), 'replace-same');
      expect(rowFor(after, 'front')?.imageId).toBe(
        rowFor(before, 'front')?.imageId
      );
      expect(rowFor(after, 'front', 'thumbnail')).toBeUndefined();
      expect(store.writes).toHaveLength(writesBefore);
      expect(store.objects.size).toBe(1);
    });

    it('rolls back all subject and metadata changes when replaceAll fails', async () => {
      await persistence.replaceAllWithImages(
        [bean('rollback-old', 100, { image: FRONT_A })],
        { allowDestructiveReplace: true }
      );
      const oldSubject = await subjectJson(driver(), 'rollback-old');
      const oldMetadata = await metadataFor(driver(), 'rollback-old');
      const oldKeys = await store.listObjectKeys();
      const failing = createPersistence(
        makeDriverProxy(driver(), {
          failExecute: sql => sql.startsWith('DELETE FROM coffee_bean_images'),
        }),
        store
      );

      await expect(
        failing.replaceAllWithImages(
          [bean('rollback-new', 200, { image: FRONT_B })],
          { allowDestructiveReplace: true }
        )
      ).rejects.toThrow('injected SQL failure');

      expect(await subjectJson(driver(), 'rollback-old')).toEqual(oldSubject);
      expect(await subjectJson(driver(), 'rollback-new')).toBeUndefined();
      expect(await metadataFor(driver(), 'rollback-old')).toEqual(oldMetadata);
      expect(await store.listObjectKeys()).toEqual(oldKeys);
    });

    it('clears subjects and Bean metadata in one rollback-safe SQLite transaction', async () => {
      await persistence.saveWithImages(
        bean('clear-atomic', 100, { image: FRONT_A })
      );
      const oldSubject = await subjectJson(driver(), 'clear-atomic');
      const oldMetadata = await metadataFor(driver(), 'clear-atomic');
      const failing = createPersistence(
        makeDriverProxy(driver(), {
          failExecute: sql => sql === 'DELETE FROM coffee_bean_images',
        }),
        store
      );

      await expect(failing.clearWithImages()).rejects.toThrow(
        'injected SQL failure'
      );
      expect(await subjectJson(driver(), 'clear-atomic')).toEqual(oldSubject);
      expect(await metadataFor(driver(), 'clear-atomic')).toEqual(oldMetadata);
      expect(store.objects.size).toBe(2);

      await persistence.clearWithImages();
      expect(await driver().query('SELECT id FROM coffee_beans')).toEqual([]);
      expect(
        await driver().query('SELECT image_id FROM coffee_bean_images')
      ).toEqual([]);
      expect(store.objects.size).toBe(0);
    });

    it('does not delete a superseded path still referenced by another Bean', async () => {
      await persistence.saveWithImages(
        bean('shared-a', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      const old = rowFor(await metadataFor(driver(), 'shared-a'), 'front');
      if (old?.sourceKind !== 'file') throw new Error('Expected file metadata');
      const shared = {
        ...old,
        imageId: 'shared-reference',
        beanId: 'shared-b',
      };
      await driver().transaction(tx =>
        import('../imageMetadataExecutor').then(
          ({ replaceCoffeeBeanImageMetadata }) =>
            replaceCoffeeBeanImageMetadata(tx, 'shared-b', [shared])
        )
      );

      await persistence.saveWithImages(
        bean('shared-a', 200, { image: FRONT_B }),
        { generateThumbnails: false }
      );

      expect(store.objects.has(parseImageRelativePath(old.relativePath))).toBe(
        true
      );
    });

    it('does not delete an old Bean file still referenced by BrewingNote metadata', async () => {
      await persistence.saveWithImages(
        bean('bean-note-reference', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      const old = rowFor(
        await metadataFor(driver(), 'bean-note-reference'),
        'front'
      );
      if (old?.sourceKind !== 'file') throw new Error('Expected file metadata');
      const noteRow = {
        ...old,
        imageId: 'note-shared-reference',
        beanId: undefined,
        noteId: 'note-shared',
        position: 0,
      } as unknown as Record<string, unknown>;
      await driver().execute(
        `INSERT INTO brewing_note_images (
        image_id, note_id, position, variant, source_kind, relative_path,
        mime_type, size_bytes, sha256, external_url, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          noteRow.imageId as string,
          noteRow.noteId as string,
          noteRow.position as number,
          noteRow.variant as string,
          noteRow.sourceKind as string,
          noteRow.relativePath as string,
          noteRow.mimeType as string,
          noteRow.sizeBytes as number,
          null,
          null,
          100,
        ]
      );

      await persistence.saveWithImages(
        bean('bean-note-reference', 200, { image: FRONT_B }),
        { generateThumbnails: false }
      );

      expect(store.objects.has(parseImageRelativePath(old.relativePath))).toBe(
        true
      );
    });

    it('fails closed on stored file paths outside the frozen object path grammar', async () => {
      await persistence.saveWithImages(
        bean('corrupt-path', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      const existing = rowFor(
        await metadataFor(driver(), 'corrupt-path'),
        'front'
      );
      if (existing?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      await driver().execute(
        'UPDATE coffee_bean_images SET relative_path = ? WHERE image_id = ?',
        ['other-root/corrupt', existing.imageId]
      );

      await expect(
        persistence.saveWithImages(
          bean('corrupt-path', 200, { image: FRONT_B }),
          { generateThumbnails: false }
        )
      ).rejects.toThrow('Invalid image relative path');
      expect(store.writes).toHaveLength(1);
      expect(await subjectJson(driver(), 'corrupt-path')).toMatchObject({
        timestamp: 100,
      });
    });

    it('compensates new files on transaction rollback and preserves old metadata', async () => {
      await persistence.saveWithImages(
        bean('save-rollback', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      const oldMetadata = await metadataFor(driver(), 'save-rollback');
      const oldSubject = await subjectJson(driver(), 'save-rollback');
      const oldKeyList = await store.listObjectKeys();
      const failing = createPersistence(
        makeDriverProxy(driver(), {
          failExecute: sql => sql.startsWith('INSERT INTO coffee_beans'),
        }),
        store
      );

      await expect(
        failing.saveWithImages(bean('save-rollback', 200, { image: FRONT_B }), {
          generateThumbnails: false,
        })
      ).rejects.toThrow('injected SQL failure');

      expect(await metadataFor(driver(), 'save-rollback')).toEqual(oldMetadata);
      expect(await subjectJson(driver(), 'save-rollback')).toEqual(oldSubject);
      expect(await store.listObjectKeys()).toEqual(oldKeyList);
    });

    it('compensates a metadata write failure before subject commit', async () => {
      const failing = createPersistence(
        makeDriverProxy(driver(), {
          failExecute: sql => sql.startsWith('DELETE FROM coffee_bean_images'),
        }),
        store
      );

      await expect(
        failing.saveWithImages(
          bean('metadata-rollback', 100, { image: FRONT_A }),
          { generateThumbnails: false }
        )
      ).rejects.toThrow('injected SQL failure');

      expect(await subjectJson(driver(), 'metadata-rollback')).toBeUndefined();
      expect(await metadataFor(driver(), 'metadata-rollback')).toEqual([]);
      expect(store.objects.size).toBe(0);
    });

    it('protects committed new objects after a synthetic post-commit error', async () => {
      const failure = new Error('synthetic error after commit');
      const uncertain = createPersistence(
        makeDriverProxy(driver(), { afterCommitError: failure }),
        store
      );

      await expect(
        uncertain.saveWithImages(
          bean('uncertain-commit', 100, { image: FRONT_A }),
          { generateThumbnails: false }
        )
      ).rejects.toBe(failure);

      const rows = await metadataFor(driver(), 'uncertain-commit');
      expect(rows).toHaveLength(1);
      const original = rowFor(rows, 'front');
      if (original?.sourceKind !== 'file')
        throw new Error('Expected file metadata');
      expect(
        store.objects.has(parseImageRelativePath(original.relativePath))
      ).toBe(true);
    });

    it('resolves an uncertain committed delete from current metadata references', async () => {
      await persistence.saveWithImages(
        bean('uncertain-delete', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      const uncertain = createPersistence(
        makeDriverProxy(driver(), {
          afterCommitError: new Error('synthetic delete error after commit'),
        }),
        store
      );

      await expect(
        uncertain.deleteWithImages('uncertain-delete')
      ).rejects.toThrow('synthetic delete error after commit');
      expect(await subjectJson(driver(), 'uncertain-delete')).toBeUndefined();
      expect(await metadataFor(driver(), 'uncertain-delete')).toEqual([]);
      expect(store.objects.size).toBe(0);
    });

    it('retains all created files when uncertain-commit read-back fails', async () => {
      let committed = false;
      const uncertain = createPersistence(
        {
          ...makeDriverProxy(driver(), {
            afterCommitError: new Error('after commit'),
          }),
          query: (sql, params) => {
            if (committed && sql.includes('relative_path IN')) {
              return Promise.reject(new Error('read-back failure'));
            }
            return driver().query(sql, params);
          },
          transaction: async work => {
            await driver().transaction(work);
            committed = true;
            throw new Error('after commit');
          },
        },
        store
      );

      await expect(
        uncertain.saveWithImages(
          bean('uncertain-read-failure', 100, { image: FRONT_A }),
          { generateThumbnails: false }
        )
      ).rejects.toThrow('after commit');
      expect(store.objects.size).toBe(1);
      expect(
        await metadataFor(driver(), 'uncertain-read-failure')
      ).toHaveLength(1);
    });

    it('retains new and old files when rollback diagnostics are uncertain', async () => {
      await persistence.saveWithImages(
        bean('rollback-diagnostic', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      const before = await store.listObjectKeys();
      const uncertainRollback = createPersistence(
        makeDriverProxy(driver(), {
          failExecute: sql => sql.startsWith('INSERT INTO coffee_beans'),
          rollbackDiagnostic: true,
        }),
        store
      );

      await expect(
        uncertainRollback.saveWithImages(
          bean('rollback-diagnostic', 200, { image: FRONT_B }),
          { generateThumbnails: false }
        )
      ).rejects.toThrow('injected SQL failure');
      expect(await store.listObjectKeys()).toHaveLength(before.length + 1);
    });

    it('continues a save after best-effort cleanup failure', async () => {
      await persistence.saveWithImages(
        bean('cleanup-fail', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      store.failDeleteAt = 1;
      const onCleanupError = vi.fn();
      const cleanupFailing = createPersistence(driver(), store, {
        onCleanupError,
      });

      await expect(
        cleanupFailing.saveWithImages(
          bean('cleanup-fail', 200, { image: FRONT_B }),
          { generateThumbnails: false }
        )
      ).resolves.toMatchObject({ id: 'cleanup-fail' });
      expect(await metadataFor(driver(), 'cleanup-fail')).toHaveLength(1);
      expect(store.objects.size).toBe(2);
      expect(onCleanupError).toHaveBeenCalledWith(
        'Failed to remove a superseded image object'
      );
    });

    it('serializes concurrent partial saves for one Bean across persistence instances', async () => {
      let firstWriteStarted!: () => void;
      let releaseFirstWrite!: () => void;
      const started = new Promise<void>(resolve => {
        firstWriteStarted = resolve;
      });
      const gate = new Promise<void>(resolve => {
        releaseFirstWrite = resolve;
      });
      let writeNumber = 0;
      store.writeHook = async () => {
        writeNumber += 1;
        if (writeNumber === 1) {
          firstWriteStarted();
          await gate;
        }
      };
      const secondInstance = createPersistence(driver(), store);
      const frontSave = persistence.saveWithImages(
        bean('same-owner-race', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      await started;
      const backSave = secondInstance.saveWithImages(
        bean('same-owner-race', 200, { backImage: BACK_A }),
        { generateThumbnails: false }
      );
      await Promise.resolve();
      expect(store.writeCount).toBe(1);

      releaseFirstWrite();
      await Promise.all([frontSave, backSave]);
      const rows = await metadataFor(driver(), 'same-owner-race');
      expect(rowFor(rows, 'front')?.sourceKind).toBe('file');
      expect(rowFor(rows, 'back')?.sourceKind).toBe('file');
    });

    it('allows FileStore writes for different Beans to overlap', async () => {
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
        bean('different-a', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      const second = persistence.saveWithImages(
        bean('different-b', 100, { image: BACK_A }),
        { generateThumbnails: false }
      );
      await started;
      releaseWrites();
      await Promise.all([first, second]);
      expect(entered).toBe(2);
    });

    it('serializes save followed by delete for the same owner', async () => {
      let firstWriteStarted!: () => void;
      let releaseFirstWrite!: () => void;
      const started = new Promise<void>(resolve => {
        firstWriteStarted = resolve;
      });
      const gate = new Promise<void>(resolve => {
        releaseFirstWrite = resolve;
      });
      store.writeHook = async () => {
        firstWriteStarted();
        await gate;
      };
      const saving = persistence.saveWithImages(
        bean('save-delete-race', 100, { image: FRONT_A }),
        { generateThumbnails: false }
      );
      await started;
      const deleting = persistence.deleteWithImages('save-delete-race');
      let deleteFinished = false;
      void deleting.then(() => {
        deleteFinished = true;
      });
      await Promise.resolve();
      expect(deleteFinished).toBe(false);

      releaseFirstWrite();
      await Promise.all([saving, deleting]);
      expect(await subjectJson(driver(), 'save-delete-race')).toBeUndefined();
      expect(await metadataFor(driver(), 'save-delete-race')).toEqual([]);
      expect(store.objects.size).toBe(0);
    });

    it('holds the exclusive dataset barrier across replaceAll prewrites and commit', async () => {
      let writeStarted!: () => void;
      let releaseWrite!: () => void;
      const started = new Promise<void>(resolve => {
        writeStarted = resolve;
      });
      const gate = new Promise<void>(resolve => {
        releaseWrite = resolve;
      });
      store.writeHook = async () => {
        writeStarted();
        await gate;
      };
      const replacing = persistence.replaceAllWithImages(
        [bean('barrier-replaced', 100, { image: FRONT_A })],
        { allowDestructiveReplace: true }
      );
      await started;
      let saveFinished = false;
      const saving = persistence
        .saveWithImages(bean('barrier-followup', 200))
        .then(() => {
          saveFinished = true;
        });
      await Promise.resolve();
      expect(saveFinished).toBe(false);

      releaseWrite();
      await Promise.all([replacing, saving]);
      expect(await subjectJson(driver(), 'barrier-replaced')).toBeDefined();
      expect(await subjectJson(driver(), 'barrier-followup')).toBeDefined();
    });

    it('treats empty deleteMany as a no-op without touching SQLite or FileStore', async () => {
      const transaction = vi.spyOn(driver(), 'transaction');
      const query = vi.spyOn(driver(), 'query');
      await persistence.deleteManyWithImages([]);
      expect(transaction).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
      expect(store.writes).toEqual([]);
      expect(store.deletes).toEqual([]);
    });
  }
);
