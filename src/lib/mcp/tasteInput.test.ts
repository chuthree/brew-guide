import { describe, expect, it } from 'vitest';
import { applyTastePatch } from './tasteInput';
import { migrateTasteRatings } from '@/lib/stores/settingsStore';

describe('explicit taste edits', () => {
  it('preserves historical scores on configuration changes and removes only requested scores', () => {
    const original = { old: 5, acidity: 3, another: 4 };
    expect(migrateTasteRatings(original, [])).toEqual(original);
    expect(applyTastePatch(original, {}, ['acidity'])).toEqual(original);
    expect(
      applyTastePatch(original, { old: null, acidity: 0 }, ['acidity'])
    ).toEqual({ acidity: 0, another: 4 });
    expect(original).toEqual({ old: 5, acidity: 3, another: 4 });
    expect(applyTastePatch(original, { old: 2 }, [])).toEqual({
      ...original,
      old: 2,
    });
  });

  it('rejects unknown IDs, out-of-range scores and prototype keys without mutating input', () => {
    const original = { old: 5 };
    for (const patch of [
      { missing: null },
      { old: 6 },
      JSON.parse('{"__proto__":null}'),
    ]) {
      expect(() => applyTastePatch(original, patch, [])).toThrow();
      expect(original).toEqual({ old: 5 });
    }
  });
});
