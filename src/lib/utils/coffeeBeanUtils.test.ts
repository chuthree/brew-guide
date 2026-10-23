import { describe, expect, it } from 'vitest';
import {
  prepareCoffeeBeanRoasterFieldsForFormDraft,
  normalizeDelimitedTextList,
  updateBlendComponentsDelimitedField,
} from './coffeeBeanUtils';

describe('prepareCoffeeBeanRoasterFieldsForFormDraft', () => {
  it('保留与烘焙商同名的续购咖啡豆名称', () => {
    expect(
      prepareCoffeeBeanRoasterFieldsForFormDraft(
        { roaster: '111', name: '111 #2' },
        { roasterFieldEnabled: true }
      )
    ).toEqual({ roaster: '111', name: '111 #2' });
  });

  it('仍会移除旧版组合名称中的重复烘焙商前缀', () => {
    expect(
      prepareCoffeeBeanRoasterFieldsForFormDraft(
        { roaster: '111', name: '111 Ethiopia' },
        { roasterFieldEnabled: true }
      )
    ).toEqual({ roaster: '111', name: 'Ethiopia' });
  });
});

describe('component multi-value fields', () => {
  it('preserves explicit array entries including slashes and commas', () => {
    expect(
      normalizeDelimitedTextList(['SL28/34', '74110', '74112', 'A, B'])
    ).toEqual(['SL28/34', '74110', '74112', 'A, B']);
  });
  it('stores three varieties in one origin component without changing blend ratios', () => {
    const components = [{ origin: 'Ethiopia', percentage: 100 }];
    expect(
      updateBlendComponentsDelimitedField(
        components,
        0,
        'variety',
        'SL28/34、74110、74112'
      )
    ).toEqual([
      {
        origin: 'Ethiopia',
        percentage: 100,
        variety: ['SL28/34', '74110', '74112'],
      },
    ]);
    expect(components).toEqual([{ origin: 'Ethiopia', percentage: 100 }]);
  });
  it('does not overwrite another blend component when entering multiple values', () => {
    const components = [
      { origin: 'Ethiopia', percentage: 60 },
      { origin: 'Colombia', percentage: 40, variety: 'Caturra' },
    ];
    const next = updateBlendComponentsDelimitedField(
      components,
      0,
      'variety',
      '74110,74112'
    );
    expect(next).toHaveLength(2);
    expect(next[1]).toEqual(components[1]);
    expect(next[0].variety).toEqual(['74110', '74112']);
  });
});
