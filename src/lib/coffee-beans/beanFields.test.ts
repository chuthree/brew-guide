import { describe, expect, it } from 'vitest';
import {
  getComponentFieldValue,
  getComponentOriginDisplay,
  normalizeCoffeeBeanForFieldConfig,
  normalizeCoffeeBeanFieldUpdate,
  resolveBeanFieldConfig,
  type BeanFieldId,
} from './beanFields';
import type { CoffeeBean } from '@/types/app';
import type { AppSettings } from '@/lib/data/models';

const buildBean = (bean: Partial<CoffeeBean>): CoffeeBean => ({
  id: 'bean',
  timestamp: 1,
  name: 'Test Bean',
  ...bean,
});

const settingsWithEnabledFields = (
  enabledIds: BeanFieldId[]
): Pick<AppSettings, 'beanFieldConfig'> => ({
  beanFieldConfig: {
    version: 1,
    fields: enabledIds.map((id, index) => ({
      id,
      enabled: true,
      order: index,
    })),
  },
});

describe('bean field configuration', () => {
  it('keeps legacy origin/process/variety as the default compatible fields', () => {
    const config = resolveBeanFieldConfig();
    expect(
      config.fields.filter(field => field.enabled).map(field => field.id)
    ).toEqual(['origin', 'process', 'variety']);
    expect(
      config.fields.find(field => field.id === 'processingStation')
    ).toEqual({
      id: 'processingStation',
      enabled: false,
      order: 4,
    });
  });

  it('inherits the legacy estate toggle when no explicit config exists', () => {
    const config = resolveBeanFieldConfig({ showEstateField: true });
    expect(
      config.fields.filter(field => field.enabled).map(field => field.id)
    ).toEqual(['origin', 'estate', 'process', 'variety']);
  });

  it('moves disabled component fields into notes during import normalization', () => {
    const normalized = normalizeCoffeeBeanForFieldConfig(
      buildBean({
        blendComponents: [
          {
            origin: '埃塞俄比亚',
            country: '刚果',
            region: '刚果',
            estate: '博纳',
            processingStation: '沃卡',
            process: '水洗',
            variety: '74158',
            altitude: '2100m',
            batch: '1931',
          },
        ],
      }),
      settingsWithEnabledFields(['origin', 'process', 'variety'])
    );

    expect(normalized.blendComponents).toEqual([
      {
        origin: '埃塞俄比亚',
        process: '水洗',
        variety: '74158',
      },
    ]);
    expect(normalized.notes).toBe(
      '产国：刚果 / 产区：刚果 / 庄园：博纳 / 处理站：沃卡 / 海拔：2100m / 批次：1931'
    );
  });

  it('keeps estate structured when the user enables it', () => {
    const normalized = normalizeCoffeeBeanForFieldConfig(
      buildBean({
        blendComponents: [
          {
            origin: '埃塞俄比亚',
            estate: '博纳',
            process: '水洗',
          },
        ],
      }),
      settingsWithEnabledFields(['origin', 'estate', 'process'])
    );

    expect(normalized.blendComponents).toEqual([
      {
        origin: '埃塞俄比亚',
        estate: '博纳',
        process: '水洗',
      },
    ]);
    expect(normalized.notes).toBeUndefined();
  });

  it('keeps processing station structured only when explicitly enabled', () => {
    const normalized = normalizeCoffeeBeanForFieldConfig(
      buildBean({
        blendComponents: [
          {
            country: '埃塞俄比亚',
            estate: '博纳',
            processingStation: '沃卡',
            process: '水洗',
          },
        ],
      }),
      settingsWithEnabledFields([
        'country',
        'estate',
        'processingStation',
        'process',
      ])
    );

    expect(normalized.blendComponents).toEqual([
      {
        country: '埃塞俄比亚',
        estate: '博纳',
        processingStation: '沃卡',
        process: '水洗',
      },
    ]);
    expect(normalized.notes).toBeUndefined();
  });

  it('promotes explicitly labeled notes into enabled component fields', () => {
    const normalized = normalizeCoffeeBeanForFieldConfig(
      buildBean({
        blendComponents: [{ country: '哥伦比亚', process: '蜜处理' }],
        notes:
          '产国：哥伦比亚 / 产区：NARIÑO / 海拔：2200–2300 M.A.S.L / 处理法：蜜处理',
      }),
      settingsWithEnabledFields(['country', 'region', 'altitude', 'process'])
    );

    expect(normalized.blendComponents).toEqual([
      {
        country: '哥伦比亚',
        region: 'NARIÑO',
        altitude: '2200-2300m',
        process: '蜜处理',
      },
    ]);
    expect(normalized.notes).toBeUndefined();
  });

  it('uses component prefixes without guessing unprefixed multi-component notes', () => {
    const normalized = normalizeCoffeeBeanForFieldConfig(
      buildBean({
        blendComponents: [{ process: '水洗' }, { process: '日晒' }],
        notes: '成分1 产区：西达摩 / 产区：古吉',
      }),
      settingsWithEnabledFields(['region', 'process'])
    );

    expect(normalized.blendComponents).toEqual([
      { region: '西达摩', process: '水洗' },
      { process: '日晒' },
    ]);
    expect(normalized.notes).toBe('产区：古吉');
  });

  it('uses structured origin fields before legacy origin for display', () => {
    expect(
      getComponentOriginDisplay({
        origin: '埃塞俄比亚 西达摩 博纳',
        country: '埃塞俄比亚',
        region: '西达摩',
        estate: '博纳',
        processingStation: '沃卡',
      })
    ).toBe('埃塞俄比亚 · 西达摩 · 博纳 · 沃卡');
  });

  it('falls back to legacy origin when no structured origin fields exist', () => {
    expect(getComponentOriginDisplay({ origin: '埃塞俄比亚 西达摩' })).toBe(
      '埃塞俄比亚 西达摩'
    );
  });
});

