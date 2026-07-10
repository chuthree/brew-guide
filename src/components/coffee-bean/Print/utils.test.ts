import { describe, expect, it } from 'vitest';
import { createInitialContent } from './utils';
import { getAvailablePrintFieldOrder } from './fields';
import type { EditableContent } from './types';
import type { CoffeeBean } from '@/types/app';
import type { AppSettings } from '@/lib/core/db';

describe('bean print content', () => {
  it('extracts structured origin fields independently', () => {
    const bean: CoffeeBean = {
      id: 'bean',
      timestamp: 1,
      name: '奇拉卡',
      blendComponents: [
        {
          origin: '埃塞俄比亚 西达摩 博纳',
          country: '埃塞俄比亚',
          region: '西达摩',
          estate: '博纳',
          process: '水洗',
        },
      ],
    };

    const content = createInitialContent(bean, {});

    expect(content.origin).toBe('埃塞俄比亚 西达摩 博纳');
    expect(content.country).toBe('埃塞俄比亚');
    expect(content.region).toBe('西达摩');
    expect(content.estate).toBe('博纳');
  });

  it('shows configured component fields and keeps fields with existing bean data', () => {
    const content: EditableContent = {
      name: '奇拉卡',
      roaster: '',
      origin: '',
      country: '埃塞俄比亚',
      region: '西达摩',
      estate: '',
      altitude: '',
      roastLevel: '',
      roastDate: '',
      packDate: '',
      process: '水洗',
      batch: '1931',
      variety: '',
      flavor: [],
      notes: '',
      weight: '',
      icon: '',
      iconSource: 'custom',
    };
    const settings: Pick<AppSettings, 'beanFieldConfig'> = {
      beanFieldConfig: {
        version: 1,
        fields: [
          { id: 'country', enabled: true, order: 0 },
          { id: 'process', enabled: true, order: 1 },
          { id: 'batch', enabled: false, order: 2 },
          { id: 'estate', enabled: false, order: 3 },
          { id: 'variety', enabled: false, order: 4 },
        ],
      },
    };

    const fields = getAvailablePrintFieldOrder('minimal', content, settings);

    expect(fields).toContain('country');
    expect(fields).toContain('process');
    expect(fields).toContain('batch');
    expect(fields).not.toContain('origin');
    expect(fields).not.toContain('estate');
    expect(fields).not.toContain('variety');
  });
});
