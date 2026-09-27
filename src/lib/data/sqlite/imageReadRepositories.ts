import type {
  BrewingNoteImageRepository,
  CoffeeBeanImageRepository,
  ImageRecordCounts,
} from '@/lib/data/contracts';
import type { CoffeeBeanImageRecord } from '@/lib/coffee-beans/imageRecords';
import {
  mergeCoffeeBeansWithImages,
  stripCoffeeBeanImages,
} from '@/lib/coffee-beans/imageRecords';
import type { BrewingNoteImageRecord } from '@/lib/notes/imageRecords';
import {
  mergeBrewingNotesWithImages,
  stripBrewingNoteImages,
} from '@/lib/notes/imageRecords';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import {
  parseImageRelativePath,
  type NativeImageFileStore,
} from '@/lib/data/images/nativeImageFileStore';
import {
  mapWithReadConcurrency,
  readStoredImageSource,
} from '@/lib/data/images/storedImageSourceReader';
import type {
  BrewingNoteImageMetadata,
  CoffeeBeanImageMetadata,
} from './imageMetadata';
import {
  listBrewingNoteImageMetadataForOwners,
  listCoffeeBeanImageMetadataForOwners,
} from './imageMetadataExecutor';
import type { SqliteDriver } from './driver';
import { listBrewingNotes } from './repositories/brewingNote';
import { listCoffeeBeans } from './repositories/coffeeBean';

function assertUniqueBeanMetadata(
  rows: readonly CoffeeBeanImageMetadata[]
): void {
  const identities = new Set<string>();
  for (const row of rows) {
    const identity = JSON.stringify([row.beanId, row.slot, row.variant]);
    if (identities.has(identity)) {
      throw new Error('Duplicate CoffeeBean image metadata identity');
    }
    identities.add(identity);
  }
}

function assertUniqueNoteMetadata(
  rows: readonly BrewingNoteImageMetadata[]
): void {
  const identities = new Set<string>();
  for (const row of rows) {
    const identity = JSON.stringify([row.noteId, row.position, row.variant]);
    if (identities.has(identity)) {
      throw new Error('Duplicate BrewingNote image metadata identity');
    }
    identities.add(identity);
  }
}

function assertContiguousNoteOriginalPositions(
  rows: readonly BrewingNoteImageMetadata[]
): void {
  const positionsByNote = new Map<string, number[]>();
  for (const row of rows) {
    if (row.variant !== 'original') continue;
    const positions = positionsByNote.get(row.noteId) ?? [];
    positions.push(row.position);
    positionsByNote.set(row.noteId, positions);
  }

  for (const positions of positionsByNote.values()) {
    positions.sort((left, right) => left - right);
    if (positions.some((position, index) => position !== index)) {
      throw new Error(
        'BrewingNote image metadata has non-contiguous original positions'
      );
    }
  }
}

function validateMetadataPaths(
  rows: readonly (CoffeeBeanImageMetadata | BrewingNoteImageMetadata)[]
): void {
  for (const row of rows) {
    if (row.sourceKind === 'file') parseImageRelativePath(row.relativePath);
  }
}

async function reconstructBeanRecords(
  rows: readonly CoffeeBeanImageMetadata[],
  fileStore: NativeImageFileStore,
  includeThumbnails: boolean
): Promise<CoffeeBeanImageRecord[]> {
  assertUniqueBeanMetadata(rows);
  validateMetadataPaths(rows);
  const relevantRows = rows.filter(
    row => includeThumbnails || row.variant === 'original'
  );
  const sources = await mapWithReadConcurrency(relevantRows, row =>
    readStoredImageSource(row, fileStore)
  );
  const byOwner = new Map<string, CoffeeBeanImageRecord>();

  relevantRows.forEach((row, index) => {
    const record = byOwner.get(row.beanId) ?? {
      beanId: row.beanId,
      updatedAt: row.updatedAt ?? 0,
    };
    record.updatedAt = Math.max(record.updatedAt, row.updatedAt ?? 0);
    const field =
      row.slot === 'front'
        ? row.variant === 'original'
          ? 'image'
          : 'imageThumbnail'
        : row.variant === 'original'
          ? 'backImage'
          : 'backImageThumbnail';
    record[field] = sources[index];
    byOwner.set(row.beanId, record);
  });

  return Array.from(byOwner.values());
}

async function reconstructNoteRecords(
  rows: readonly BrewingNoteImageMetadata[],
  fileStore: NativeImageFileStore
): Promise<BrewingNoteImageRecord[]> {
  assertUniqueNoteMetadata(rows);
  validateMetadataPaths(rows);
  assertContiguousNoteOriginalPositions(rows);
  const originals = rows.filter(row => row.variant === 'original');
  const sources = await mapWithReadConcurrency(originals, row =>
    readStoredImageSource(row, fileStore)
  );
  const byOwner = new Map<string, BrewingNoteImageRecord>();

  originals.forEach((row, index) => {
    const record = byOwner.get(row.noteId) ?? {
      noteId: row.noteId,
      images: [],
      updatedAt: row.updatedAt ?? 0,
    };
    record.images!.push(sources[index]);
    record.updatedAt = Math.max(record.updatedAt, row.updatedAt ?? 0);
    byOwner.set(row.noteId, record);
  });

  return Array.from(byOwner.values()).map(record => ({
    ...record,
    ...(record.images?.length ? { image: record.images[0] } : {}),
  }));
}

