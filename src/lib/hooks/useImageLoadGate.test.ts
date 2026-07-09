import { describe, expect, it } from 'vitest';
import { getNextImageLoadState } from './useImageLoadGate';

describe('getNextImageLoadState', () => {
  it('loads images while they are near the viewport', () => {
    expect(getNextImageLoadState(false, true)).toBe(true);
  });

  it('keeps loaded images mounted when they move away from the viewport', () => {
    expect(getNextImageLoadState(true, false)).toBe(true);
  });

  it('does not load images before they are near the viewport', () => {
    expect(getNextImageLoadState(false, false)).toBe(false);
  });
});
