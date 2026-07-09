import { db } from '@/lib/core/db';
import type { CoffeeBean } from '@/types/app';
import {
  type CoffeeBeanImageRecord,
  type CoffeeBeanImageThumbnailRecord,
  mergeCoffeeBeanImages,
  mergeCoffeeBeansWithImages,
  splitCoffeeBeanImages,
  stripCoffeeBeanImages,
} from './imageRecords';
import { shouldSkipDestructiveReplace } from '@/lib/core/safeReplace';
import {
  createImageThumbnailDataUrl,
  getUsableThumbnailDataUrl,
} from '@/lib/images/thumbnail';
import {
  COFFEE_BEAN_IMAGE_COMPRESSION_OPTIONS,
  COFFEE_BEAN_IMAGE_MAX_SIZE_BYTES,
} from '@/lib/images/imageProcessing';
import {
  applyImageRecompressionResultToStats,
  createImageRecompressionStats,
  recompressStoredImage,
  type ImageRecompressionStats,
} from '@/lib/images/imageRecompression';

export type CoffeeBeanImageSide = 'front' | 'back';
export type CoffeeBeanImageSourceMode = 'thumbnail' | 'original';

type CoffeeBeanImageSourceOptions = {
  side?: CoffeeBeanImageSide;
  mode?: CoffeeBeanImageSourceMode;
  preferThumbnail?: boolean;
};

type CoffeeBeanImageIdsOptions = {
  side?: CoffeeBeanImageSide | 'any';
};

const IMAGE_RECORD_LOOKUP_BATCH_SIZE = 32;

const getUsableThumbnail = (
  thumbnail: string | undefined
): string | undefined => getUsableThumbnailDataUrl(thumbnail);

const hasImageForSide = (
  record: CoffeeBeanImageRecord | CoffeeBeanImageThumbnailRecord | undefined,
  side: CoffeeBeanImageSide
): boolean => {
  if (!record) return false;

  if (side === 'front') {
    return Boolean(
      ('image' in record ? record.image : undefined) ||
      getUsableThumbnail(record.imageThumbnail)
    );
  }

  return Boolean(
    ('backImage' in record ? record.backImage : undefined) ||
    getUsableThumbnail(record.backImageThumbnail)
  );
};

const resolveImageSourceMode = ({
  mode,
  preferThumbnail,
}: CoffeeBeanImageSourceOptions): CoffeeBeanImageSourceMode => {
  if (mode) {
    return mode;
  }

  return preferThumbnail === false ? 'original' : 'thumbnail';
};

export async function createCoffeeBeanImageThumbnail(
  dataUrl: string,
  options: {
    maxSize?: number;
    quality?: number;
  } = {}
): Promise<string | undefined> {
  return createImageThumbnailDataUrl(dataUrl, options);
}

const shouldDeleteImageRecord = (record: CoffeeBeanImageRecord): boolean =>
  !record.image && !record.backImage;

const shouldDeleteThumbnailRecord = (
  record: CoffeeBeanImageThumbnailRecord
): boolean => !record.imageThumbnail && !record.backImageThumbnail;

const getThumbnailRecord = (
  beanId: string
): Promise<CoffeeBeanImageThumbnailRecord | undefined> =>
  db.coffeeBeanImageThumbnails.get(beanId);

const putOrDeleteThumbnailRecord = async (
  record: CoffeeBeanImageThumbnailRecord
): Promise<void> => {
  if (shouldDeleteThumbnailRecord(record)) {
    await db.coffeeBeanImageThumbnails.delete(record.beanId);
    return;
  }

  await db.coffeeBeanImageThumbnails.put(record);
};

export type RecompressCoffeeBeanImagesStats = ImageRecompressionStats;

const COFFEE_BEAN_IMAGE_RECOMPRESSION_PROFILE = {
  maxSizeBytes: COFFEE_BEAN_IMAGE_MAX_SIZE_BYTES,
  compression: COFFEE_BEAN_IMAGE_COMPRESSION_OPTIONS,
};

