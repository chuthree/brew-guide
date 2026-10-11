import type { ImageSourcePayloadValidator } from '@/lib/data/contracts';
import type { BrewingNote } from '@/lib/core/config';
import { classifyPersistentImageString } from '@/lib/data/images/persistentImageSource';
import { getBrewingNoteImages } from '@/lib/notes/imageRecords';

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${label} image payload must be an object`);
  }
  return value as Record<string, unknown>;
}

function validateImageValue(value: unknown, field: string): void {
  if (value === undefined || value === '') return;
  if (typeof value !== 'string') {
    throw new TypeError(`${field} image source must be a string or undefined`);
  }
  classifyPersistentImageString(value);
}

/** Strict Native batch preflight matching the frozen aggregate source rules. */
export const sqliteImageSourcePayloadValidator: ImageSourcePayloadValidator = {
  async validateCoffeeBeans(records) {
    records.forEach((record, index) => {
      const bean = requireRecord(record, `CoffeeBean ${index + 1}`);
      validateImageValue(bean.image, 'CoffeeBean.image');
      validateImageValue(bean.backImage, 'CoffeeBean.backImage');
    });
  },

  async validateBrewingNotes(records) {
    records.forEach((record, index) => {
      const note = requireRecord(record, `BrewingNote ${index + 1}`);
      const images = getBrewingNoteImages(note as unknown as BrewingNote);
      images.forEach(image => validateImageValue(image, 'BrewingNote.images'));
    });
  },
};