async function countImageVariants(
  driver: SqliteDriver,
  table: 'coffee_bean_images' | 'brewing_note_images'
): Promise<ImageRecordCounts> {
  const rows = await driver.query(
    `SELECT variant, COUNT(*) AS count FROM ${table} GROUP BY variant`
  );
  let records = 0;
  let thumbnails = 0;
  for (const row of rows) {
    if (typeof row.count !== 'number' || !Number.isSafeInteger(row.count)) {
      throw new Error(`Invalid image metadata count in ${table}`);
    }
    if (row.variant === 'original') records = row.count;
    else if (row.variant === 'thumbnail') thumbnails = row.count;
    else throw new Error(`Unknown image metadata variant in ${table}`);
  }
  return { records, thumbnails };
}

export function createSqliteCoffeeBeanImageRepository(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore
): CoffeeBeanImageRepository {
  async function recordsFor(
    beanIds?: string[]
  ): Promise<CoffeeBeanImageRecord[]> {
    const rows = await listCoffeeBeanImageMetadataForOwners(driver, beanIds);
    return reconstructBeanRecords(rows, fileStore, true);
  }

  async function mergeBeans(beans: CoffeeBean[]): Promise<CoffeeBean[]> {
    const cleanBeans = beans.map(stripCoffeeBeanImages);
    const beanIds = cleanBeans.map(bean => bean.id).filter(Boolean);
    if (beanIds.length === 0) return cleanBeans;
    const rows = await listCoffeeBeanImageMetadataForOwners(driver, beanIds);
    const records = await reconstructBeanRecords(rows, fileStore, false);
    return mergeCoffeeBeansWithImages(cleanBeans, records);
  }

  return {
    async getRecord(beanId) {
      const records = await recordsFor([beanId]);
      return records.find(record => record.beanId === beanId);
    },
    getRecords: recordsFor,
    async getBeanIds(beanIds, options = {}) {
      const { side = 'any' } = options;
      const rows = await listCoffeeBeanImageMetadataForOwners(driver, beanIds);
      const owners = new Set<string>();
      for (const row of rows) {
        if (side === 'any' || row.slot === side) owners.add(row.beanId);
      }
      return Array.from(owners);
    },
    async getSource(beanId, options = {}) {
      const { side = 'front' } = options;
      const mode =
        options.mode ??
        (options.preferThumbnail === false ? 'original' : 'thumbnail');
      const rows = await listCoffeeBeanImageMetadataForOwners(driver, [beanId]);
      assertUniqueBeanMetadata(rows);
      for (const row of rows) {
        if (row.slot !== side || row.variant !== mode) continue;
        return readStoredImageSource(row, fileStore);
      }
      if (mode === 'thumbnail') {
        const original = rows.find(
          row => row.slot === side && row.variant === 'original'
        );
        return original
          ? readStoredImageSource(original, fileStore)
          : undefined;
      }
      return undefined;
    },
    async mergeBean(bean) {
      return (await mergeBeans([bean]))[0];
    },
    mergeBeans,
    async exportAll() {
      const [beans, rows] = await Promise.all([
        listCoffeeBeans(driver),
        listCoffeeBeanImageMetadataForOwners(driver),
      ]);
      assertUniqueBeanMetadata(rows);
      const records = await reconstructBeanRecords(rows, fileStore, false);
      return mergeCoffeeBeansWithImages(
        beans.map(stripCoffeeBeanImages),
        records
      );
    },
    getRecordCounts: () => countImageVariants(driver, 'coffee_bean_images'),
  };
}

export function createSqliteBrewingNoteImageRepository(
  driver: SqliteDriver,
  fileStore: NativeImageFileStore
): BrewingNoteImageRepository {
  async function recordsFor(
    noteIds?: string[]
  ): Promise<BrewingNoteImageRecord[]> {
    const rows = await listBrewingNoteImageMetadataForOwners(driver, noteIds);
    return reconstructNoteRecords(rows, fileStore);
  }

  async function mergeNotes(notes: BrewingNote[]): Promise<BrewingNote[]> {
    const cleanNotes = notes.map(stripBrewingNoteImages);
    const noteIds = cleanNotes.map(note => note.id).filter(Boolean);
    if (noteIds.length === 0) return cleanNotes;
    const rows = await listBrewingNoteImageMetadataForOwners(driver, noteIds);
    const records = await reconstructNoteRecords(rows, fileStore);
    return mergeBrewingNotesWithImages(cleanNotes, records);
  }

  return {
    async getRecord(noteId) {
      const records = await recordsFor([noteId]);
      return records.find(record => record.noteId === noteId);
    },
    async getNoteIds(noteIds) {
      const rows = await listBrewingNoteImageMetadataForOwners(driver, noteIds);
      return Array.from(
        new Set(
          rows.filter(row => row.variant === 'original').map(row => row.noteId)
        )
      );
    },
    async getImageCounts(noteIds) {
      const rows = await listBrewingNoteImageMetadataForOwners(driver, noteIds);
      const counts = new Map<string, number>();
      for (const row of rows) {
        if (row.variant !== 'original') continue;
        counts.set(row.noteId, (counts.get(row.noteId) ?? 0) + 1);
      }
      return counts;
    },
    async getImages(noteId) {
      return (
        (await recordsFor([noteId])).find(record => record.noteId === noteId)
          ?.images ?? []
      );
    },
    async mergeNote(note) {
      return (await mergeNotes([note]))[0];
    },
    mergeNotes,
    async exportAll() {
      const [notes, rows] = await Promise.all([
        listBrewingNotes(driver),
        listBrewingNoteImageMetadataForOwners(driver),
      ]);
      const records = await reconstructNoteRecords(rows, fileStore);
      return mergeBrewingNotesWithImages(
        notes.map(stripBrewingNoteImages),
        records
      );
    },
    getRecordCounts: () => countImageVariants(driver, 'brewing_note_images'),
  };
}
