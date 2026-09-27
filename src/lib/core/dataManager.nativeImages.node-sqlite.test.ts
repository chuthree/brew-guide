import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import {
  encodeImageDataUrl,
  decodeImageDataUrl,
} from '@/lib/data/images/imageBinary';
import { db } from '@/lib/core/db';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { createSqliteImageDataServices } from '@/lib/data/sqlite/imageDataServices';
import type { SqliteImageDataServices } from '@/lib/data/sqlite/imageDataServices';
import {
  coffeeBeanImageRepository as dexieCoffeeBeanImages,
  coffeeBeanPersistence as dexieCoffeeBeanPersistence,
} from '@/lib/data/adapters/dexie/coffeeBeanImageRepository';
import {
  brewingNoteImageRepository as dexieBrewingNoteImages,
  brewingNotePersistence as dexieBrewingNotePersistence,
} from '@/lib/data/adapters/dexie/brewingNoteImageRepository';
import { createSqliteCoffeeBeanRepository } from '@/lib/data/sqlite/repositories/coffeeBean';
import { createSqliteBrewingNoteRepository } from '@/lib/data/sqlite/repositories/brewingNote';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';

const mocks = vi.hoisted(() => {
  const nativeRuntime: { services: SqliteImageDataServices | null } = {
    services: null,
  };
  return {
    nativeRuntime,
    normalizeCoffeeBeans: vi.fn((beans: unknown[]) => beans),
    storageSet: vi.fn(async () => undefined),
    storageGet: vi.fn(async () => null),
    repositoryServices: {
      appSettingsRepository: {
        clear: vi.fn(async () => undefined),
        save: vi.fn(async () => undefined),
      },
      grinderRepository: {
        list: vi.fn(async () => []),
        replaceAll: vi.fn(async () => undefined),
        clear: vi.fn(async () => undefined),
      },
      customEquipmentRepository: {
        list: vi.fn(async () => []),
        replaceAll: vi.fn(async () => undefined),
        clear: vi.fn(async () => undefined),
      },
      customMethodRepository: {
        list: vi.fn(async () => []),
        clear: vi.fn(async () => undefined),
        save: vi.fn(async () => undefined),
      },
      coffeeBeanRepository: {
        count: vi.fn(async () => 0),
      },
      brewingNoteRepository: {},
      coffeeBeanImageRepository: {
        exportAll: vi.fn(async () =>
          nativeRuntime.services
            ? nativeRuntime.services.coffeeBeanImageRepository.exportAll()
            : ([] as CoffeeBean[])
        ),
        getRecordCounts: vi.fn(async () => ({ records: 0, thumbnails: 0 })),
      },
      coffeeBeanPersistence: {
        replaceAllWithImages: vi.fn(
          async (
            records: CoffeeBean[],
            options?: {
              allowEmptyReplace?: boolean;
              allowDestructiveReplace?: boolean;
            }
          ) =>
            nativeRuntime.services
              ? nativeRuntime.services.coffeeBeanPersistence.replaceAllWithImages(
                  records,
                  options
                )
              : true
        ),
        clearWithImages: vi.fn(async () => undefined),
      },
      brewingNoteImageRepository: {
        exportAll: vi.fn(async () =>
          nativeRuntime.services
            ? nativeRuntime.services.brewingNoteImageRepository.exportAll()
            : ([] as BrewingNote[])
        ),
        getRecordCounts: vi.fn(async () => ({ records: 0, thumbnails: 0 })),
      },
      brewingNotePersistence: {
        replaceAllWithImages: vi.fn(
          async (
            records: BrewingNote[],
            options?: {
              allowEmptyReplace?: boolean;
              allowDestructiveReplace?: boolean;
            }
          ) =>
            nativeRuntime.services
              ? nativeRuntime.services.brewingNotePersistence.replaceAllWithImages(
                  records,
                  options
                )
              : true
        ),
        clearWithImages: vi.fn(async () => undefined),
      },
      legacySettingsRepository: {
        clear: vi.fn(async () => undefined),
      },
      imageSourcePayloadValidator: {
        validateCoffeeBeans: vi.fn(async (records: readonly unknown[]) =>
          nativeRuntime.services?.imageSourcePayloadValidator.validateCoffeeBeans(
            records
          )
        ),
        validateBrewingNotes: vi.fn(async (records: readonly unknown[]) =>
          nativeRuntime.services?.imageSourcePayloadValidator.validateBrewingNotes(
            records
          )
        ),
      },
    },
    settingsStore: {
      settings: { username: 'tester' },
      loadSettings: vi.fn(async () => undefined),
      importSettings: vi.fn(async () => undefined),
      updateRoasterConfig: vi.fn(async () => undefined),
    },
  };
});

