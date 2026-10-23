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

it('does not turn varieties detected in a single-origin name into blend rows', () => {
  const result = autofillBlendComponentsFromName(
    [{ origin: 'Ethiopia', percentage: 100 }],
    'SL28/34 74110 74112',
    { ...suggestions, varieties: ['SL28/34', '74110', '74112'] },
    [],
    ['variety']
  );
  expect(result.components).toHaveLength(1);
  expect(result.components[0]).toMatchObject({
    origin: 'Ethiopia',
    percentage: 100,
    variety: ['SL28/34', '74110', '74112'],
  });
});

it('keeps a populated variety array without creating extra rows on name changes', () => {
  const components = [
    { origin: 'Ethiopia', variety: ['SL28/34', '74110', '74112'] },
  ];
  const result = autofillBlendComponentsFromName(
    components,
    'SL28/34 74110 74112',
    { ...suggestions, varieties: ['SL28/34', '74110', '74112'] },
    [],
    ['variety']
  );
  expect(result.components).toEqual(components);
});