export async function recompressOversizedCoffeeBeanImages(): Promise<RecompressCoffeeBeanImagesStats> {
  const stats = createImageRecompressionStats();
  const beanIds = (await db.coffeeBeanImages.toCollection().primaryKeys()).map(
    String
  );

  for (const beanId of beanIds) {
    const record = await db.coffeeBeanImages.get(beanId);
    if (!record) continue;

    stats.scannedCount += 1;
    const nextRecord: CoffeeBeanImageRecord = { ...record };
    const changedSides = new Set<CoffeeBeanImageSide>();

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
    await db.coffeeBeanImages.put(nextRecord);

    const thumbnailRecord = await getThumbnailRecord(beanId);
    if (thumbnailRecord) {
      await putOrDeleteThumbnailRecord({
        ...thumbnailRecord,
        imageThumbnail: changedSides.has('front')
          ? undefined
          : thumbnailRecord.imageThumbnail,
        backImageThumbnail: changedSides.has('back')
          ? undefined
          : thumbnailRecord.backImageThumbnail,
        updatedAt,
      });
    }
  }

  return stats;
}

export async function persistCoffeeBeanImagesFromBean(
  bean: CoffeeBean,
  options: { generateThumbnails?: boolean } = {}
): Promise<CoffeeBean> {
  const { generateThumbnails = true } = options;
  const { bean: strippedBean, imageRecord } = splitCoffeeBeanImages(bean);
  const hasImageFieldUpdate =
    Object.prototype.hasOwnProperty.call(bean, 'image') ||
    Object.prototype.hasOwnProperty.call(bean, 'backImage');

  if (!imageRecord && !hasImageFieldUpdate) {
    return strippedBean;
  }

  const existingRecord = await db.coffeeBeanImages.get(bean.id);
  const existingThumbnailRecord = await getThumbnailRecord(bean.id);
  const nextImageThumbnail =
    bean.image === ''
      ? undefined
      : generateThumbnails && bean.image && bean.image !== existingRecord?.image
        ? await createCoffeeBeanImageThumbnail(bean.image)
        : getUsableThumbnail(existingThumbnailRecord?.imageThumbnail) ||
          getUsableThumbnail(existingRecord?.imageThumbnail);
  const nextBackImageThumbnail =
    bean.backImage === ''
      ? undefined
      : generateThumbnails &&
          bean.backImage &&
          bean.backImage !== existingRecord?.backImage
        ? await createCoffeeBeanImageThumbnail(bean.backImage)
        : getUsableThumbnail(existingThumbnailRecord?.backImageThumbnail) ||
          getUsableThumbnail(existingRecord?.backImageThumbnail);
  const nextRecord: CoffeeBeanImageRecord = {
    beanId: bean.id,
    image:
      bean.image === ''
        ? undefined
        : bean.image !== undefined
          ? bean.image
          : existingRecord?.image,
    backImage:
      bean.backImage === ''
        ? undefined
        : bean.backImage !== undefined
          ? bean.backImage
          : existingRecord?.backImage,
    imageThumbnail: nextImageThumbnail,
    backImageThumbnail: nextBackImageThumbnail,
    updatedAt: imageRecord?.updatedAt || bean.timestamp || Date.now(),
  };
  const nextThumbnailRecord: CoffeeBeanImageThumbnailRecord = {
    beanId: bean.id,
    imageThumbnail: nextImageThumbnail,
    backImageThumbnail: nextBackImageThumbnail,
    updatedAt: nextRecord.updatedAt,
  };

  if (shouldDeleteImageRecord(nextRecord)) {
    await db.coffeeBeanImages.delete(bean.id);
  } else {
    await db.coffeeBeanImages.put(nextRecord);
  }
  await putOrDeleteThumbnailRecord(nextThumbnailRecord);

  return strippedBean;
}

export async function getCoffeeBeanImageRecord(
  beanId: string
): Promise<CoffeeBeanImageRecord | undefined> {
  return db.coffeeBeanImages.get(beanId);
}

export async function getCoffeeBeanImageRecords(
  beanIds?: string[]
): Promise<CoffeeBeanImageRecord[]> {
  if (!beanIds) {
    return db.coffeeBeanImages.toArray();
  }

  const uniqueBeanIds = Array.from(new Set(beanIds.filter(Boolean)));
  if (uniqueBeanIds.length === 0) {
    return [];
  }

  const records = await db.coffeeBeanImages.bulkGet(uniqueBeanIds);
  return records.filter(Boolean) as CoffeeBeanImageRecord[];
}

