import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import {
  encodeImageDataUrl,
  decodeImageDataUrl,
} from '@/lib/data/images/imageBinary';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { upsertRecords, SYNC_TABLES } from '@/lib/supabase/syncOperations';
import type { SqliteDriver } from './driver';
import { createSqliteImageDataServices } from './imageDataServices';
import { listCoffeeBeanImageMetadata } from './imageMetadataExecutor';
import { createSqliteCoffeeBeanRepository } from './repositories/coffeeBean';
import { createSqliteBrewingNoteRepository } from './repositories/brewingNote';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from './repositories/testing/nodeSqliteTestDriver';

class FakeNativeImageFileStore implements NativeImageFileStore {
  readonly objects = new Map<string, Uint8Array>();
  readonly write = vi.fn(async (key: string, bytes: Uint8Array) => {
    if (this.objects.has(key)) throw new Error('object already exists');
    this.objects.set(key, bytes.slice());
  });
  readonly read = vi.fn(async (key: string) => {
    const bytes = this.objects.get(key);
    if (!bytes) throw new Error('object not found');
    return bytes.slice();
  });
  readonly delete = vi.fn(async (key: string) => {
    this.objects.delete(key);
  });
  readonly exists = vi.fn(async (key: string) => this.objects.has(key));
  readonly listObjectKeys = vi.fn(async () => Array.from(this.objects.keys()));
}

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;

let database: NodeSqliteTestDatabase | undefined;
let fileStore: FakeNativeImageFileStore;
let driver: SqliteDriver;
let services: ReturnType<typeof createSqliteImageDataServices>;
let queryLog: string[];

function getDriver(): SqliteDriver {
  if (!database) throw new Error('Node SQLite test database is not open');
  return database.driver;
}

function createTrackingDriver(base: SqliteDriver): SqliteDriver {
  return {
    execute: (...args) => base.execute(...args),
    query: async (...args) => {
      queryLog.push(args[0]);
      return base.query(...args);
    },
    transaction: work => base.transaction(work),
    close: () => base.close(),
  };
}

function imageDataUrl(mimeType: string, values: number[]): string {
  return encodeImageDataUrl({ mimeType, bytes: new Uint8Array(values) });
}

function bean(id: string, overrides: Partial<CoffeeBean> = {}): CoffeeBean {
  return {
    id,
    timestamp: 100,
    name: `Bean ${id}`,
    ...overrides,
  } as CoffeeBean;
}

function note(id: string, overrides: Partial<BrewingNote> = {}): BrewingNote {
  return {
    id,
    timestamp: 100,
    updatedAt: 101,
    beanId: null,
    params: { stages: [] },
    rating: 4,
    taste: { sweet: 4 },
    notes: `Note ${id}`,
    ...overrides,
  } as BrewingNote;
}

