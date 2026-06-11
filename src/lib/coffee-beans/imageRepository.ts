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

const DEFAULT_THUMBNAIL_MAX_SIZE = 192;
const DEFAULT_THUMBNAIL_QUALITY = 0.72;
const THUMBNAIL_GENERATION_IDLE_DELAY_MS = 80;

export type CoffeeBeanImageSide = 'front' | 'back';
export type CoffeeBeanImageSourceMode = 'thumbnail' | 'original';

type CoffeeBeanImageSourceOptions = {
  side?: CoffeeBeanImageSide;
  mode?: CoffeeBeanImageSourceMode;
  preferThumbnail?: boolean;
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
): Promise<string> {
  if (typeof window === 'undefined' || typeof Image === 'undefined') {
    return dataUrl;
  }

  const {
    maxSize = DEFAULT_THUMBNAIL_MAX_SIZE,
    quality = DEFAULT_THUMBNAIL_QUALITY,
  } = options;

  return new Promise(resolve => {
    const image = new Image();

    image.onload = () => {
      try {
        const ratio = Math.min(
          1,
          maxSize / Math.max(image.width, image.height)
        );
        const width = Math.max(1, Math.round(image.width * ratio));
        const height = Math.max(1, Math.round(image.height * ratio));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (!context) {
          resolve(dataUrl);
          return;
        }

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };

    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
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
        : existingThumbnailRecord?.imageThumbnail ||
          existingRecord?.imageThumbnail;
  const nextBackImageThumbnail =
    bean.backImage === ''
      ? undefined
      : generateThumbnails &&
          bean.backImage &&
          bean.backImage !== existingRecord?.backImage
        ? await createCoffeeBeanImageThumbnail(bean.backImage)
        : existingThumbnailRecord?.backImageThumbnail ||
          existingRecord?.backImageThumbnail;
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
  beanIds?: string[]
): Promise<string[]> {
  if (!beanIds) {
    const keys = await db.coffeeBeanImages.toCollection().primaryKeys();
    return keys.map(String);
  }

  const uniqueBeanIds = Array.from(new Set(beanIds.filter(Boolean)));
  if (uniqueBeanIds.length === 0) {
    return [];
  }

  const keys = await db.coffeeBeanImages
    .where('beanId')
    .anyOf(uniqueBeanIds)
    .primaryKeys();
  return keys.map(String);
}

const thumbnailQueue = new Map<
  string,
  {
    beanId: string;
    side: CoffeeBeanImageSide;
  }
>();
let thumbnailQueueRunning = false;

const getThumbnailQueueKey = (
  beanId: string,
  side: CoffeeBeanImageSide
): string => `${beanId}:${side}`;

const notifyCoffeeBeanImageChanged = (beanId: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('coffeeBeanImageThumbnailChanged', {
      detail: { beanId },
    })
  );
};

const runThumbnailQueue = async (): Promise<void> => {
  if (thumbnailQueueRunning) {
    return;
  }

  thumbnailQueueRunning = true;

  try {
    while (thumbnailQueue.size > 0) {
      const [queueKey, task] = thumbnailQueue.entries().next().value as [
        string,
        {
          beanId: string;
          side: CoffeeBeanImageSide;
        },
      ];
      thumbnailQueue.delete(queueKey);

      try {
        const thumbnailKey =
          task.side === 'front' ? 'imageThumbnail' : 'backImageThumbnail';
        const imageKey = task.side === 'front' ? 'image' : 'backImage';
        const existingThumbnail = await getThumbnailRecord(task.beanId);
        if (existingThumbnail?.[thumbnailKey]) {
          continue;
        }

        const imageRecord = await getCoffeeBeanImageRecord(task.beanId);
        const legacyThumbnail = imageRecord?.[thumbnailKey];
        if (legacyThumbnail) {
          await putOrDeleteThumbnailRecord({
            beanId: task.beanId,
            imageThumbnail: existingThumbnail?.imageThumbnail,
            backImageThumbnail: existingThumbnail?.backImageThumbnail,
            [thumbnailKey]: legacyThumbnail,
            updatedAt: imageRecord.updatedAt || Date.now(),
          });
          notifyCoffeeBeanImageChanged(task.beanId);
          continue;
        }

        const image = imageRecord?.[imageKey];
        if (!image) {
          continue;
        }

        const nextThumbnail = await createCoffeeBeanImageThumbnail(image);
        if (!nextThumbnail) {
          continue;
        }

        const nextRecord: CoffeeBeanImageThumbnailRecord = {
          beanId: task.beanId,
          imageThumbnail: existingThumbnail?.imageThumbnail,
          backImageThumbnail: existingThumbnail?.backImageThumbnail,
          [thumbnailKey]: nextThumbnail,
          updatedAt: Date.now(),
        };

        await putOrDeleteThumbnailRecord(nextRecord);
        await db.coffeeBeanImages.update(task.beanId, {
          [thumbnailKey]: nextThumbnail,
        });
        notifyCoffeeBeanImageChanged(task.beanId);
      } catch (error) {
        console.warn('[CoffeeBeanImage] 生成缩略图失败:', error);
      }

      if (THUMBNAIL_GENERATION_IDLE_DELAY_MS > 0) {
        await new Promise(resolve =>
          window.setTimeout(resolve, THUMBNAIL_GENERATION_IDLE_DELAY_MS)
        );
      }
    }
  } finally {
    thumbnailQueueRunning = false;
  }
};

const queueThumbnailGeneration = (
  beanId: string,
  side: CoffeeBeanImageSide
): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const queueKey = getThumbnailQueueKey(beanId, side);
  if (!thumbnailQueue.has(queueKey)) {
    thumbnailQueue.set(queueKey, { beanId, side });
  }

  void runThumbnailQueue();
};

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
    const thumbnail = thumbnailRecord?.[thumbnailKey];
    if (thumbnail) {
      return thumbnail;
    }

    queueThumbnailGeneration(beanId, side);
    return undefined;
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
  beans: CoffeeBean[]
): Promise<void> {
  const strippedBeans: CoffeeBean[] = [];
  const imageRecords: CoffeeBeanImageRecord[] = [];

  for (const bean of beans) {
    const split = splitCoffeeBeanImages(bean);
    strippedBeans.push(split.bean);
    if (split.imageRecord) {
      imageRecords.push(split.imageRecord);
    }
  }

  await db.transaction(
    'rw',
    db.coffeeBeans,
    db.coffeeBeanImages,
    db.coffeeBeanImageThumbnails,
    async () => {
      await db.coffeeBeans.clear();
      await db.coffeeBeanImages.clear();
      await db.coffeeBeanImageThumbnails.clear();

      if (strippedBeans.length > 0) {
        await db.coffeeBeans.bulkPut(strippedBeans);
      }

      if (imageRecords.length > 0) {
        await db.coffeeBeanImages.bulkPut(imageRecords);
      }
    }
  );
}