export async function getCoffeeBeanImageBeanIds(
  beanIds?: string[],
  options: CoffeeBeanImageIdsOptions = {}
): Promise<string[]> {
  const { side = 'any' } = options;

  if (!beanIds) {
    if (side !== 'any') {
      const [thumbnailRecords, imageRecords] = await Promise.all([
        db.coffeeBeanImageThumbnails.toArray(),
        db.coffeeBeanImages.toArray(),
      ]);
      const ids = new Set<string>();

      thumbnailRecords.forEach(record => {
        if (hasImageForSide(record, side)) ids.add(record.beanId);
      });
      imageRecords.forEach(record => {
        if (hasImageForSide(record, side)) ids.add(record.beanId);
      });

      return Array.from(ids);
    }

    const [thumbnailKeys, imageKeys] = await Promise.all([
      db.coffeeBeanImageThumbnails.toCollection().primaryKeys(),
      db.coffeeBeanImages.toCollection().primaryKeys(),
    ]);
    return Array.from(new Set([...thumbnailKeys, ...imageKeys].map(String)));
  }

  const uniqueBeanIds = Array.from(new Set(beanIds.filter(Boolean)));
  if (uniqueBeanIds.length === 0) {
    return [];
  }

  if (side !== 'any') {
    const imageBeanIds: string[] = [];

    for (
      let offset = 0;
      offset < uniqueBeanIds.length;
      offset += IMAGE_RECORD_LOOKUP_BATCH_SIZE
    ) {
      const batch = uniqueBeanIds.slice(
        offset,
        offset + IMAGE_RECORD_LOOKUP_BATCH_SIZE
      );
      const thumbnailRecords =
        await db.coffeeBeanImageThumbnails.bulkGet(batch);
      const originalCandidateIds = batch.filter(
        (_beanId, index) => !hasImageForSide(thumbnailRecords[index], side)
      );
      const imageRecords =
        originalCandidateIds.length > 0
          ? await db.coffeeBeanImages.bulkGet(originalCandidateIds)
          : [];
      const imageRecordByBeanId = new Map<string, CoffeeBeanImageRecord>();
      imageRecords.forEach(record => {
        if (record) imageRecordByBeanId.set(record.beanId, record);
      });

      batch.forEach((beanId, index) => {
        if (
          hasImageForSide(thumbnailRecords[index], side) ||
          hasImageForSide(imageRecordByBeanId.get(beanId), side)
        ) {
          imageBeanIds.push(beanId);
        }
      });
    }

    return imageBeanIds;
  }

  const [thumbnailKeys, imageKeys] = await Promise.all([
    db.coffeeBeanImageThumbnails
      .where('beanId')
      .anyOf(uniqueBeanIds)
      .primaryKeys(),
    db.coffeeBeanImages.where('beanId').anyOf(uniqueBeanIds).primaryKeys(),
  ]);
  return Array.from(new Set([...thumbnailKeys, ...imageKeys].map(String)));
}

export async function getCoffeeBeanImageSource(
  beanId: string,
  options: CoffeeBeanImageSourceOptions = {}
): Promise<string | undefined> {
  const { side = 'front' } = options;
  const mode = resolveImageSourceMode(options);

  const imageKey = side === 'front' ? 'image' : 'backImage';
  const thumbnailKey =
    side === 'front' ? 'imageThumbnail' : 'backImageThumbnail';

  if (mode === 'thumbnail') {
    const thumbnailRecord = await getThumbnailRecord(beanId);
    const thumbnail = getUsableThumbnail(thumbnailRecord?.[thumbnailKey]);
    if (thumbnail) {
      return thumbnail;
    }

    const record = await getCoffeeBeanImageRecord(beanId);
    const original = record?.[imageKey];
    if (!original) return undefined;

    const nextThumbnail = await createCoffeeBeanImageThumbnail(original);
    if (nextThumbnail) {
      await putOrDeleteThumbnailRecord({
        beanId,
        imageThumbnail:
          side === 'front'
            ? nextThumbnail
            : getUsableThumbnail(thumbnailRecord?.imageThumbnail),
        backImageThumbnail:
          side === 'back'
            ? nextThumbnail
            : getUsableThumbnail(thumbnailRecord?.backImageThumbnail),
        updatedAt: record.updatedAt || Date.now(),
      });
      return nextThumbnail;
    }

    return original;
  }

  const record = await getCoffeeBeanImageRecord(beanId);
  if (!record) return undefined;

  return record[imageKey];
}