vi.mock('@/lib/core/config', () => ({ APP_VERSION: 'test' }));
vi.mock('@/lib/core/storage', () => ({
  Storage: {
    set: mocks.storageSet,
    get: mocks.storageGet,
    keys: vi.fn(async () => []),
  },
}));
vi.mock('@/lib/stores/settingsStore', () => ({
  getRoasterConfigsSync: vi.fn(() => []),
  getSettingsStore: vi.fn(() => ({ ...mocks.settingsStore })),
}));
vi.mock('@/lib/stores/coffeeBeanStore', () => ({
  getCoffeeBeanStore: vi.fn(() => ({
    refreshBeans: vi.fn(async () => undefined),
  })),
}));
vi.mock('@/lib/stores/brewingNoteStore', () => ({
  getBrewingNoteStore: vi.fn(() => ({ setNotes: vi.fn() })),
}));
vi.mock('@/lib/stores/customEquipmentStore', () => ({
  getCustomEquipmentStore: vi.fn(() => ({ setEquipments: vi.fn() })),
}));
vi.mock('@/lib/stores/customMethodStore', () => ({
  getCustomMethodStore: vi.fn(() => ({
    loadMethods: vi.fn(async () => undefined),
  })),
}));
vi.mock('@/lib/stores/grinderStore', () => ({
  getGrinderStore: vi.fn(() => ({
    refreshGrinders: vi.fn(async () => undefined),
  })),
}));
vi.mock('@/lib/data/repositories', () => mocks.repositoryServices);
vi.mock('@/lib/utils/coffeeBeanUtils', () => ({
  normalizeCoffeeBeans: mocks.normalizeCoffeeBeans,
}));
vi.mock('@/lib/app/dataIntegrity', () => ({
  markExpectedCoreDataMutation: vi.fn(async () => undefined),
}));
vi.mock('@/lib/app/crashDiagnostics', () => ({
  recordCrashOperationStep: vi.fn(),
}));
vi.mock('@/lib/utils/roasterMigration', () => ({
  migrateRoasterField: vi.fn(async () => undefined),
}));
vi.mock('@/lib/supabase/realtime', () => ({
  getRealtimeSyncService: () => ({ disconnect: vi.fn(async () => undefined) }),
}));

import { DataManager } from './dataManager';

class FakeNativeImageFileStore implements NativeImageFileStore {
  readonly objects = new Map<string, Uint8Array>();
  writes = 0;

  async write(key: string, bytes: Uint8Array): Promise<void> {
    this.writes += 1;
    if (this.objects.has(key)) throw new Error('object already exists');
    this.objects.set(key, bytes.slice());
  }
  async read(key: string): Promise<Uint8Array> {
    const bytes = this.objects.get(key);
    if (!bytes) throw new Error('object not found');
    return bytes.slice();
  }
  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }
  async listObjectKeys(): Promise<string[]> {
    return Array.from(this.objects.keys());
  }
}

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;

let database: NodeSqliteTestDatabase | undefined;
let fileStore: FakeNativeImageFileStore;
let services: ReturnType<typeof createSqliteImageDataServices>;

function image(mimeType: string, bytes: number[]): string {
  return encodeImageDataUrl({ mimeType, bytes: new Uint8Array(bytes) });
}

function bean(id: string, overrides: Partial<CoffeeBean> = {}): CoffeeBean {
  return {
    id,
    timestamp: 1_700_000_000_000,
    name: `Bean ${id}`,
    ...overrides,
  } as CoffeeBean;
}

function note(id: string, overrides: Partial<BrewingNote> = {}): BrewingNote {
  return {
    id,
    timestamp: 1_700_000_000_000,
    updatedAt: 1_700_000_000_001,
    beanId: null,
    params: { stages: [] },
    rating: 4,
    taste: { sweet: 4 },
    notes: `Note ${id}`,
    ...overrides,
  } as BrewingNote;
}

