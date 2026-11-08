import { describe, expect, it } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { BeanFieldId } from './beanFields';
import {
  normalizeImportedCoffeeBeanCreate,
  normalizeImportedCoffeeBeanFields as fields,
  normalizeImportedCoffeeBeanPatch as patch,
  normalizeImportedRoastLevel,
} from './beanImport';

const settings = (...ids: BeanFieldId[]) => ({
  beanFieldConfig: {
    version: 1 as const,
    fields: ids.map((id, order) => ({ id, enabled: true, order })),
  },
});
const create = (
  input: Partial<CoffeeBean>,
  config?: ReturnType<typeof settings>
) => normalizeImportedCoffeeBeanCreate(input, config);
const bean = (value: Partial<CoffeeBean>): CoffeeBean => ({
  id: 'bean',
  name: 'Coffee',
  timestamp: 1,
  ...value,
});

describe('shared AI bean import normalization', () => {
  it('uses explicit country/region as legacy origin without redundant notes', () => {
    expect(
      create({
        blendComponents: [
          { country: '埃塞俄比亚', region: '古吉', process: '水洗' },
        ],
      })
    ).toMatchObject({
      blendComponents: [{ origin: '埃塞俄比亚 · 古吉', process: '水洗' }],
      notes: undefined,
    });
  });

  it('keeps explicitly enabled structured geography and unmatched existing origin', () => {
    const component = {
      origin: '包装专名',
      country: '埃塞俄比亚',
      region: '古吉',
    };
    expect(
      create(
        { blendComponents: [component] },
        settings('origin', 'country', 'region')
      ).blendComponents
    ).toEqual([component]);
    expect(create({ blendComponents: [component] })).toMatchObject({
      blendComponents: [{ origin: '包装专名' }],
      notes: '产国：埃塞俄比亚 / 产区：古吉',
    });
  });

  it('preserves explicit array boundaries, cultivar slashes, percentages and component pairing', () => {
    const result = create({
      blendComponents: [
        {
          percentage: 40,
          country: [' A/B ', 'A/B'],
          region: [' X ', 'Y'],
          process: ['水洗'],
          variety: ['SL28/34'],
        },
        { percentage: 30, country: 'B', process: '日晒' },
        { percentage: 30, country: 'C', process: '蜜处理' },
      ],
    });
    expect(result.blendComponents).toEqual([
      {
        percentage: 40,
        origin: ['A/B', 'X', 'Y'],
        process: ['水洗'],
        variety: ['SL28/34'],
      },
      { percentage: 30, origin: 'B', process: '日晒' },
      { percentage: 30, origin: 'C', process: '蜜处理' },
    ]);
  });

  it('does not deduplicate separate equal components or discard percentage-only entries', () => {
    const blendComponents = [
      { percentage: 20 },
      { percentage: 40, variety: ['SL28/34'] },
      { percentage: 40, variety: ['SL28/34'] },
    ];
    expect(create({ blendComponents }).blendComponents).toEqual(
      blendComponents
    );
  });

  it('removes only exact origin duplicates and retains unmatched regional information', () => {
    expect(
      create({
        blendComponents: [
          { origin: 'Kenya', country: 'Kenya', region: 'Nyeri' },
        ],
      })
    ).toMatchObject({
      blendComponents: [{ origin: 'Kenya' }],
      notes: '产区：Nyeri',
    });
    expect(
      create({
        blendComponents: [
          { origin: 'Kenya · Nyeri', country: 'Kenya', region: 'Nyeri' },
        ],
      }).notes
    ).toBeUndefined();
  });

  it.each([
    ['极浅烘', '极浅烘焙'],
    ['浅烘焙', '浅度烘焙'],
    ['Light-Medium Roast', '中浅烘焙'],
    ['中烘焙', '中度烘焙'],
    ['Medium Dark', '中深烘焙'],
    ['深烘焙', '深度烘焙'],
    ['medium roast', '中度烘焙'],
    ['unknown', ''],
    ['City', ''],
    [null, ''],
  ])('normalizes stated roast %s', (value, expected) => {
    expect(normalizeImportedRoastLevel(value)).toBe(expected);
  });

  it('trims/deduplicates flavors without splitting slashes or changing original values', () => {
    expect(
      fields({ flavor: [' 柑橘 ', '柑橘', 'A/B', 'a/b', ''] }).flavor
    ).toEqual(['柑橘', 'A/B']);
    expect(
      fields({ flavor: null } as unknown as Partial<CoffeeBean>).flavor
    ).toEqual([]);
    expect(
      create({ notes: '风味：["Apple","Peach"," Apple "]' })
    ).toMatchObject({ flavor: ['Apple', 'Peach'], notes: undefined });
  });

  it('retains an unsupported roast description without overwriting the existing roast or notes', () => {
    expect(create({ roastLevel: 'City' }).roastLevel).toBeUndefined();
    expect(create({ roastLevel: 'City' }).notes).toBe('烘焙度：City');
    const previous = bean({ roastLevel: '中度烘焙', notes: '手写 A/B' });
    expect(patch(previous, { roastLevel: 'City' })).toMatchObject({
      roastLevel: '中度烘焙',
      notes: '手写 A/B / 烘焙度：City',
    });
    expect(patch(previous, { roastLevel: '' })).toMatchObject({
      roastLevel: '',
      notes: '手写 A/B',
    });
    expect(patch(previous, { roastLevel: '未知' })).toMatchObject({
      roastLevel: '中度烘焙',
      notes: '手写 A/B',
    });
    expect(create({ roastLevel: 'City', notes: '烘焙度：City' }).notes).toBe(
      '烘焙度：City'
    );
  });

  it('does not let automatic roast notes bypass component guards or revive cleared fields', () => {
    const previous = bean({
      blendComponents: [{ origin: 'A' }, { origin: 'B' }],
      notes: '成分1 庄园：X',
    });
    expect(() =>
      patch(previous, {
        roastLevel: 'City',
        blendComponents: [{ origin: 'B' }, { origin: 'A' }],
      })
    ).toThrow(/requires explicit notes/);
    const cleared = patch(
      bean({ notes: '品种：Old' }),
      { roastLevel: 'City', blendComponents: [{ variety: [] }] },
      settings('process')
    );
    expect(cleared.blendComponents).toBeUndefined();
    expect(cleared.notes).toBe('烘焙度：City');
  });

  it('restores precise labeled notes to fields and preserves real supplements', () => {
    const result = create({
      notes:
        '烘焙商：DUFFY / 烘焙度：深烘焙 / 风味：巧克力、焦糖 / 产国：巴西 / 处理法：日晒 / 批次：A1 / 生豆商：裂豆师',
    });
    expect(result).toMatchObject({
      roaster: 'DUFFY',
      roastLevel: '深度烘焙',
      flavor: ['巧克力', '焦糖'],
      blendComponents: [{ origin: '巴西', process: '日晒' }],
    });
    expect(result.notes).toBe('生豆商：裂豆师 / 批次：A1');
  });

  it('retains free notes, exact field conflicts and slash distinctions', () => {
    const result = create({
      roaster: 'A',
      notes: '烘焙商：B / 产地：AB / 品种：SL2834 / 手写 A/B，今天\n很满意',
      blendComponents: [{ origin: 'A/B', variety: 'SL28/34' }],
    });
    expect(result.notes).toBe(
      '烘焙商：B / 产地：AB / 品种：SL2834 / 手写 A/B，今天\n很满意'
    );
    expect(create({ notes: '产地 真不错' }).notes).toBe('产地 真不错');
  });

  it('drops only exact missing metadata and never derives origin from contact addresses', () => {
    const result = create({
      notes: '烘焙日期：未标注 / 海拔：未知 / 联系地址：Arusha-Tanzania',
    });
    expect(result.blendComponents).toBeUndefined();
    expect(result.notes).toBe('联系地址：Arusha-Tanzania');
    expect(create({ notes: '我不喜欢“未知”这个名字' }).notes).toBe(
      '我不喜欢“未知”这个名字'
    );
    expect(
      create({ notes: null } as unknown as Partial<CoffeeBean>).notes
    ).toBeUndefined();
    expect(
      create({
        blendComponents: [{ country: '未知', variety: ['未知', 'SL28/34'] }],
      }).blendComponents
    ).toEqual([{ variety: ['SL28/34'] }]);
    expect(fields({ notes: 'constructor：x' }).notes).toBe('constructor：x');
  });

  it('preserves unrelated updates and historical fields after settings change', () => {
    const previous = bean({
      roastLevel: '旧烘焙度',
      blendComponents: [{ estate: '庄园', country: 'Kenya' }],
      notes: '品种：Old / 手写 A/B',
    });
    expect(patch(previous, { name: 'New' })).toEqual({
      ...previous,
      name: 'New',
    });
    expect(fields({ name: 'New' })).not.toHaveProperty('notes');
  });

  it('routes newly supplied labeled notes without overwriting conflicting existing fields', () => {
    const previous = bean({
      roaster: 'A',
      blendComponents: [{ country: 'Kenya', process: '水洗' }],
    });
    const result = patch(previous, { notes: '烘焙商：B / 品种：SL28/34' });
    expect(result.roaster).toBe('A');
    expect(result.notes).toBe('烘焙商：B');
    expect(result.blendComponents).toEqual([
      { country: 'Kenya', process: '水洗', variety: 'SL28/34' },
    ]);
  });

  it('fills previously empty fields from exact labels but honors explicit clears', () => {
    const previous = bean({ roastLevel: '', flavor: [], roastDate: '' });
    const notes = '烘焙度：深烘焙 / 风味：巧克力 / 烘焙日期：2026-11-08';
    expect(patch(previous, { notes })).toMatchObject({
      roastLevel: '深度烘焙',
      flavor: ['巧克力'],
      roastDate: '2026-11-08',
      notes: '',
    });
    expect(
      patch(previous, { notes, roastLevel: '', flavor: [], roastDate: '' })
    ).toMatchObject({ roastLevel: '', flavor: [], roastDate: '', notes });
  });

  it('validates directly imported dates without guessing missing parts', () => {
    expect(fields({ roastDate: '2026-02-30', purchaseDate: '11-08' })).toEqual({
      roastDate: '',
      purchaseDate: '',
    });
    expect(fields({ roastDate: ' 2026-11-08 ', purchaseDate: '' })).toEqual({
      roastDate: '2026-11-08',
      purchaseDate: '',
    });
    expect(
      fields({ roastDate: null } as unknown as Partial<CoffeeBean>).roastDate
    ).toBe('');
    expect(fields({ name: 'Coffee' })).not.toHaveProperty('roastDate');
    const invalid = create({
      roastDate: '2026-02-30',
      purchaseDate: '11-08',
      beanType: 'unknown',
      roastLevel: '未知',
    } as unknown as Partial<CoffeeBean>);
    expect(invalid.roastDate).toBeUndefined();
    expect(invalid.purchaseDate).toBeUndefined();
    expect(invalid.beanType).toBeUndefined();
    expect(invalid.roastLevel).toBeUndefined();
  });

  it('deduplicates accent variants without conflating punctuation in field values', () => {
    const result = create(
      {
        blendComponents: [{ region: 'NARIÑO', variety: 'SL28/34' }],
        notes: '产区：Narino / 品种：SL2834',
      },
      settings('region', 'variety')
    );
    expect(result.notes).toBe('品种：SL2834');
    expect(result.blendComponents).toEqual([
      { region: 'NARIÑO', variety: 'SL28/34' },
    ]);
  });

  it('preserves explicit clears and removes stale managed notes', () => {
    const previous = bean({
      blendComponents: [{ process: '水洗' }],
      notes: '品种：["Old"] / 保留备注',
    });
    const result = patch(
      previous,
      { blendComponents: [{ process: '水洗', variety: [] }] },
      settings('process')
    );
    expect(result.notes).toBe('保留备注');
    expect(result.blendComponents).toEqual([{ process: '水洗' }]);
    expect(
      patch(previous, { notes: '', flavor: [], roastLevel: '' })
    ).toMatchObject({ notes: '', flavor: [], roastLevel: '' });
    expect(
      patch(bean({}), { blendComponents: [{ origin: '', country: 'Kenya' }] })
        .blendComponents
    ).toBeUndefined();
    expect(
      patch(bean({}), { blendComponents: [{ origin: '', country: 'Kenya' }] })
        .notes
    ).toBe('产国：Kenya');
  });

  it('retains scoped-note reorder protection and accepts an explicit remap', () => {
    const previous = bean({
      blendComponents: [{ origin: 'A' }, { origin: 'B' }],
      notes: '成分1 庄园：X / 成分2 庄园：Y',
    });
    expect(() =>
      patch(previous, { blendComponents: [{ origin: 'B' }, { origin: 'A' }] })
    ).toThrow(/requires explicit notes/);
    const result = patch(previous, {
      blendComponents: [{ origin: 'B' }, { origin: 'A' }],
      notes: '成分1 庄园：Y / 成分2 庄园：X',
    });
    expect(result.notes).toBe('成分1 庄园：Y / 成分2 庄园：X');
    expect(result.blendComponents).toEqual([{ origin: 'B' }, { origin: 'A' }]);
    expect(() =>
      patch(
        { ...previous, notes: '成分1 庄园 X' },
        { blendComponents: [{ origin: 'B' }, { origin: 'A' }] }
      )
    ).toThrow(/requires explicit notes/);
  });

  it('does not delete unlabeled personal prose when replacing a component field', () => {
    const previous = bean({
      blendComponents: [{ origin: 'Kenya' }],
      notes: '产地 真不错 / 不要丢掉',
    });
    const result = patch(previous, {
      blendComponents: [{ origin: 'Ethiopia' }],
    });
    expect(result.blendComponents).toEqual([{ origin: 'Ethiopia' }]);
    expect(result.notes).toBe(previous.notes);
  });

  it('is idempotent for canonical create input and leaves its input untouched', () => {
    const input = {
      blendComponents: [{ country: 'Kenya', process: '水洗' }],
      notes: '批次：A1',
      roastLevel: '浅烘',
      flavor: ['柑橘', '柑橘'],
    };
    const original = structuredClone(input);
    const normalized = create(input);
    expect(create(normalized)).toEqual(normalized);
    expect(input).toEqual(original);
  });
});