export async function mergeBeansWithStoredImages(
  beans: CoffeeBean[]
): Promise<CoffeeBean[]> {
  const imageRecords = await getCoffeeBeanImageRecords(
    beans.map(bean => bean.id)
  );
  return mergeCoffeeBeansWithImages(beans, imageRecords);
}

export async function mergeBeanWithStoredImages(
  bean: CoffeeBean
): Promise<CoffeeBean> {
  const imageRecord = await getCoffeeBeanImageRecord(bean.id);
  return mergeCoffeeBeanImages(bean, imageRecord);
}

export async function exportCoffeeBeansWithImages(): Promise<CoffeeBean[]> {
  const [beans, imageRecords] = await Promise.all([
    db.coffeeBeans.toArray(),
    db.coffeeBeanImages.toArray(),
  ]);

  return mergeCoffeeBeansWithImages(
    beans.map(stripCoffeeBeanImages),
    imageRecords
  );
}

export async function replaceCoffeeBeansWithSplitImages(
  beans: CoffeeBean[],
  options: {
    allowEmptyReplace?: boolean;
    allowDestructiveReplace?: boolean;
  } = {}
): Promise<boolean> {
  const existingCount = await db.coffeeBeans.count();
  if (
    shouldSkipDestructiveReplace({
      nextCount: beans.length,
      existingCount,
      allowEmptyReplace: options.allowEmptyReplace,
      allowDestructiveReplace: options.allowDestructiveReplace,
    })
  ) {
    console.warn('[CoffeeBeanImage] 跳过咖啡豆列表替换，避免误清空数据');
    return false;
  }

  const strippedBeans: CoffeeBean[] = [];
  const imageRecords: CoffeeBeanImageRecord[] = [];
  const explicitEmptyImageBeanIds: string[] = [];
  const incomingBeanIds = beans.map(bean => bean.id).filter(Boolean);

  for (const bean of beans) {
    const split = splitCoffeeBeanImages(bean);
    strippedBeans.push(split.bean);
    if (split.imageRecord) {
      imageRecords.push(split.imageRecord);
    } else if (
      Object.prototype.hasOwnProperty.call(bean, 'image') ||
      Object.prototype.hasOwnProperty.call(bean, 'backImage')
    ) {
      explicitEmptyImageBeanIds.push(bean.id);
    }
  }

  await db.transaction(
    'rw',
    db.coffeeBeans,
    db.coffeeBeanImages,
    db.coffeeBeanImageThumbnails,
    async () => {
      const existingImageIds = (
        await db.coffeeBeanImages.toCollection().primaryKeys()
      ).map(String);
      const incomingIdSet = new Set(incomingBeanIds);
      const staleImageIds = existingImageIds.filter(
        beanId => !incomingIdSet.has(beanId)
      );
      const imageIdsToDelete = Array.from(
        new Set([...staleImageIds, ...explicitEmptyImageBeanIds])
      );

      await db.coffeeBeans.clear();

      if (strippedBeans.length > 0) {
        await db.coffeeBeans.bulkPut(strippedBeans);
      }

      if (imageIdsToDelete.length > 0) {
        await db.coffeeBeanImages.bulkDelete(imageIdsToDelete);
        await db.coffeeBeanImageThumbnails.bulkDelete(imageIdsToDelete);
      }

      if (imageRecords.length > 0) {
        await db.coffeeBeanImageThumbnails.bulkDelete(
          imageRecords.map(record => record.beanId)
        );
        await db.coffeeBeanImages.bulkPut(imageRecords);
      }
    }
  );

  return true;
}
