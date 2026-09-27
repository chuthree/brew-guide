import type { ImageSourcePayloadValidator } from '@/lib/data/contracts';

/** Keep existing Dexie import behavior unchanged. */
export const dexieImageSourcePayloadValidator: ImageSourcePayloadValidator = {
  async validateCoffeeBeans() {},
  async validateBrewingNotes() {},
};
