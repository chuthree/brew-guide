import { describe, expect, it } from 'vitest';
import {
  editMethodParams,
  measuredMethodParams,
  type MethodEditingValues,
} from './methodParamEditing';

const values: MethodEditingValues = {
  coffee: '18',
  water: '40',
  time: '31',
  grindSize: '',
  temp: '',
  ratio: '',
};
const actual = () =>
  measuredMethodParams({
    coffee: '18g',
    extractionTime: 31,
    liquidWeight: '40g',
  });

describe('measured note parameter editing', () => {
  it('keeps a grind-only edit independent of preset 25s/36g/93°C values', () => {
    const preset = measuredMethodParams({
      coffee: '18g',
      extractionTime: 25,
      liquidWeight: '36g',
      temp: '93°C',
      grindSize: '意式',
    });
    const measured = actual();
    const result = editMethodParams(
      measured,
      'grindSize',
      { ...values, grindSize: '8' },
      true
    );
    expect(result).toEqual({ ...measured, grindSize: '8' });
    expect(result.extractionTime).not.toBe(preset.extractionTime);
    expect(result.liquidWeight).not.toBe(preset.liquidWeight);
    expect(result.water).toBe('');
    expect(result.temp).toBe('');
  });
  it('changes liquid yield only, never the input-water field', () => {
    expect(
      editMethodParams(actual(), 'water', { ...values, water: '42' }, true)
    ).toEqual({ ...actual(), liquidWeight: '42g' });
  });
  it('clears legacy yield without reviving its water alias', () => {
    const legacy = measuredMethodParams({ coffee: '18g', water: '36g' });
    const result = editMethodParams(
      legacy,
      'water',
      { ...values, water: '' },
      true
    );
    expect(result.liquidWeight).toBeUndefined();
    expect(result.water).toBe('');
    expect(
      editMethodParams(legacy, 'water', { ...values, water: '40' }, true)
    ).toMatchObject({ water: '', liquidWeight: '40g' });
  });

  it('clears extraction time without recovering recipe defaults or stage time', () => {
    const current = {
      ...actual(),
      stages: [{ label: '萃取', detail: '', duration: 31 }],
    };
    const result = editMethodParams(
      current,
      'time',
      { ...values, time: '' },
      true
    );
    expect(result.extractionTime).toBeUndefined();
    expect(result.stages[0].duration).toBeUndefined();
    expect(result.liquidWeight).toBe('40g');
    expect(result.temp).toBe('');
  });
  it('preserves successive edits rather than resetting from the recipe', () => {
    const first = editMethodParams(
      actual(),
      'grindSize',
      { ...values, grindSize: '8' },
      true
    );
    const second = editMethodParams(
      first,
      'water',
      { ...values, water: '42', grindSize: '8' },
      true
    );
    expect(second).toMatchObject({
      grindSize: '8',
      extractionTime: 31,
      liquidWeight: '42g',
      water: '',
      temp: '',
    });
  });
  it('initializes empty and coffee-only historical measurements without defaults', () => {
    expect(measuredMethodParams()).toEqual({
      coffee: '',
      water: '',
      ratio: '',
      grindSize: '',
      temp: '',
      stages: [],
    });
    expect(measuredMethodParams({ coffee: '18g' })).toEqual({
      coffee: '18g',
      water: '',
      ratio: '',
      grindSize: '',
      temp: '',
      stages: [],
    });
  });
  it('keeps intentional pour-over input water editing and ratio calculation', () => {
    expect(
      editMethodParams(
        measuredMethodParams(),
        'water',
        { ...values, water: '270' },
        false
      ).water
    ).toBe('270g');
    expect(
      editMethodParams(
        measuredMethodParams({ coffee: '18g' }),
        'ratio',
        { ...values, ratio: '15', water: '270' },
        false
      )
    ).toMatchObject({ ratio: '1:15', water: '270g' });
  });
});
