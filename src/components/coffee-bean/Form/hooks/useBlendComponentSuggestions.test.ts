import { describe, expect, it } from 'vitest';
import { autofillBlendComponentsFromName } from './useBlendComponentSuggestions';

const suggestions = {
  origins: ['埃塞俄比亚'],
  countries: ['埃塞俄比亚'],
  regions: [],
  estates: [],
  processingStations: [],
  altitudes: [],
  processes: ['水洗'],
  batches: [],
  varieties: ['瑰夏'],
};

describe('autofillBlendComponentsFromName', () => {
  it('does not write to disabled component fields', () => {
    const result = autofillBlendComponentsFromName(
      [{}],
      '埃塞俄比亚水洗瑰夏',
      suggestions,
      [],
      ['origin', 'process', 'variety']
    );

    expect(result.components[0]).toMatchObject({
      origin: '埃塞俄比亚',
      process: '水洗',
      variety: '瑰夏',
    });
    expect(result.components[0].country).toBeUndefined();
    expect(result.autofillComponents[0].country).toBe('');
  });

  it('writes to enabled component fields', () => {
    const result = autofillBlendComponentsFromName(
      [{}],
      '埃塞俄比亚水洗瑰夏',
      suggestions,
      [],
      ['country', 'process', 'variety']
    );

    expect(result.components[0]).toMatchObject({
      country: '埃塞俄比亚',
      process: '水洗',
      variety: '瑰夏',
    });
  });
});
