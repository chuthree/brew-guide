import { db } from '@/lib/core/db';
import type { BrewGuideDB } from '@/lib/core/db';
import { coffeeBeanRepository } from '@/lib/data/adapters/dexie/coffeeBeanRepository';
import type {
  CoffeeBeanImageSide,
  CoffeeBeanImageIdsOptions,
  CoffeeBeanImageRepository,
  CoffeeBeanImageSourceMode,
  CoffeeBeanImageSourceOptions,
  CoffeeBeanPersistence,
  ImageRecordCounts,
} from '@/lib/data/contracts';
import type { CoffeeBean } from '@/types/app';
import {
  type CoffeeBeanImageRecord,
  type CoffeeBeanImageThumbnailRecord,
  mergeCoffeeBeanImages,
  mergeCoffeeBeansWithImages,
  splitCoffeeBeanImages,
  stripCoffeeBeanImages,
} from '@/lib/coffee-beans/imageRecords';
import { shouldSkipDestructiveReplace } from '@/lib/core/safeReplace';
import {
  createImageThumbnailDataUrl,
  getUsableThumbnailDataUrl,
} from '@/lib/images/thumbnail';

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
  beanId: string,
  database: BrewGuideDB = db
): Promise<CoffeeBeanImageThumbnailRecord | undefined> =>
  database.coffeeBeanImageThumbnails.get(beanId);

const putOrDeleteThumbnailRecord = async (
  record: CoffeeBeanImageThumbnailRecord,
  database: BrewGuideDB = db
): Promise<void> => {
  if (shouldDeleteThumbnailRecord(record)) {
    await database.coffeeBeanImageThumbnails.delete(record.beanId);
    return;
  }

  await database.coffeeBeanImageThumbnails.put(record);
};

export async function persistCoffeeBeanImagesFromBean(
  bean: CoffeeBean,
  options: { generateThumbnails?: boolean } = {}
): Promise<CoffeeBean> {
  const prepared = await prepareCoffeeBeanImageWrite(bean, options);

  if (!prepared.hasImageChange) {
    return prepared.bean;
  }

  await writePreparedCoffeeBeanImages(prepared);
  return prepared.bean;
}

type PreparedCoffeeBeanImageWrite = {
  bean: CoffeeBean;
  imageRecord?: CoffeeBeanImageRecord;
  thumbnailRecord?: CoffeeBeanImageThumbnailRecord;
  deleteImageRecord: boolean;
  deleteThumbnailRecord: boolean;
  hasImageChange: boolean;
};

async function prepareCoffeeBeanImageWrite(
  bean: CoffeeBean,
  options: { generateThumbnails?: boolean } = {},
  database: BrewGuideDB = db
): Promise<PreparedCoffeeBeanImageWrite> {
  const { generateThumbnails = true } = options;
  const { bean: strippedBean, imageRecord } = splitCoffeeBeanImages(bean);
  const hasImageFieldUpdate =
    Object.prototype.hasOwnProperty.call(bean, 'image') ||
    Object.prototype.hasOwnProperty.call(bean, 'backImage');

  if (!imageRecord && !hasImageFieldUpdate) {
    return {
      bean: strippedBean,
      deleteImageRecord: false,
      deleteThumbnailRecord: false,
      hasImageChange: false,
    };
  }

  const existingRecord = await database.coffeeBeanImages.get(bean.id);
  const existingThumbnailRecord = await getThumbnailRecord(bean.id, database);
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

  return {
    bean: strippedBean,
    imageRecord: shouldDeleteImageRecord(nextRecord) ? undefined : nextRecord,
    thumbnailRecord: shouldDeleteThumbnailRecord(nextThumbnailRecord)
      ? undefined
      : nextThumbnailRecord,
    deleteImageRecord: shouldDeleteImageRecord(nextRecord),
    deleteThumbnailRecord: shouldDeleteThumbnailRecord(nextThumbnailRecord),
    hasImageChange: true,
  };
}

async function writePreparedCoffeeBeanImages(
  prepared: PreparedCoffeeBeanImageWrite,
  database: BrewGuideDB = db
): Promise<void> {
  const beanId = prepared.bean.id;
  if (prepared.deleteImageRecord) {
    await database.coffeeBeanImages.delete(beanId);
  } else if (prepared.imageRecord) {
    await database.coffeeBeanImages.put(prepared.imageRecord);
  }

  if (prepared.deleteThumbnailRecord) {
    await database.coffeeBeanImageThumbnails.delete(beanId);
  } else if (prepared.thumbnailRecord) {
    await database.coffeeBeanImageThumbnails.put(prepared.thumbnailRecord);
  }
}

async function saveCoffeeBeanWithImagesInDatabase(
  bean: CoffeeBean,
  options: { generateThumbnails?: boolean } = {},
  database: BrewGuideDB = db
): Promise<CoffeeBean> {
  const prepared = await prepareCoffeeBeanImageWrite(bean, options, database);

  await database.transaction(
    'rw',
    database.coffeeBeans,
    database.coffeeBeanImages,
    database.coffeeBeanImageThumbnails,
    async () => {
      if (prepared.hasImageChange) {
        await writePreparedCoffeeBeanImages(prepared, database);
      }
      await database.coffeeBeans.put(prepared.bean);
    }
  );

  return prepared.bean;
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
    coffeeBeanRepository.list(),
    db.coffeeBeanImages.toArray(),
  ]);

  return mergeCoffeeBeansWithImages(
    beans.map(stripCoffeeBeanImages),
    imageRecords
  );
}

