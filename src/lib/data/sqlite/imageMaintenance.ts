import type { DataRepositories } from '@/lib/data/repositories';
import type { ImageMaintenance } from '@/lib/data/contracts';
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

type SqliteImageRepositories = Pick<
  DataRepositories,
  | 'coffeeBeanRepository'
  | 'coffeeBeanImageRepository'
  | 'coffeeBeanPersistence'
  | 'brewingNoteRepository'
  | 'brewingNoteImageRepository'
  | 'brewingNotePersistence'
>;

export function createSqliteImageMaintenance(
  repositories: SqliteImageRepositories
): ImageMaintenance {
  return {
    async recompressCoffeeBeanImages() {
      const stats = createImageRecompressionStats();
      const beanIds = await repositories.coffeeBeanImageRepository.getBeanIds();

      for (const beanId of beanIds) {
        const [bean, record] = await Promise.all([
          repositories.coffeeBeanRepository.get(beanId),
          repositories.coffeeBeanImageRepository.getRecord(beanId),
        ]);
        if (!bean || !record) continue;
        stats.scannedCount += 1;

        const updates: Record<string, string> = {};
        for (const [side, field] of [
          ['front', 'image'],
          ['back', 'backImage'],
        ] as const) {
          const image = record[field];
          if (!image) continue;

          const result = await recompressStoredImage(image, {
            maxSizeBytes: COFFEE_BEAN_IMAGE_MAX_SIZE_BYTES,
            compression: COFFEE_BEAN_IMAGE_COMPRESSION_OPTIONS,
          });
          applyImageRecompressionResultToStats(stats, result);

          if (result.failed) {
            console.error('咖啡豆图片补压失败:', {
              beanId,
              side,
              error: result.error,
            });
          }
          if (result.changed) updates[field] = result.image;
        }

        if (Object.keys(updates).length > 0) {
          await repositories.coffeeBeanPersistence.saveWithImages({
            ...bean,
            ...updates,
          });
        }
      }

      return stats;
    },

    async recompressBrewingNoteImages() {
      const stats = createImageRecompressionStats();
      const noteIds =
        await repositories.brewingNoteImageRepository.getNoteIds();

      for (const noteId of noteIds) {
        const [note, images] = await Promise.all([
          repositories.brewingNoteRepository.get(noteId),
          repositories.brewingNoteImageRepository.getImages(noteId),
        ]);
        if (!note || images.length === 0) continue;
        stats.scannedCount += 1;

        let changed = false;
        const nextImages: string[] = [];
        for (const image of images) {
          const result = await recompressStoredImage(image, {
            maxSizeBytes: NOTE_IMAGE_MAX_SIZE_BYTES,
            compression: NOTE_IMAGE_COMPRESSION_OPTIONS,
          });
          applyImageRecompressionResultToStats(stats, result);

          if (result.failed) {
            console.error('笔记图片补压失败:', { noteId, error: result.error });
          }
          changed ||= result.changed;
          nextImages.push(result.image);
        }

        if (changed) {
          await repositories.brewingNotePersistence.saveWithImages({
            ...note,
            image: nextImages[0],
            images: nextImages,
          });
        }
      }

      return stats;
    },
  };
}
