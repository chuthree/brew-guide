import { db } from '@/lib/core/db';
import type { BrewGuideDB } from '@/lib/core/db';
import type { ImageMaintenance } from '@/lib/data/contracts';
import type {
  CoffeeBeanImageRecord,
  CoffeeBeanImageThumbnailRecord,
} from '@/lib/coffee-beans/imageRecords';
import {
  COFFEE_BEAN_IMAGE_COMPRESSION_OPTIONS,
  COFFEE_BEAN_IMAGE_MAX_SIZE_BYTES,
  NOTE_IMAGE_COMPRESSION_OPTIONS,
  NOTE_IMAGE_MAX_SIZE_BYTES,
} from '@/lib/images/imageProcessing';
import {
  applyImageRecompressionResultToStats,
  createImageRecompressionStats,
  recompressStoredImage,
} from '@/lib/images/imageRecompression';

export type DexieImageMaintenanceDatabase = Pick<
  BrewGuideDB,
  | 'coffeeBeanImages'
  | 'coffeeBeanImageThumbnails'
  | 'brewingNoteImages'
  | 'brewingNoteImageThumbnails'
>;

const COFFEE_BEAN_IMAGE_RECOMPRESSION_PROFILE = {
  maxSizeBytes: COFFEE_BEAN_IMAGE_MAX_SIZE_BYTES,
  compression: COFFEE_BEAN_IMAGE_COMPRESSION_OPTIONS,
};

const NOTE_IMAGE_RECOMPRESSION_PROFILE = {
  maxSizeBytes: NOTE_IMAGE_MAX_SIZE_BYTES,
  compression: NOTE_IMAGE_COMPRESSION_OPTIONS,
};

const getRecordImages = (record: {
  image?: string;
  images?: string[];
}): string[] =>
  record.images?.length ? record.images : record.image ? [record.image] : [];

const putOrDeleteCoffeeBeanThumbnail = async (
  record: CoffeeBeanImageThumbnailRecord,
  database: DexieImageMaintenanceDatabase
): Promise<void> => {
  if (!record.imageThumbnail && !record.backImageThumbnail) {
    await database.coffeeBeanImageThumbnails.delete(record.beanId);
    return;
  }

  await database.coffeeBeanImageThumbnails.put(record);
};

export function createDexieImageMaintenance(
  database: DexieImageMaintenanceDatabase = db
): ImageMaintenance {
  return {
    async recompressCoffeeBeanImages() {
      const stats = createImageRecompressionStats();
      const beanIds = (
        await database.coffeeBeanImages.toCollection().primaryKeys()
      ).map(String);

      for (const beanId of beanIds) {
        const record = await database.coffeeBeanImages.get(beanId);
        if (!record) continue;

        stats.scannedCount += 1;
        const nextRecord: CoffeeBeanImageRecord = { ...record };
        const changedSides = new Set<'front' | 'back'>();

        for (const side of ['front', 'back'] as const) {
          const imageKey = side === 'front' ? 'image' : 'backImage';
          const thumbnailKey =
            side === 'front' ? 'imageThumbnail' : 'backImageThumbnail';
          const image = record[imageKey];
          if (!image) continue;

          const result = await recompressStoredImage(
            image,
            COFFEE_BEAN_IMAGE_RECOMPRESSION_PROFILE
          );
          applyImageRecompressionResultToStats(stats, result);

          if (result.failed) {
            console.error('咖啡豆图片补压失败:', {
              beanId,
              side,
              error: result.error,
            });
          }

          if (!result.changed) continue;

          nextRecord[imageKey] = result.image;
          nextRecord[thumbnailKey] = undefined;
          changedSides.add(side);
        }

        if (changedSides.size === 0) continue;

        const updatedAt = Date.now();
        nextRecord.updatedAt = updatedAt;
        await database.coffeeBeanImages.put(nextRecord);

        const thumbnailRecord =
          await database.coffeeBeanImageThumbnails.get(beanId);
        if (thumbnailRecord) {
          await putOrDeleteCoffeeBeanThumbnail(
            {
              ...thumbnailRecord,
              imageThumbnail: changedSides.has('front')
                ? undefined
                : thumbnailRecord.imageThumbnail,
              backImageThumbnail: changedSides.has('back')
                ? undefined
                : thumbnailRecord.backImageThumbnail,
              updatedAt,
            },
            database
          );
        }
      }

      return stats;
    },

    async recompressBrewingNoteImages() {
      const stats = createImageRecompressionStats();
      const noteIds = (
        await database.brewingNoteImages.toCollection().primaryKeys()
      ).map(String);

      for (const noteId of noteIds) {
        const record = await database.brewingNoteImages.get(noteId);
        if (!record) continue;

        stats.scannedCount += 1;
        const images = getRecordImages(record);
        let changed = false;

        const nextImages: string[] = [];
        for (const image of images) {
          const result = await recompressStoredImage(
            image,
            NOTE_IMAGE_RECOMPRESSION_PROFILE
          );
          applyImageRecompressionResultToStats(stats, result);

          if (result.failed) {
            console.error('笔记图片补压失败:', {
              noteId,
              error: result.error,
            });
          }

          changed ||= result.changed;
          nextImages.push(result.image);
        }

        if (!changed) continue;

        await database.brewingNoteImages.put({
          ...record,
          image: nextImages[0],
          images: nextImages,
          updatedAt: Date.now(),
        });
        await database.brewingNoteImageThumbnails.delete(record.noteId);
      }

      return stats;
    },
  };
}

export const dexieImageMaintenance = createDexieImageMaintenance();