async function replaceCoffeeBeansWithSplitImagesInDatabase(
  beans: CoffeeBean[],
  options: {
    allowEmptyReplace?: boolean;
    allowDestructiveReplace?: boolean;
  } = {},
  database: BrewGuideDB = db
): Promise<boolean> {
  const existingCount = await database.coffeeBeans.count();
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

  await database.transaction(
    'rw',
    database.coffeeBeans,
    database.coffeeBeanImages,
    database.coffeeBeanImageThumbnails,
    async () => {
      const [existingBeanRecords, existingImageIds] = await Promise.all([
        database.coffeeBeans.toArray(),
        database.coffeeBeanImages.toCollection().primaryKeys(),
      ]);
      const existingBeanIds = existingBeanRecords.map(bean => bean.id);
      const incomingIdSet = new Set(incomingBeanIds);
      const staleBeanIds = existingBeanIds.filter(
        beanId => !incomingIdSet.has(beanId)
      );
      const staleImageIds = existingImageIds
        .map(String)
        .filter(beanId => !incomingIdSet.has(beanId));
      const imageIdsToDelete = Array.from(
        new Set([...staleImageIds, ...explicitEmptyImageBeanIds])
      );

      if (strippedBeans.length > 0) {
        await database.coffeeBeans.bulkPut(strippedBeans);
      }

      if (staleBeanIds.length > 0) {
        await database.coffeeBeans.bulkDelete(staleBeanIds);
      }

      if (imageIdsToDelete.length > 0) {
        await database.coffeeBeanImages.bulkDelete(imageIdsToDelete);
        await database.coffeeBeanImageThumbnails.bulkDelete(imageIdsToDelete);
      }

      if (imageRecords.length > 0) {
        await database.coffeeBeanImageThumbnails.bulkDelete(
          imageRecords.map(record => record.beanId)
        );
        await database.coffeeBeanImages.bulkPut(imageRecords);
      }
    }
  );

  return true;
}

export function createDexieCoffeeBeanPersistence(
  database: BrewGuideDB = db
): CoffeeBeanPersistence {
  return {
    saveWithImages(bean, options) {
      return saveCoffeeBeanWithImagesInDatabase(bean, options, database);
    },

    async deleteWithImages(id) {
      await database.transaction(
        'rw',
        database.coffeeBeans,
        database.coffeeBeanImages,
        database.coffeeBeanImageThumbnails,
        async () => {
          await database.coffeeBeans.delete(id);
          await database.coffeeBeanImages.delete(id);
          await database.coffeeBeanImageThumbnails.delete(id);
        }
      );
    },

    async deleteManyWithImages(ids) {
      if (ids.length === 0) return;

      await database.transaction(
        'rw',
        database.coffeeBeans,
        database.coffeeBeanImages,
        database.coffeeBeanImageThumbnails,
        async () => {
          await database.coffeeBeans.bulkDelete(ids);
          await database.coffeeBeanImages.bulkDelete(ids);
          await database.coffeeBeanImageThumbnails.bulkDelete(ids);
        }
      );
    },

    replaceAllWithImages(beans, options) {
      return replaceCoffeeBeansWithSplitImagesInDatabase(
        beans,
        options,
        database
      );
    },

    async clearWithImages() {
      await database.coffeeBeans.clear();
      await database.coffeeBeanImages.clear();
      await database.coffeeBeanImageThumbnails.clear();
    },
  };
}

export const coffeeBeanPersistence = createDexieCoffeeBeanPersistence();

export const coffeeBeanImageRepository: CoffeeBeanImageRepository = {
  getRecord: getCoffeeBeanImageRecord,
  getRecords: getCoffeeBeanImageRecords,
  getBeanIds: getCoffeeBeanImageBeanIds,
  getSource: getCoffeeBeanImageSource,
  mergeBean: mergeBeanWithStoredImages,
  mergeBeans: mergeBeansWithStoredImages,
  exportAll: exportCoffeeBeansWithImages,
  async getRecordCounts(): Promise<ImageRecordCounts> {
    const [records, thumbnails] = await Promise.all([
      db.coffeeBeanImages.count(),
      db.coffeeBeanImageThumbnails.count(),
    ]);
    return { records, thumbnails };
  },
};

/** Dexie-adapter compatibility helpers; application code uses the contracts above. */
export function saveCoffeeBeanWithImages(
  bean: CoffeeBean,
  options: { generateThumbnails?: boolean } = {}
): Promise<CoffeeBean> {
  return coffeeBeanPersistence.saveWithImages(bean, options);
}

export function replaceCoffeeBeansWithSplitImages(
  beans: CoffeeBean[],
  options: {
    allowEmptyReplace?: boolean;
    allowDestructiveReplace?: boolean;
  } = {}
): Promise<boolean> {
  return coffeeBeanPersistence.replaceAllWithImages(beans, options);
}
