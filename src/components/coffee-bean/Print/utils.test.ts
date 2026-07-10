import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialContent, shouldShowWebImageSaveSuccess } from './utils';
import { getAvailablePrintFieldOrder } from './fields';
import type { EditableContent } from './types';
import type { CoffeeBean } from '@/types/app';
import type { AppSettings } from '@/lib/core/db';

afterEach(() => {
  vi.unstubAllGlobals();
});

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

describe('web image save feedback', () => {
  it('stays silent when iOS PWA hands saving to the share sheet', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
      platform: 'iPhone',
      maxTouchPoints: 5,
      standalone: true,
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: true }),
    });

    expect(shouldShowWebImageSaveSuccess()).toBe(false);
  });

  it('keeps success feedback for regular web downloads', () => {
    vi.stubGlobal('navigator', {
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      standalone: false,
    });
    vi.stubGlobal('window', {
      matchMedia: () => ({ matches: false }),
    });

    expect(shouldShowWebImageSaveSuccess()).toBe(true);
  });
});
