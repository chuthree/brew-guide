import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type {
  BrewingNoteImageRecord,
  BrewingNoteImageThumbnailRecord,
} from './imageRecords';

const mocks = vi.hoisted(() => {
  const notes = new Map<string, BrewingNote>();
  const images = new Map<string, BrewingNoteImageRecord>();
  const thumbnails = new Map<string, BrewingNoteImageThumbnailRecord>();
  const compressBase64Image = vi.fn();

  const table = <T extends object>(records: Map<string, T>, key: keyof T) => ({
    get: vi.fn((id: string) => Promise.resolve(records.get(id))),
    put: vi.fn((record: T) => {
      records.set(String(record[key]), record);
      return Promise.resolve();
    }),
    bulkPut: vi.fn((nextRecords: T[]) => {
      nextRecords.forEach(record => records.set(String(record[key]), record));
      return Promise.resolve();
    }),
    bulkGet: vi.fn((ids: string[]) =>
      Promise.resolve(ids.map(id => records.get(id)))
    ),
    delete: vi.fn((id: string) => {
      records.delete(id);
      return Promise.resolve();
    }),
    bulkDelete: vi.fn((ids: string[]) => {
      ids.forEach(id => records.delete(id));
      return Promise.resolve();
    }),
    clear: vi.fn(() => {
      records.clear();
      return Promise.resolve();
    }),
    count: vi.fn(() => Promise.resolve(records.size)),
    toArray: vi.fn(() => Promise.resolve(Array.from(records.values()))),
    toCollection: vi.fn(() => ({
      primaryKeys: vi.fn(() => Promise.resolve(Array.from(records.keys()))),
    })),
    where: vi.fn(() => ({
      anyOf: (ids: string[]) => ({
        primaryKeys: vi.fn(() =>
          Promise.resolve(ids.filter(id => records.has(id)))
        ),
      }),
    })),
  });

  return {
    notes,
    images,
    thumbnails,
    compressBase64Image,
    db: {
      brewingNotes: table(notes, 'id'),
      brewingNoteImages: table(images, 'noteId'),
      brewingNoteImageThumbnails: table(thumbnails, 'noteId'),
      transaction: vi.fn(async (...args: unknown[]) => {
        const callback = args[args.length - 1] as () => Promise<void>;
        await callback();
      }),
    },
  };
});

vi.mock('@/lib/core/db', () => ({ db: mocks.db }));
vi.mock('@/lib/utils/imageCompression', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/utils/imageCompression')
  >('@/lib/utils/imageCompression');
  return {
    ...actual,
    compressBase64Image: mocks.compressBase64Image,
  };
});

import {
  brewingNoteImageRepository,
  brewingNotePersistence,
} from '@/lib/data/adapters/dexie/brewingNoteImageRepository';
import {
  createDexieImageMaintenance,
  type DexieImageMaintenanceDatabase,
} from '@/lib/data/adapters/dexie/imageMaintenance';

const baseNote: BrewingNote = {
  id: 'note-1',
  timestamp: 1,
  rating: 0,
  taste: {},
  notes: '',
};