describeNodeSqlite(
  `Native image read repositories (node:sqlite, Node ${process.versions.node})`,
  () => {
    beforeEach(async () => {
      database = await createNodeSqliteTestDatabase();
      driver = getDriver();
      fileStore = new FakeNativeImageFileStore();
      queryLog = [];
      services = createSqliteImageDataServices(
        createTrackingDriver(driver),
        fileStore
      );
    });

    afterEach(async () => {
      await database?.close();
      database = undefined;
    });

    it('reconstructs CoffeeBean front file and back external into the public DTO', async () => {
      const original = imageDataUrl('image/HEIC', [1, 2, 3, 4]);
      const external = 'https://Example.COM/a%2Fb?b=2&a=1#Frag';
      const beanRepository = createSqliteCoffeeBeanRepository(driver);
      const beanPersistence = services.coffeeBeanPersistence;

      await beanPersistence.saveWithImages(
        bean('bean-1', { image: original, backImage: external }),
        { generateThumbnails: false }
      );

      const storedSubject = await beanRepository.get('bean-1');
      expect(storedSubject).toEqual(bean('bean-1'));
      expect(storedSubject).not.toHaveProperty('image');
      expect(storedSubject).not.toHaveProperty('backImage');

      const reconstructed = await services.coffeeBeanImageRepository.mergeBean(
        storedSubject!
      );
      expect(reconstructed.image).toBe(original);
      expect(reconstructed.backImage).toBe(external);
      expect(reconstructed).not.toHaveProperty('sourceKind');
      expect(reconstructed).not.toHaveProperty('relativePath');
    });

    it('reconstructs ordered mixed BrewingNote images, keeps duplicates, and exports batch reads', async () => {
      const first = imageDataUrl('image/png', [1, 2]);
      const external = 'https://Example.COM/note%2Fimage?z=1&a=2#Frag';
      const last = imageDataUrl('image/webp', [3, 4, 5]);
      const noteRepository = createSqliteBrewingNoteRepository(driver);
      await services.brewingNotePersistence.saveWithImages(
        note('note-mixed', { images: [first, external, last] })
      );
      await services.brewingNotePersistence.saveWithImages(
        note('note-duplicates', { images: [first, first, external] })
      );

      const storedSubject = await noteRepository.get('note-mixed');
      expect(storedSubject).not.toHaveProperty('image');
      expect(storedSubject).not.toHaveProperty('images');
      const reconstructed = await services.brewingNoteImageRepository.mergeNote(
        storedSubject!
      );
      expect(reconstructed.image).toBe(first);
      expect(reconstructed.images).toEqual([first, external, last]);

      const duplicates =
        await services.brewingNoteImageRepository.getImages('note-duplicates');
      expect(duplicates).toEqual([first, first, external]);

      queryLog = [];
      const exported = await services.brewingNoteImageRepository.exportAll();
      expect(exported.find(item => item.id === 'note-mixed')?.images).toEqual([
        first,
        external,
        last,
      ]);
      expect(
        queryLog.filter(sql => sql.includes('FROM brewing_notes')).length
      ).toBe(1);
      expect(
        queryLog.filter(sql => sql.includes('FROM brewing_note_images')).length
      ).toBe(1);
      expect(fileStore.write).toHaveBeenCalledTimes(4);
    });

    it('uses an existing thumbnail, falls back read-only to the original, and preserves external originals', async () => {
      const original = imageDataUrl('image/png', [9, 8, 7]);
      const thumbnail = imageDataUrl('image/gif', [1, 2]);
      const external = 'https://example.com/external.gif?x=%2F';
      await services.coffeeBeanPersistence.saveWithImages(
        bean('bean-thumbnails', { image: original, backImage: external }),
        { generateThumbnails: false }
      );
      const originalRows = await listCoffeeBeanImageMetadata(
        driver,
        'bean-thumbnails'
      );
      const frontOriginal = originalRows.find(
        row => row.slot === 'front' && row.variant === 'original'
      );
      expect(frontOriginal?.sourceKind).toBe('file');
      await fileStore.write('thumbnail-object', new Uint8Array([1, 2]));
      await driver.transaction(async tx => {
        await tx.execute(
          `INSERT INTO coffee_bean_images (
          image_id, bean_id, slot, variant, source_kind, relative_path,
          mime_type, size_bytes, sha256, external_url, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            'thumb-row',
            'bean-thumbnails',
            'front',
            'thumbnail',
            'file',
            'images/v1/objects/thumbnail-object',
            'image/gif',
            2,
            null,
            null,
            100,
          ]
        );
      });

      expect(
        await services.coffeeBeanImageRepository.getSource('bean-thumbnails', {
          side: 'front',
          mode: 'thumbnail',
        })
      ).toBe(thumbnail);
      const writesBeforeFallback = fileStore.write.mock.calls.length;
      expect(
        await services.coffeeBeanImageRepository.getSource('bean-thumbnails', {
          side: 'back',
          mode: 'thumbnail',
        })
      ).toBe(external);
      expect(
        await services.coffeeBeanImageRepository.getSource('bean-thumbnails', {
          side: 'front',
          mode: 'original',
        })
      ).toBe(original);
      expect(fileStore.write).toHaveBeenCalledTimes(writesBeforeFallback);
    });

    it('fails closed on missing files, size mismatch, and non-contiguous note positions', async () => {
      const source = imageDataUrl('image/jpeg', [4, 5, 6]);
      await services.brewingNotePersistence.saveWithImages(
        note('note-corrupt', { images: [source, source] })
      );
      await driver.execute(
        'UPDATE brewing_note_images SET position = 2 WHERE note_id = ? AND position = 1',
        ['note-corrupt']
      );
      await expect(
        services.brewingNoteImageRepository.getImages('note-corrupt')
      ).rejects.toThrow(/non-contiguous/);

      const noteRepository = createSqliteBrewingNoteRepository(driver);
      await services.brewingNotePersistence.saveWithImages(
        note('note-missing-file', { image: source })
      );
      const noteImageRows = await driver.query(
        'SELECT relative_path, size_bytes FROM brewing_note_images WHERE note_id = ?',
        ['note-missing-file']
      );
      const path = String(noteImageRows[0]?.relative_path);
      const key = path.split('/').at(-1)!;
      fileStore.objects.delete(key);
      await expect(
        services.brewingNoteImageRepository.getImages('note-missing-file')
      ).rejects.toMatchObject({ reason: 'file-unavailable' });

      await services.brewingNotePersistence.saveWithImages(
        note('note-size-mismatch', { image: source })
      );
      await driver.execute(
        'UPDATE brewing_note_images SET size_bytes = size_bytes + 1 WHERE note_id = ?',
        ['note-size-mismatch']
      );
      await expect(
        services.brewingNoteImageRepository.getImages('note-size-mismatch')
      ).rejects.toMatchObject({ reason: 'size-mismatch' });
      expect(await noteRepository.count()).toBe(3);
    });

    it('preflights invalid Supabase image strings before aggregate writes', async () => {
      const before = await createSqliteCoffeeBeanRepository(driver).count();
      const invalidBean = bean('bean-invalid', { image: 'blob:unsupported' });
      await expect(
        services.imageSourcePayloadValidator.validateCoffeeBeans([invalidBean])
      ).rejects.toThrow(/Invalid external image URL/);
      await expect(
        services.coffeeBeanPersistence.saveWithImages(invalidBean)
      ).rejects.toThrow(/Invalid external image URL/);
      expect(await createSqliteCoffeeBeanRepository(driver).count()).toBe(
        before
      );
      expect(fileStore.write).not.toHaveBeenCalled();
    });

    it('sends reconstructed public DTOs through the existing Supabase upsert mapper', async () => {
      const image = imageDataUrl('image/png', [3, 2, 1]);
      const backImage = 'https://Example.COM/remote.png?key=%2F';
      await services.coffeeBeanPersistence.saveWithImages(
        bean('bean-cloud', { image, backImage }),
        { generateThumbnails: false }
      );
      const publicBean = await services.coffeeBeanImageRepository.mergeBean(
        (await createSqliteCoffeeBeanRepository(driver).get('bean-cloud'))!
      );
      const upsert = vi.fn(async (_row: unknown) => ({ error: null }));
      const client = { from: vi.fn(() => ({ upsert })) };

      const result = await upsertRecords(
        client as never,
        SYNC_TABLES.COFFEE_BEANS,
        [publicBean],
        record => ({
          id: record.id,
          data: record,
          updated_at: new Date(record.timestamp).toISOString(),
        })
      );

      expect(result.success).toBe(true);
      expect(upsert).toHaveBeenCalledOnce();
      const uploaded = upsert.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(uploaded.data.image).toBe(image);
      expect(uploaded.data.backImage).toBe(backImage);
      expect(uploaded.data).not.toHaveProperty('sourceKind');
      expect(uploaded.data).not.toHaveProperty('relativePath');
    });

    it('does not issue per-entity metadata queries when merging a list', async () => {
      const image = imageDataUrl('image/png', [1, 3, 5]);
      const beanRepository = createSqliteCoffeeBeanRepository(driver);
      await services.coffeeBeanPersistence.saveWithImages(
        bean('batch-a', { image }),
        { generateThumbnails: false }
      );
      await services.coffeeBeanPersistence.saveWithImages(
        bean('batch-b', { image }),
        { generateThumbnails: false }
      );
      const subjects = await beanRepository.list();

      queryLog = [];
      const merged =
        await services.coffeeBeanImageRepository.mergeBeans(subjects);
      expect(merged).toHaveLength(2);
      expect(merged.every(item => item.image === image)).toBe(true);
      expect(
        queryLog.filter(sql => sql.includes('FROM coffee_bean_images')).length
      ).toBe(1);
      expect(fileStore.read).toHaveBeenCalledTimes(2);
      expect(decodeImageDataUrl(merged[0].image!).bytes).toEqual(
        new Uint8Array([1, 3, 5])
      );
    });
  }
);
