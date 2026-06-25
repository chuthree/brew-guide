import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import {
  calculateFlavorInfo,
  getDefaultFlavorPeriodByRoastLevelSync,
} from './flavorPeriodUtils';

const bean: CoffeeBean = {
  id: 'bean-1',
  timestamp: 1,
  name: 'Test Bean',
  roastDate: '2026-05-01',
  remaining: '100',
  beanState: 'roasted',
};

describe('flavorPeriodUtils', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps roast-level presets for default flavor period values', () => {
    expect(
      getDefaultFlavorPeriodByRoastLevelSync('浅烘', {
        light: { startDay: 7, endDay: 0 },
        medium: { startDay: 0, endDay: 0 },
        dark: { startDay: 0, endDay: 0 },
      })
    ).toEqual({ startDay: 7, endDay: 60 });
  });

  it('shows aging when start day exists and hides flavor status when end day is empty', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-10T12:00:00'));

    expect(calculateFlavorInfo({ ...bean, startDay: 14 }).phase).toBe('养豆期');

    vi.setSystemTime(new Date('2026-05-20T12:00:00'));

    expect(calculateFlavorInfo({ ...bean, startDay: 14 })).toEqual({
      phase: '未知',
      remainingDays: 0,
    });
  });
});
