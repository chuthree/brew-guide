import { describe, expect, it } from 'vitest';
import { buildBlendComponentDisplayRows } from './BlendComponentsSection';

describe('buildBlendComponentDisplayRows', () => {
  it('groups multiple blend components by field order', () => {
    const rows = buildBlendComponentDisplayRows([
      {
        country: '埃塞俄比亚',
        estate: '班驰玛吉',
        processingStation: '沃卡',
        process: '水洗',
        variety: '74158',
        percentage: 60,
      },
      {
        country: '肯尼亚',
        estate: '奇安布',
        process: '日晒',
        variety: 'SL28',
        percentage: 40,
      },
    ]);

    expect(
      rows.map(row => ({
        field: row.field,
        label: row.label,
        values: row.entries.map(entry => entry.value),
      }))
    ).toEqual([
      {
        field: 'country',
        label: '产国',
        values: ['埃塞俄比亚', '肯尼亚'],
      },
      {
        field: 'estate',
        label: '庄园',
        values: ['班驰玛吉', '奇安布'],
      },
      { field: 'processingStation', label: '处理站', values: ['沃卡'] },
      { field: 'process', label: '处理法', values: ['水洗', '日晒'] },
      { field: 'variety', label: '品种', values: ['74158', 'SL28'] },
      { field: 'percentage', label: '比例', values: ['60%', '40%'] },
    ]);
  });

  it('keeps enabled origin even when structured origin data exists', () => {
    const rows = buildBlendComponentDisplayRows([
      { origin: '哥伦比亚 蕙兰', process: '水洗' },
      {
        origin: '旧产地',
        country: '埃塞俄比亚',
        region: '西达摩',
        process: '日晒',
      },
    ]);

    expect(rows.find(row => row.field === 'origin')?.entries).toEqual([
      { componentIndex: 0, value: '哥伦比亚 蕙兰' },
      { componentIndex: 1, value: '旧产地' },
    ]);
  });
});
