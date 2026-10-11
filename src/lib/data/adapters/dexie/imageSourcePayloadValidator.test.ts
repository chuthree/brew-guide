import { describe, expect, it } from 'vitest';
import { dexieImageSourcePayloadValidator } from './imageSourcePayloadValidator';

describe('Dexie image source payload preflight', () => {
  it('keeps the existing Web/Dexie import policy unchanged', async () => {
    await expect(
      dexieImageSourcePayloadValidator.validateCoffeeBeans([
        { id: 'legacy', image: 'blob:historical-image' },
      ])
    ).resolves.toBeUndefined();
    await expect(
      dexieImageSourcePayloadValidator.validateBrewingNotes([
        { id: 'legacy-note', images: ['not-yet-normalized'] },
      ])
    ).resolves.toBeUndefined();
  });
});
