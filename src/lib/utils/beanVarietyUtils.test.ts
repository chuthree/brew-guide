import { describe, expect, it } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import {
  getBeanAltitudes,
  getBeanBatches,
  getBeanCountries,
  getBeanOriginSummaries,
  getBeanRegions,
} from './beanVarietyUtils';

const buildBean = (bean: Partial<CoffeeBean>): CoffeeBean => ({
  id: 'bean',
  timestamp: 1,
  name: 'Test Bean',
  capacity: '100',
  remaining: '100',
  beanState: 'roasted',
  ...bean,
});

describe('beanVarietyUtils structured bean fields', () => {
  it('keeps legacy origin separate from structured origin fields for stats', () => {
    const bean = buildBean({
      blendComponents: [
        {
          origin: '埃塞俄比亚 西达摩',
          country: '埃塞俄比亚',
          region: '西达摩',
          altitude: '2100m',
          batch: 'A12',
        },
      ],
    });

    expect(getBeanOriginSummaries(bean)).toEqual(['埃塞俄比亚 西达摩']);
    expect(getBeanCountries(bean)).toEqual(['埃塞俄比亚']);
    expect(getBeanRegions(bean)).toEqual(['西达摩']);
    expect(getBeanAltitudes(bean)).toEqual(['2100m']);
    expect(getBeanBatches(bean)).toEqual(['A12']);
  });
});
