import { describe, expect, it } from 'vitest';
import { ratingSteps, validateRatingInput } from './ratings';

describe('UI rating rules', () => {
  it('keeps bean, note overall and taste precision distinct', () => {
    expect(ratingSteps()).toEqual({ bean: 0.5, overall: 0.5, taste: 1 });
    expect(
      ratingSteps({ beanRatingTenthStep: true, flavorRatingHalfStep: true })
    ).toEqual({ bean: 0.1, overall: 0.5, taste: 0.5 });
    expect(ratingSteps({ flavorRatingTenthStep: true })).toEqual({
      bean: 0.5,
      overall: 0.1,
      taste: 0.1,
    });
  });
  it('validates explicit patches only, including all tenth-step boundaries', () => {
    for (let i = 0; i <= 50; i++)
      validateRatingInput(
        { overallRating: i / 10, rating: i / 10, taste: { acidity: i / 10 } },
        { beanRatingTenthStep: true, flavorRatingTenthStep: true }
      );
    for (const value of [NaN, Infinity, -0.1, 5.1, 4.31, '4', null])
      expect(() => validateRatingInput({ rating: value })).toThrow();
    expect(() => validateRatingInput({ taste: { acidity: 4.5 } })).toThrow(
      'steps of 1'
    );
    expect(() =>
      validateRatingInput(
        { taste: { acidity: 4.5 } },
        { flavorRatingHalfStep: true }
      )
    ).not.toThrow();
    expect(() =>
      validateRatingInput({ taste: { historical: null } })
    ).not.toThrow();
    expect(() =>
      validateRatingInput({ notes: 'preserve historical scores' })
    ).not.toThrow();
  });
});
