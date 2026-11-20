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
    const configured = configureGrinderScale(
      '1.0.2',
      '1.0.4',
      '1.0.0',
      '1.0.6'
    );
    expect(configured?.settings).toEqual({
      format: '0.0.0',
      step: '0.0.2',
      min: '1.0.0',
      max: '1.0.6',
    });
    const reopened = getGrinderScale('1.0.4', configured?.settings);
    expect(reopened && getScaleAt(reopened, -2)).toBe('1.0.0');
    expect(reopened && getScaleAt(reopened, -3)).toBeNull();
    expect(reopened && getScaleAt(reopened, 1)).toBe('1.0.6');
    expect(reopened && getScaleAt(reopened, 2)).toBeNull();
  });

  it('accepts a default setup and limits an unconfigured wheel at zero', () => {
    const configured = configureGrinderScale('0.1', '', '', '');
    expect(configured?.settings).toEqual({ format: '0.0' });
    expect(configured && getScaleAt(configured.scale, -1)).toBe('0.0');
    expect(configured && getScaleAt(configured.scale, -2)).toBeNull();
  });

  it('rejects invalid examples and keeps the configured format authoritative', () => {
    expect(getGrinderScale('中细')).toBeNull();
    expect(configureGrinderScale('1.0.2', '1.02', '', '')).toBeNull();
    expect(configureGrinderScale('1.0.2', '1.0.1', '', '')).toBeNull();
    expect(configureGrinderScale('1.0.2', '', '', '1.0.0')).toBeNull();
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
