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
import { shouldSkipEmptyReplace } from '@/lib/core/safeReplace';
import {
  createImageThumbnailDataUrl,
  getUsableThumbnailDataUrl,
} from '@/lib/images/thumbnail';

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
): Promise<string | undefined> {
  return createImageThumbnailDataUrl(dataUrl, options);
}

const getUsableThumbnail = (
  thumbnail: string | undefined
): string | undefined => getUsableThumbnailDataUrl(thumbnail);

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
  beanIds?: string[]
): Promise<string[]> {
  if (!beanIds) {
    const keys = await db.coffeeBeanImageThumbnails
      .toCollection()
      .primaryKeys();
    return keys.map(String);
  }

  const uniqueBeanIds = Array.from(new Set(beanIds.filter(Boolean)));
  if (uniqueBeanIds.length === 0) {
    return [];
  }

  const keys = await db.coffeeBeanImageThumbnails
    .where('beanId')
    .anyOf(uniqueBeanIds)
    .primaryKeys();
  return keys.map(String);
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
  beans: CoffeeBean[],
  options: { allowEmptyReplace?: boolean } = {}
): Promise<boolean> {
  const existingCount = beans.length === 0 ? await db.coffeeBeans.count() : 0;
  if (
    shouldSkipEmptyReplace({
      nextCount: beans.length,
      existingCount,
      allowEmptyReplace: options.allowEmptyReplace,
    })
  ) {
    console.warn('[CoffeeBeanImage] 跳过空咖啡豆列表替换，避免误清空数据');
    return false;
  }

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

  return true;
}
