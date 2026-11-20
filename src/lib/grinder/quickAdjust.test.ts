import { describe, expect, it } from 'vitest';
import {
  configureGrinderScale,
  getConfiguredGrinderScale,
  getGrinderScale,
  getScaleAt,
  isMajorScaleMark,
  normalizeScaleInput,
} from './quickAdjust';

describe('grinder quick adjustment', () => {
  it.each([
    ['10', -1, '9'],
    ['009', 1, '010'],
    ['8.9', 1, '9.0'],
    ['0.29', 1, '0.30'],
    ['1.9.9', 1, '2.0.0'],
    ['1.02.9.9', 1, '1.03.0.0'],
    ['9007199254740992.9', 1, '9007199254740993.0'],
  ])(
    'steps from %s by %i while retaining the format',
    (input, offset, expected) => {
      const scale = getGrinderScale(input);
      expect(scale && getScaleAt(scale, offset)).toBe(expected);
    }
  );

  it('uses the next example as the step and stops at range boundaries', () => {
    const configured = configureGrinderScale({
      value: '1.0.2',
      next: '1.0.4',
      min: '1.0.0',
      max: '1.0.6',
    });
    expect(configured).toHaveProperty('settings', {
      format: '0.0.0',
      step: '0.0.2',
      min: '1.0.0',
      max: '1.0.6',
    });
    if ('errors' in configured) throw new Error('Expected a valid scale');
    const reopened = getGrinderScale('1.0.4', configured.settings);
    expect(reopened && getScaleAt(reopened, -2)).toBe('1.0.0');
    expect(reopened && getScaleAt(reopened, -3)).toBeNull();
    expect(reopened && getScaleAt(reopened, 1)).toBe('1.0.6');
    expect(reopened && getScaleAt(reopened, 2)).toBeNull();
  });

  it('accepts a default setup and limits an unconfigured wheel at zero', () => {
    const configured = configureGrinderScale({
      value: '0.1',
      next: '',
      min: '',
      max: '',
    });
    expect(configured).toHaveProperty('settings', { format: '0.0' });
    if ('errors' in configured) throw new Error('Expected a valid scale');
    expect(getScaleAt(configured.scale, -1)).toBe('0.0');
    expect(getScaleAt(configured.scale, -2)).toBeNull();
  });

  it.each([
    {
      value: '36',
      next: '36.1',
      min: '',
      max: '',
      offset: 1,
      expected: '36.1',
    },
    {
      value: '35.2',
      next: '35.3',
      min: '',
      max: '100',
      offset: 648,
      expected: '100.0',
    },
    {
      value: '36.1',
      next: '37',
      min: '35',
      max: '',
      offset: -1,
      expected: '35.2',
    },
    {
      value: '36',
      next: '',
      min: '',
      max: '37.50',
      offset: 1,
      expected: '37.00',
    },
  ])(
    'configures mixed numeric precision for a start of $value and next of $next',
    ({ offset, expected, ...form }) => {
      const configured = configureGrinderScale(form);
      if ('errors' in configured)
        throw new Error(JSON.stringify(configured.errors));
      expect(getScaleAt(configured.scale, offset)).toBe(expected);
      const reopened = getGrinderScale(form.value, configured.settings);
      expect(reopened && getScaleAt(reopened, offset)).toBe(expected);
      if (form.max) {
        expect(reopened && getScaleAt(reopened, offset + 1)).toBeNull();
      }
    }
  );

  it.each([
    [{ value: '' }, 'value', '请输入起始刻度'],
    [{ next: '36' }, 'next', '下一格必须大于起始刻度'],
    [{ max: 'abc' }, 'max', '请输入整数或小数'],
    [{ min: '1.0.0' }, 'min', '请输入整数或小数'],
    [{ min: '37', max: '35.5' }, 'max', '最大刻度不能小于最小刻度'],
    [{ min: '36.1' }, 'value', '起始刻度不能小于最小刻度'],
    [{ max: '35.9' }, 'value', '起始刻度不能大于最大刻度'],
    [
      { value: '1.0.2', next: '1.02' },
      'next',
      '请输入与起始刻度相同的分段格式，如 0.0.0',
    ],
  ])('reports invalid input in the %j field', (overrides, field, error) => {
    expect(
      configureGrinderScale({
        value: '36',
        next: '',
        min: '',
        max: '',
        ...overrides,
      })
    ).toEqual({ errors: { [field]: error } });
  });

  it('keeps the configured format authoritative', () => {
    expect(getGrinderScale('中细')).toBeNull();
    expect(getGrinderScale('4.6.1', { min: '0.0', max: '10.0' })).toBeNull();
    const recovered = getGrinderScale('12', { min: '0.0', max: '10.0' });
    expect(recovered && getScaleAt(recovered, 0)).toBe('10.0');
    expect(recovered && getScaleAt(recovered, 1)).toBeNull();
  });

  it.each([
    ['5', '5.0'],
    ['4.6.1', null],
    ['4.61', null],
    ['12.0', '10.0'],
    ['-1.0', '0.0'],
    ['中细', null],
  ])('normalizes typed %s against the saved range', (input, expected) => {
    const configured = getConfiguredGrinderScale({ min: '0.0', max: '10.0' });
    expect(normalizeScaleInput(input, configured)).toBe(expected);
  });

  it('fills missing digits and segments in a saved format without an upper bound', () => {
    const configured = getConfiguredGrinderScale({ format: '0.0.00' });
    expect(normalizeScaleInput('1.2', configured)).toBe('1.2.00');
    expect(normalizeScaleInput('1.2.3', configured)).toBe('1.2.30');
    expect(normalizeScaleInput('中细', null)).toBe('中细');
  });

  it('keeps major labels five steps apart after reopening at another value', () => {
    const settings = { min: '0.0', max: '10.0' };
    const labelsAt = (current: string) => {
      const scale = getGrinderScale(current, settings)!;
      return [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]
        .filter(offset => isMajorScaleMark(scale, offset))
        .map(offset => getScaleAt(scale, offset));
    };
    expect(labelsAt('5')).toEqual(['4.5', '5.0', '5.5']);
    expect(labelsAt('5.2')).toEqual(['5.0', '5.5']);
  });
});
