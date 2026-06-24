import { describe, expect, it } from 'vitest';
import { shouldSkipEmptyReplace } from './safeReplace';

describe('shouldSkipEmptyReplace', () => {
  it('blocks empty replacements when local records still exist', () => {
    expect(shouldSkipEmptyReplace({ nextCount: 0, existingCount: 12 })).toBe(
      true
    );
  });

  it('allows explicit empty replacements', () => {
    expect(
      shouldSkipEmptyReplace({
        nextCount: 0,
        existingCount: 12,
        allowEmptyReplace: true,
      })
    ).toBe(false);
  });

  it('allows non-empty replacements and empty no-ops', () => {
    expect(shouldSkipEmptyReplace({ nextCount: 3, existingCount: 12 })).toBe(
      false
    );
    expect(shouldSkipEmptyReplace({ nextCount: 0, existingCount: 0 })).toBe(
      false
    );
  });
});
