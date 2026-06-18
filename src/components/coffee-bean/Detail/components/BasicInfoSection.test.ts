import { describe, expect, it } from 'vitest';
import { shouldRenderStaticDateField } from './BasicInfoSection';

describe('BasicInfoSection', () => {
  it('renders date fields as static text when read-only', () => {
    expect(shouldRenderStaticDateField(true)).toBe(true);
    expect(shouldRenderStaticDateField(false)).toBe(false);
  });
});
