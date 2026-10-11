import { describe, expect, it } from 'vitest';
import { buildRoasterRatingStats } from './utils';

describe('buildRoasterRatingStats', () => {
  it('averages rated beans equally, trims names and sorts by score then sample size', () => {
    expect(
      buildRoasterRatingStats([
        { roasterName: ' A ', averageRating: 5 },
        { roasterName: 'A', averageRating: 2 },
        { roasterName: 'A', averageRating: 0 },
        { roasterName: 'A', averageRating: NaN },
        { roasterName: 'B', averageRating: 3.5 },
        { roasterName: 'C', averageRating: 4 },
        { roasterName: ' ', averageRating: 5 },
      ])
    ).toEqual([
      { roasterName: 'C', averageRating: 4, beanCount: 1 },
      { roasterName: 'A', averageRating: 3.5, beanCount: 2 },
      { roasterName: 'B', averageRating: 3.5, beanCount: 1 },
    ]);
    expect(buildRoasterRatingStats([])).toEqual([]);
  });

  it('includes all rated beans rather than a truncated best/worst ranking', () => {
    const beans = Array.from({ length: 16 }, () => ({
      roasterName: 'A',
      averageRating: 5,
    }));
    beans.push({ roasterName: 'A', averageRating: 1 });
    expect(buildRoasterRatingStats(beans)).toEqual([
      { roasterName: 'A', averageRating: 81 / 17, beanCount: 17 },
    ]);
  });
});