describeNodeSqlite(
  `DataManager Native image integration (node:sqlite, Node ${process.versions.node})`,
  () => {
    beforeEach(async () => {
      vi.clearAllMocks();
      database = await createNodeSqliteTestDatabase();
      fileStore = new FakeNativeImageFileStore();
      services = createSqliteImageDataServices(database.driver, fileStore);
      mocks.nativeRuntime.services = services;
    });

    afterEach(async () => {
      await database?.close();
      database = undefined;
      await db.delete();
    });

    it('exports reconstructed Native images in the unchanged backup DTO shape', async () => {
      const localImage = image('image/heif', [1, 2, 3]);
      const remoteImage = 'https://Example.COM/coffee%2Fbag?b=2&a=1#Front';
      const localNoteImage = image('image/gif', [4, 5, 6, 7]);
      const noteRemoteImage = 'https://example.com/note.png?signature=exact';
      await services.coffeeBeanPersistence.saveWithImages(
        bean('backup-bean', { image: localImage, backImage: remoteImage }),
        { generateThumbnails: false }
      );
      await services.brewingNotePersistence.saveWithImages(
        note('backup-note', { images: [localNoteImage, noteRemoteImage] })
      );

      const backup = JSON.parse(await DataManager.exportAllData()) as {
        exportDate: string;
        appVersion: string;
        timeZone: string;
        data: Record<string, unknown>;
      };
      const exportedBean = (backup.data.coffeeBeans as CoffeeBean[])[0];
      const exportedNote = (backup.data.brewingNotes as BrewingNote[])[0];

      expect(backup).toHaveProperty('exportDate');
      expect(backup).toHaveProperty('appVersion');
      expect(backup).toHaveProperty('timeZone');
      expect(exportedBean.image).toBe(localImage);
      expect(exportedBean.backImage).toBe(remoteImage);
      expect(exportedNote.image).toBe(localNoteImage);
      expect(exportedNote.images).toEqual([localNoteImage, noteRemoteImage]);
      expect(JSON.stringify(backup)).not.toContain('relativePath');
      expect(JSON.stringify(backup)).not.toContain('sourceKind');
      expect(JSON.stringify(backup)).not.toContain('imageId');
    });

    it('fails backup export when a referenced Native file is missing', async () => {
      const localImage = image('image/png', [9, 8, 7]);
      await services.coffeeBeanPersistence.saveWithImages(
        bean('missing-backup-file', { image: localImage }),
        { generateThumbnails: false }
      );
      const [objectKey] = await fileStore.listObjectKeys();
      expect(objectKey).toBeDefined();
      await fileStore.delete(objectKey!);

      const error = await DataManager.exportAllData().then(
        () => undefined,
        caught => caught
      );

      expect(error).toBeInstanceOf(Error);
      if (!(error instanceof Error))
        throw new Error('Expected export to reject');
      expect(error.message).toContain('file-unavailable');
      expect(error.message).not.toContain(localImage);
      expect(error.message).not.toContain(objectKey);
    });

    it('exports equivalent public image DTOs through Dexie and Native adapters', async () => {
      await db.delete();
      await db.open();

      const localBeanImage = image('image/jpeg', [1, 2, 3]);
      const externalBeanImage = 'https://Example.COM/back%2Fimage?x=1#Back';
      const localNoteImage = image('image/webp', [4, 5]);
      const externalNoteImage = 'https://example.com/note.png?signature=raw';
      const sourceBean = bean('parity-bean', {
        image: localBeanImage,
        backImage: externalBeanImage,
      });
      const sourceNote = note('parity-note', {
        images: [localNoteImage, externalNoteImage, localNoteImage],
      });

      await dexieCoffeeBeanPersistence.saveWithImages(sourceBean, {
        generateThumbnails: false,
      });
      await dexieBrewingNotePersistence.saveWithImages(sourceNote);
      await services.coffeeBeanPersistence.saveWithImages(sourceBean, {
        generateThumbnails: false,
      });
      await services.brewingNotePersistence.saveWithImages(sourceNote);

      const [dexieBeans, dexieNotes, nativeBeans, nativeNotes] =
        await Promise.all([
          dexieCoffeeBeanImages.exportAll(),
          dexieBrewingNoteImages.exportAll(),
          services.coffeeBeanImageRepository.exportAll(),
          services.brewingNoteImageRepository.exportAll(),
        ]);

      expect(nativeBeans).toEqual(dexieBeans);
      expect(nativeNotes).toEqual(dexieNotes);
      expect(nativeNotes[0]).toMatchObject({
        image: localNoteImage,
        images: [localNoteImage, externalNoteImage, localNoteImage],
      });
    });

    it('restores valid backup image strings through Native aggregates', async () => {
      const localImage = image('image/png', [7, 8, 9]);
      const remoteImage = 'https://Example.COM/restored%2Fback.png?q=%2F';
      const noteLocal = image('image/webp', [10, 11]);
      const noteExternal = 'https://example.com/restored-note.gif?z=1';

      const result = await DataManager.importAllData(
        JSON.stringify({
          data: {
            coffeeBeans: [
              bean('restored-bean', {
                image: localImage,
                backImage: remoteImage,
              }),
            ],
            brewingNotes: [
              note('restored-note', { images: [noteLocal, noteExternal] }),
            ],
          },
        })
      );

      expect(result.success).toBe(true);
      expect(
        await createSqliteCoffeeBeanRepository(database!.driver).count()
      ).toBe(1);
      expect(
        await createSqliteBrewingNoteRepository(database!.driver).count()
      ).toBe(1);
      expect(
        (await services.coffeeBeanImageRepository.exportAll())[0]
      ).toMatchObject({ image: localImage, backImage: remoteImage });
      expect(
        (await services.brewingNoteImageRepository.exportAll())[0]
      ).toMatchObject({ image: noteLocal, images: [noteLocal, noteExternal] });
      const fileEntries = Array.from(fileStore.objects.values());
      expect(fileEntries).toHaveLength(2);
      expect(fileEntries.map(bytes => Array.from(bytes))).toContainEqual([
        7, 8, 9,
      ]);
      expect(fileEntries.map(bytes => Array.from(bytes))).toContainEqual([
        10, 11,
      ]);
    });

    it('preflights a late invalid Note image before any destructive backup replacement', async () => {
      const oldBean = bean('old-bean', { image: image('image/jpeg', [1, 1]) });
      const oldNote = note('old-note', { image: image('image/png', [2, 2]) });
      await services.coffeeBeanPersistence.saveWithImages(oldBean, {
        generateThumbnails: false,
      });
      await services.brewingNotePersistence.saveWithImages(oldNote);
      const previousWrites = fileStore.writes;

      const result = await DataManager.importAllData(
        JSON.stringify({
          data: {
            coffeeBeans: [
              bean('replacement-bean', {
                image: image('image/png', [3, 3]),
              }),
            ],
            brewingNotes: [
              note('late-invalid-note', { image: 'blob:unsupported' }),
            ],
          },
        })
      );

      expect(result.success).toBe(false);
      expect(result.message).toMatch(/Invalid external image URL/);
      expect(
        await createSqliteCoffeeBeanRepository(database!.driver).list()
      ).toEqual([expect.objectContaining({ id: 'old-bean' })]);
      expect(
        await createSqliteBrewingNoteRepository(database!.driver).list()
      ).toEqual([expect.objectContaining({ id: 'old-note' })]);
      expect(fileStore.writes).toBe(previousWrites);
      expect(
        (await services.coffeeBeanImageRepository.exportAll())[0].image
      ).toBe(oldBean.image);
      expect(
        (await services.brewingNoteImageRepository.exportAll())[0].image
      ).toBe(oldNote.image);
    });

    it('keeps exported local image bytes and MIME exact after backup round-trip', async () => {
      const source = image('image/HEIF', [0, 255, 18, 33]);
      await services.coffeeBeanPersistence.saveWithImages(
        bean('roundtrip', { image: source }),
        { generateThumbnails: false }
      );

      const output = JSON.parse(await DataManager.exportAllData()) as {
        data: { coffeeBeans: CoffeeBean[] };
      };
      const exportedSource = output.data.coffeeBeans[0].image!;
      expect(exportedSource).toBe(source);
      expect(decodeImageDataUrl(exportedSource)).toEqual({
        mimeType: 'image/HEIF',
        bytes: new Uint8Array([0, 255, 18, 33]),
      });
    });
  }
);