describe('getComponentFieldValue', () => {
  it('stringifies non-string process values without throwing', () => {
    expect(
      getComponentFieldValue(
        { process: ['水洗', '日晒'] as unknown as string },
        'process'
      )
    ).toBe('水洗 / 日晒');
    expect(
      getComponentFieldValue({ process: 123 as unknown as string }, 'process')
    ).toBe('123');
    expect(
      getComponentFieldValue(
        { process: { name: '水洗' } as unknown as string },
        'process'
      )
    ).toBe('');
  });
});

describe('component list values and managed note round trips', () => {
  const varieties = ['SL28/34', 'Ruiru 11', 'Batian'];
  it('preserves explicit lists and trims/deduplicates without splitting cultivar slashes', () => {
    const result = normalizeCoffeeBeanForFieldConfig(
      buildBean({
        blendComponents: [
          { variety: [' SL28/34 ', 'Ruiru 11', 'Batian', 'Batian', ''] },
        ],
      })
    );
    expect(result.blendComponents).toEqual([{ variety: varieties }]);
    expect(getComponentFieldValue(result.blendComponents![0], 'variety')).toBe(
      'SL28/34 / Ruiru 11 / Batian'
    );
  });
  it('serializes disabled arrays reversibly in canonical labeled notes', () => {
    const disabled = normalizeCoffeeBeanForFieldConfig(
      buildBean({ blendComponents: [{ variety: varieties }] }),
      settingsWithEnabledFields(['process'])
    );
    expect(disabled.notes).toBe('品种：["SL28/34","Ruiru 11","Batian"]');
    const restored = normalizeCoffeeBeanForFieldConfig(disabled);
    expect(restored.blendComponents).toEqual([{ variety: varieties }]);
    expect(restored.notes).toBeUndefined();
  });
  it('keeps scoped component positions when all fields are disabled', () => {
    const original = buildBean({
      blendComponents: [
        { variety: varieties },
        { variety: ['A / B', 'Quoted "value"', 'C'] },
      ],
    });
    const disabled = normalizeCoffeeBeanForFieldConfig(
      original,
      settingsWithEnabledFields(['process'])
    );
    expect(disabled.blendComponents).toEqual([{}, {}]);
    expect(normalizeCoffeeBeanForFieldConfig(disabled).blendComponents).toEqual(
      original.blendComponents
    );
  });
  it('preserves legacy scalar strings and unrelated free remarks including internal slash/newline', () => {
    const original = buildBean({
      notes: '喜欢 A/B，今天\n很满意',
      blendComponents: [{ variety: 'SL28/34、Ruiru 11、Batian' }],
    });
    expect(normalizeCoffeeBeanForFieldConfig(original)).toEqual(original);
    const parsed = normalizeCoffeeBeanForFieldConfig(
      buildBean({ notes: '处理法：水洗/品种：SL28/34' })
    );
    expect(parsed.blendComponents).toEqual([
      { process: '水洗', variety: 'SL28/34' },
    ]);
  });
  it('retains conflicts and does not conflate array boundaries or cultivar slash', () => {
    const result = normalizeCoffeeBeanForFieldConfig(
      buildBean({
        blendComponents: [{ variety: ['AB', 'C'] }],
        notes: '品种：["A","BC"] / 品种：SL28/34 / 品种：SL2834',
      })
    );
    expect(result.notes).toBe(
      '品种：["A","BC"] / 品种：SL28/34 / 品种：SL2834'
    );
    expect(result.blendComponents![0].variety).toEqual(['AB', 'C']);
  });
  it('deduplicates repeated canonical array notes without changing values', () => {
    const result = normalizeCoffeeBeanForFieldConfig(
      buildBean({
        blendComponents: [{ variety: varieties }],
        notes: '品种：["SL28/34","Ruiru 11","Batian"]',
      }),
      settingsWithEnabledFields(['process'])
    );
    expect(result.notes).toBe('品种：["SL28/34","Ruiru 11","Batian"]');
  });
  it('keeps malformed JSON notes as legacy strings instead of interpreting nested data', () => {
    const result = normalizeCoffeeBeanForFieldConfig(
      buildBean({ notes: '品种：["SL28/34", {"unexpected":true}]' })
    );
    expect(result.blendComponents![0].variety).toBe(
      '["SL28/34", {"unexpected":true}]'
    );
  });
  it('does not reroute historical fields or notes on unrelated updates', () => {
    const original = buildBean({
      blendComponents: [{ estate: 'Old estate' }],
      notes: '品种：Old / 手写 A/B',
    });
    expect(
      normalizeCoffeeBeanFieldUpdate(original, { name: 'New name' })
    ).toEqual({ ...original, name: 'New name' });
  });
  it('replaces only explicitly supplied managed fields and retains other remarks/scopes', () => {
    const original = buildBean({
      blendComponents: [{ process: '水洗' }, { process: '日晒' }],
      notes: '成分1 品种：Old / 成分2 品种：Other / 海拔：2000m / 自由 A/B',
    });
    const result = normalizeCoffeeBeanFieldUpdate(
      original,
      {
        blendComponents: [
          { process: '水洗', variety: varieties },
          { process: '日晒' },
        ],
      },
      settingsWithEnabledFields(['process'])
    );
    expect(result.notes).toBe(
      '成分2 品种：Other / 海拔：2000m / 自由 A/B / 成分1 品种：["SL28/34","Ruiru 11","Batian"]'
    );
  });
  it('clears a managed disabled array without restoring stale note values', () => {
    const result = normalizeCoffeeBeanFieldUpdate(
      buildBean({ notes: '品种：["SL28/34","Batian"] / 保留备注' }),
      { blendComponents: [{ variety: [] }] },
      settingsWithEnabledFields(['process'])
    );
    expect(result.blendComponents).toBeUndefined();
    expect(result.notes).toBe('保留备注');
  });
  it('rejects reordering components with retained scoped notes instead of guessing ownership', () => {
    const original = buildBean({
      blendComponents: [{ process: '水洗' }, { process: '日晒' }],
      notes: '成分1 品种：["SL28/34"] / 成分2 品种：["Batian"]',
    });
    expect(() =>
      normalizeCoffeeBeanFieldUpdate(original, {
        blendComponents: [{ process: '日晒' }, { process: '水洗' }],
      })
    ).toThrow(/requires explicit notes/);
    expect(original.notes).toBe(
      '成分1 品种：["SL28/34"] / 成分2 品种：["Batian"]'
    );
  });
  it('rejects deleting or clearing a component while old scoped notes still refer to it', () => {
    const original = buildBean({
      blendComponents: [{ variety: 'A' }, { variety: 'B' }],
      notes: '成分2 庄园：X',
    });
    for (const blendComponents of [[], [{ variety: 'A' }]]) {
      try {
        normalizeCoffeeBeanFieldUpdate(original, { blendComponents });
        expect.fail('Expected ambiguous component replacement to fail');
      } catch (error) {
        expect(error).toMatchObject({ code: 'INVALID_ARGUMENT' });
      }
    }
  });
  it('allows deliberate component reordering when caller supplies the corresponding notes', () => {
    const original = buildBean({
      blendComponents: [{ process: '水洗' }, { process: '日晒' }],
      notes: '成分1 品种：["SL28/34"] / 成分2 品种：["Batian"]',
    });
    const result = normalizeCoffeeBeanFieldUpdate(original, {
      blendComponents: [{ process: '日晒' }, { process: '水洗' }],
      notes: '成分1 品种：["Batian"] / 成分2 品种：["SL28/34"]',
    });
    expect(result.blendComponents).toEqual([
      { process: '日晒', variety: ['Batian'] },
      { process: '水洗', variety: ['SL28/34'] },
    ]);
    expect(result.notes).toBeUndefined();
  });
  it('respects explicit user notes rather than filtering their conflicting values', () => {
    const result = normalizeCoffeeBeanFieldUpdate(
      buildBean({ notes: '品种：Old' }),
      { notes: '品种：User choice', blendComponents: [{ variety: varieties }] },
      settingsWithEnabledFields(['process'])
    );
    expect(result.notes).toBe(
      '品种：User choice / 品种：["SL28/34","Ruiru 11","Batian"]'
    );
  });
});