describe('brewing note image repository', () => {
  beforeEach(() => {
    mocks.notes.clear();
    mocks.images.clear();
    mocks.thumbnails.clear();
    mocks.compressBase64Image.mockReset();
    vi.clearAllMocks();
  });

  it('finds note image ids from original records only', async () => {
    mocks.images.set('image-only', {
      noteId: 'image-only',
      image: 'original',
      updatedAt: 1,
    });
    mocks.thumbnails.set('thumbnail-only', {
      noteId: 'thumbnail-only',
      imageThumbnail: 'thumbnail',
      updatedAt: 1,
    });

    await expect(brewingNoteImageRepository.getNoteIds()).resolves.toEqual([
      'image-only',
    ]);
  });

  it('returns original images without generating thumbnails', async () => {
    mocks.images.set('note-1', {
      noteId: 'note-1',
      image: 'original',
      images: ['original'],
      updatedAt: 1,
    });

    await expect(
      brewingNoteImageRepository.getImages('note-1')
    ).resolves.toEqual(['original']);
    expect(mocks.thumbnails.has('note-1')).toBe(false);
  });

  it('returns multiple stored note images in their original order', async () => {
    const images = [
      'data:image/jpeg;base64,first',
      'data:image/png;base64,second',
      'data:image/webp;base64,third',
    ];
    mocks.images.set('note-1', {
      noteId: 'note-1',
      image: images[0],
      images,
      updatedAt: 1,
    });

    await expect(
      brewingNoteImageRepository.getImages('note-1')
    ).resolves.toEqual(images);
  });

  it('returns an empty list when a note has no images', async () => {
    await expect(
      brewingNoteImageRepository.getImages('missing')
    ).resolves.toEqual([]);
  });

  it('returns stored image counts for list placeholders', async () => {
    mocks.images.set('note-1', {
      noteId: 'note-1',
      image: 'front',
      images: ['front', 'back'],
      updatedAt: 1,
    });

    await expect(
      brewingNoteImageRepository.getImageCounts(['note-1', 'missing'])
    ).resolves.toEqual(new Map([['note-1', 2]]));
  });

  it('preserves stored images when replacing lightweight notes', async () => {
    mocks.images.set('note-1', {
      noteId: 'note-1',
      image: 'original',
      images: ['original'],
      updatedAt: 1,
    });

    await brewingNotePersistence.replaceAllWithImages([
      { ...baseNote, timestamp: 2 },
    ]);

    expect(mocks.images.get('note-1')?.image).toBe('original');
  });

  it('writes the note and its image record in one transaction', async () => {
    await brewingNotePersistence.saveWithImages({
      ...baseNote,
      image: 'original',
      images: ['original'],
    });

    expect(mocks.db.transaction).toHaveBeenCalledWith(
      'rw',
      mocks.db.brewingNotes,
      mocks.db.brewingNoteImages,
      mocks.db.brewingNoteImageThumbnails,
      expect.any(Function)
    );
    expect(mocks.notes.get('note-1')).toBeDefined();
    expect(mocks.images.get('note-1')?.image).toBe('original');
  });

  it('blocks accidental destructive note replacements', async () => {
    for (let index = 0; index < 20; index += 1) {
      mocks.notes.set(`note-${index}`, {
        ...baseNote,
        id: `note-${index}`,
        notes: `Note ${index}`,
      });
    }

    const replaced = await brewingNotePersistence.replaceAllWithImages([
      { ...baseNote, id: 'incoming-note', notes: 'Incoming Note' },
    ]);

    expect(replaced).toBe(false);
    expect(mocks.notes.size).toBe(20);
    expect(mocks.db.brewingNotes.clear).not.toHaveBeenCalled();
  });

  it('allows explicit destructive note replacements', async () => {
    for (let index = 0; index < 20; index += 1) {
      mocks.notes.set(`note-${index}`, {
        ...baseNote,
        id: `note-${index}`,
        notes: `Note ${index}`,
      });
    }

    const replaced = await brewingNotePersistence.replaceAllWithImages(
      [{ ...baseNote, id: 'incoming-note', notes: 'Incoming Note' }],
      { allowDestructiveReplace: true }
    );

    expect(replaced).toBe(true);
    expect(mocks.notes.size).toBe(1);
    expect(mocks.notes.has('incoming-note')).toBe(true);
  });

  it('recompresses oversized note images and expires thumbnails', async () => {
    const oversizedImage = `data:image/jpeg;base64,${'a'.repeat(160 * 1024)}`;
    const smallImage = 'data:image/jpeg;base64,abcd';
    const compressedImage = `data:image/webp;base64,${'b'.repeat(40 * 1024)}`;

    mocks.images.set('note-1', {
      noteId: 'note-1',
      image: oversizedImage,
      images: [oversizedImage, smallImage],
      updatedAt: 1,
    });
    mocks.thumbnails.set('note-1', {
      noteId: 'note-1',
      imageThumbnail: 'thumbnail',
      updatedAt: 1,
    });
    mocks.compressBase64Image.mockResolvedValue(compressedImage);

    const stats = await createDexieImageMaintenance(
      mocks.db as unknown as DexieImageMaintenanceDatabase
    ).recompressBrewingNoteImages();

    expect(mocks.compressBase64Image).toHaveBeenCalledTimes(1);
    expect(mocks.images.get('note-1')).toMatchObject({
      image: compressedImage,
      images: [compressedImage, smallImage],
    });
    expect(mocks.thumbnails.has('note-1')).toBe(false);
    expect(stats).toMatchObject({
      scannedCount: 1,
      candidateCount: 1,
      compressedCount: 1,
      failedCount: 0,
    });
    expect(stats.savedBytes).toBeGreaterThan(0);
  });
});
