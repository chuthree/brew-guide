import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasLocalStorageKey } from './localStorageKeys';

describe('hasLocalStorageKey', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('checks key presence without reading large values', () => {
    const getItem = vi.fn(() => {
      throw new Error('value should not be read');
    });

    vi.stubGlobal('window', {
      localStorage: {
        length: 2,
        key: (index: number) => ['coffeeBeans', 'settings'][index] || null,
        getItem,
      },
    });

    expect(hasLocalStorageKey('coffeeBeans')).toBe(true);
    expect(hasLocalStorageKey('missing')).toBe(false);
    expect(getItem).not.toHaveBeenCalled();
  });
});
