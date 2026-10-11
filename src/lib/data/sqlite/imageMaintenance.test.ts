import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBeanImageRecord } from '@/lib/coffee-beans/imageRecords';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import { createSqliteImageMaintenance } from './imageMaintenance';

const mocks = vi.hoisted(() => ({
  compressBase64Image: vi.fn(),
}));

vi.mock('@/lib/utils/imageCompression', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/utils/imageCompression')
  >('@/lib/utils/imageCompression');
  return { ...actual, compressBase64Image: mocks.compressBase64Image };
});

const oversizedImage = `data:image/jpeg;base64,${'a'.repeat(440 * 1024)}`;
const compressedImage = 'data:image/webp;base64,AA==';

describe('SQLite image maintenance', () => {
  beforeEach(() => mocks.compressBase64Image.mockReset());

  it('recompresses bean images through aggregate persistence and reports scanned owners', async () => {
    mocks.compressBase64Image.mockResolvedValue(compressedImage);
    const bean = { id: 'bean-1', timestamp: 1, name: 'Bean' } as CoffeeBean;
    const saveWithImages = vi.fn(async (value: CoffeeBean) => value);
    const maintenance = createSqliteImageMaintenance({
      coffeeBeanRepository: { get: vi.fn(async () => bean) },
      coffeeBeanImageRepository: {
        getBeanIds: vi.fn(async () => [bean.id]),
        getRecord: vi.fn(
          async () =>
            ({
              beanId: bean.id,
              image: oversizedImage,
            }) as CoffeeBeanImageRecord
        ),
      },
      coffeeBeanPersistence: { saveWithImages },
      brewingNoteRepository: {},
      brewingNoteImageRepository: {},
      brewingNotePersistence: {},
    } as unknown as Parameters<typeof createSqliteImageMaintenance>[0]);

    await expect(
      maintenance.recompressCoffeeBeanImages()
    ).resolves.toMatchObject({
      scannedCount: 1,
      candidateCount: 1,
      compressedCount: 1,
      failedCount: 0,
    });
    expect(saveWithImages).toHaveBeenCalledWith({
      ...bean,
      image: compressedImage,
    });
  });

  it('recompresses note images in order through aggregate persistence', async () => {
    mocks.compressBase64Image.mockResolvedValue(compressedImage);
    const note = {
      id: 'note-1',
      timestamp: 1,
      notes: 'Note',
    } as BrewingNote;
    const saveWithImages = vi.fn(async (value: BrewingNote) => value);
    const maintenance = createSqliteImageMaintenance({
      coffeeBeanRepository: {},
      coffeeBeanImageRepository: {},
      coffeeBeanPersistence: {},
      brewingNoteRepository: { get: vi.fn(async () => note) },
      brewingNoteImageRepository: {
        getNoteIds: vi.fn(async () => [note.id]),
        getImages: vi.fn(async () => [oversizedImage, oversizedImage]),
      },
      brewingNotePersistence: { saveWithImages },
    } as unknown as Parameters<typeof createSqliteImageMaintenance>[0]);

    await expect(
      maintenance.recompressBrewingNoteImages()
    ).resolves.toMatchObject({
      scannedCount: 1,
      candidateCount: 2,
      compressedCount: 2,
      failedCount: 0,
    });
    expect(saveWithImages).toHaveBeenCalledWith({
      ...note,
      image: compressedImage,
      images: [compressedImage, compressedImage],
    });
  });
});
