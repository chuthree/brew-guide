/** Compatibility aliases. New application code should use data/repositories. */
import {
  coffeeBeanImageRepository,
  coffeeBeanPersistence,
} from '@/lib/data/repositories';
import { createImageThumbnailDataUrl } from '@/lib/images/thumbnail';

export type {
  CoffeeBeanImageSide,
  CoffeeBeanImageSourceMode,
} from '@/lib/data/contracts';

export const createCoffeeBeanImageThumbnail = createImageThumbnailDataUrl;
export const getCoffeeBeanImageRecord = coffeeBeanImageRepository.getRecord;
export const getCoffeeBeanImageRecords = coffeeBeanImageRepository.getRecords;
export const getCoffeeBeanImageBeanIds = coffeeBeanImageRepository.getBeanIds;
export const getCoffeeBeanImageSource = coffeeBeanImageRepository.getSource;
export const mergeBeansWithStoredImages = coffeeBeanImageRepository.mergeBeans;
export const mergeBeanWithStoredImages = coffeeBeanImageRepository.mergeBean;
export const exportCoffeeBeansWithImages = coffeeBeanImageRepository.exportAll;
export const saveCoffeeBeanWithImages = coffeeBeanPersistence.saveWithImages;
export const replaceCoffeeBeansWithSplitImages =
  coffeeBeanPersistence.replaceAllWithImages;
