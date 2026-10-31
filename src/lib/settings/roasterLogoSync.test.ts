import { describe, expect, it } from 'vitest';
import type { RoasterConfig } from '@/lib/data/models';
import { mergeRoasterLogos } from './roasterLogoSync';

const logo: RoasterConfig = {
  roasterName: 'R',
  logoData: 'new-image',
  logoUpdatedAt: 20,
  updatedAt: 20,
};
const deleted: RoasterConfig = {
  roasterName: 'R',
  logoUpdatedAt: 30,
  updatedAt: 30,
};

describe('roaster logo conflict resolution', () => {
  it('preserves logos and deletion markers when the incoming field is absent', () => {
    expect(mergeRoasterLogos(undefined, [logo])).toEqual([logo]);
    expect(mergeRoasterLogos(undefined, [deleted])).toEqual([deleted]);
  });

  it('compares logo versions independently of newer settings timestamps', () => {
    const stale = {
      roasterName: 'R',
      logoData: 'old-image',
      logoUpdatedAt: 10,
      updatedAt: 999,
    };
    for (const [incoming, existing] of [
      [[stale], [logo]],
      [[logo], [stale]],
    ]) {
      expect(mergeRoasterLogos(incoming, existing)[0]).toMatchObject({
        logoData: 'new-image',
        logoUpdatedAt: 20,
      });
    }
  });

  it('allows an explicit re-add after deletion and converges on simultaneous deletion', () => {
    const readded = { ...logo, logoUpdatedAt: 40 };
    expect(mergeRoasterLogos([readded], [deleted])[0].logoData).toBe(
      'new-image'
    );
    expect(mergeRoasterLogos([deleted], [readded])[0].logoData).toBe(
      'new-image'
    );
    const sameVersion = { ...logo, logoUpdatedAt: 30 };
    expect(
      mergeRoasterLogos([sameVersion], [deleted])[0].logoData
    ).toBeUndefined();
    expect(
      mergeRoasterLogos([deleted], [sameVersion])[0].logoData
    ).toBeUndefined();
  });
});
