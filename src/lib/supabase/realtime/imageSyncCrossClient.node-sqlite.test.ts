import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { encodeImageDataUrl } from '@/lib/data/images/imageBinary';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import {
  completeHydratedImageSnapshot,
  upsertRecords,
  SYNC_TABLES,
} from '../syncOperations';
import { createSqliteImageDataServices } from '@/lib/data/sqlite/imageDataServices';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import { createSqliteCoffeeBeanRepository } from '@/lib/data/sqlite/repositories/coffeeBean';
import { createSqliteBrewingNoteRepository } from '@/lib/data/sqlite/repositories/brewingNote';

class FakeImageFileStore implements NativeImageFileStore {
  private readonly objects = new Map<string, Uint8Array>();

  async write(key: string, bytes: Uint8Array): Promise<void> {
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

function imageDataUrl(bytes: number[]): string {
  return encodeImageDataUrl({
    mimeType: 'image/png',
    bytes: new Uint8Array(bytes),
  });
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
    updatedAt: 100,
    beanId: null,
    params: { stages: [] },
    rating: 4,
    taste: { sweet: 4 },
    notes: `Note ${id}`,
    ...overrides,
  } as BrewingNote;
}

describeNodeSqlite('Supabase image sync between native clients', () => {
  let databases: NodeSqliteTestDatabase[] = [];

  afterEach(async () => {
    await Promise.all(databases.map(database => database.close()));
    databases = [];
  });

  async function createClient() {
    const database = await createNodeSqliteTestDatabase();
    databases.push(database);
    return {
      driver: database.driver,
      images: createSqliteImageDataServices(
        database.driver as SqliteDriver,
        new FakeImageFileStore()
      ),
    };
  }

  async function publish<T extends { id: string }>(
    table: (typeof SYNC_TABLES)[keyof typeof SYNC_TABLES],
    record: T
  ): Promise<Record<string, unknown>> {
    const snapshot = completeHydratedImageSnapshot(table, record);
    let uploaded: Record<string, unknown> | undefined;
    const upsert = vi.fn(async (row: Record<string, unknown>) => {
      uploaded = row;
      return { error: null };
    });
    const result = await upsertRecords(
      { from: () => ({ upsert }) } as never,
      table,
      [snapshot],
      item => ({
        id: item.id,
        data: item,
        updated_at: new Date(
          (item as { updatedAt?: number; timestamp?: number }).updatedAt ||
            (item as { timestamp?: number }).timestamp ||
            Date.now()
        ).toISOString(),
      })
    );

    expect(result.success).toBe(true);
    expect(upsert).toHaveBeenCalledOnce();
    return uploaded!.data as Record<string, unknown>;
  }

  it('propagates bean image creation, replacement, and removal', async () => {
    const source = await createClient();
    const destination = await createClient();
    const sourceBeans = createSqliteCoffeeBeanRepository(source.driver);
    const destinationBeans = createSqliteCoffeeBeanRepository(
      destination.driver
    );
    const firstImage = imageDataUrl([1, 2, 3]);
    const replacementImage = imageDataUrl([4, 5, 6]);

    await source.images.coffeeBeanPersistence.saveWithImages(
      bean('sync-bean', { image: firstImage, roaster: 'Sync roaster' }),
      { generateThumbnails: false }
    );
    let sourceBean = await source.images.coffeeBeanImageRepository.mergeBean(
      (await sourceBeans.get('sync-bean'))!
    );
    await destination.images.coffeeBeanPersistence.saveWithImages(
      (await publish(
        SYNC_TABLES.COFFEE_BEANS,
        sourceBean
      )) as unknown as CoffeeBean,
      { generateThumbnails: false }
    );

    expect(
      (
        await destination.images.coffeeBeanImageRepository.mergeBean(
          (await destinationBeans.get('sync-bean'))!
        )
      ).image
    ).toBe(firstImage);

    await source.images.coffeeBeanPersistence.saveWithImages(
      bean('sync-bean', {
        image: replacementImage,
        roaster: 'Updated sync roaster',
        timestamp: 200,
      }),
      { generateThumbnails: false }
    );
    sourceBean = await source.images.coffeeBeanImageRepository.mergeBean(
      (await sourceBeans.get('sync-bean'))!
    );
    await destination.images.coffeeBeanPersistence.saveWithImages(
      (await publish(
        SYNC_TABLES.COFFEE_BEANS,
        sourceBean
      )) as unknown as CoffeeBean,
      { generateThumbnails: false }
    );

    const replacedBean =
      await destination.images.coffeeBeanImageRepository.mergeBean(
        (await destinationBeans.get('sync-bean'))!
      );
    expect(replacedBean.image).toBe(replacementImage);
    expect(replacedBean.roaster).toBe('Updated sync roaster');

    await source.images.coffeeBeanPersistence.saveWithImages(
      bean('sync-bean', {
        image: '',
        roaster: 'Updated sync roaster',
        timestamp: 300,
      }),
      { generateThumbnails: false }
    );
    sourceBean = await source.images.coffeeBeanImageRepository.mergeBean(
      (await sourceBeans.get('sync-bean'))!
    );
    const clearedBeanData = await publish(SYNC_TABLES.COFFEE_BEANS, sourceBean);
    expect(clearedBeanData.image).toBe('');
    expect(clearedBeanData.backImage).toBe('');
    await destination.images.coffeeBeanPersistence.saveWithImages(
      clearedBeanData as unknown as CoffeeBean,
      { generateThumbnails: false }
    );

    const clearedBean =
      await destination.images.coffeeBeanImageRepository.mergeBean(
        (await destinationBeans.get('sync-bean'))!
      );
    expect(clearedBean.image).toBeUndefined();
    expect(clearedBean.roaster).toBe('Updated sync roaster');
  });

  it('propagates note image creation, replacement, and removal', async () => {
    const source = await createClient();
    const destination = await createClient();
    const sourceNotes = createSqliteBrewingNoteRepository(source.driver);
    const destinationNotes = createSqliteBrewingNoteRepository(
      destination.driver
    );
    const firstImage = imageDataUrl([7, 8, 9]);
    const replacementImage = imageDataUrl([10, 11, 12]);

    await source.images.brewingNotePersistence.saveWithImages(
      note('sync-note', { images: [firstImage] })
    );
    let sourceNote = await source.images.brewingNoteImageRepository.mergeNote(
      (await sourceNotes.get('sync-note'))!
    );
    await destination.images.brewingNotePersistence.saveWithImages(
      (await publish(
        SYNC_TABLES.BREWING_NOTES,
        sourceNote
      )) as unknown as BrewingNote
    );

    expect(
      (
        await destination.images.brewingNoteImageRepository.mergeNote(
          (await destinationNotes.get('sync-note'))!
        )
      ).images
    ).toEqual([firstImage]);

    await source.images.brewingNotePersistence.saveWithImages(
      note('sync-note', {
        images: [replacementImage],
        notes: 'Updated sync note',
        updatedAt: 200,
      })
    );
    sourceNote = await source.images.brewingNoteImageRepository.mergeNote(
      (await sourceNotes.get('sync-note'))!
    );
    await destination.images.brewingNotePersistence.saveWithImages(
      (await publish(
        SYNC_TABLES.BREWING_NOTES,
        sourceNote
      )) as unknown as BrewingNote
    );

    const replacedNote =
      await destination.images.brewingNoteImageRepository.mergeNote(
        (await destinationNotes.get('sync-note'))!
      );
    expect(replacedNote.images).toEqual([replacementImage]);
    expect(replacedNote.notes).toBe('Updated sync note');

    await source.images.brewingNotePersistence.saveWithImages(
      note('sync-note', {
        image: '',
        images: [],
        notes: 'Updated sync note',
        updatedAt: 300,
      })
    );
    sourceNote = await source.images.brewingNoteImageRepository.mergeNote(
      (await sourceNotes.get('sync-note'))!
    );
    const clearedNoteData = await publish(
      SYNC_TABLES.BREWING_NOTES,
      sourceNote
    );
    expect(clearedNoteData.image).toBe('');
    expect(clearedNoteData.images).toEqual([]);
    await destination.images.brewingNotePersistence.saveWithImages(
      clearedNoteData as unknown as BrewingNote
    );

    const clearedNote =
      await destination.images.brewingNoteImageRepository.mergeNote(
        (await destinationNotes.get('sync-note'))!
      );
    expect(clearedNote.images ?? []).toEqual([]);
    expect(clearedNote.notes).toBe('Updated sync note');
  });
});
