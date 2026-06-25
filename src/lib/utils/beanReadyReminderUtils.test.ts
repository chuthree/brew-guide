import { describe, expect, it } from 'vitest';
import type { CoffeeBean } from '../../types/app';
import {
  buildBeanReadyReminderItems,
  formatBeanReadyReminderDays,
} from './beanReadyReminderUtils';

const baseBean: CoffeeBean = {
  id: 'bean-1',
  timestamp: 1,
  name: '埃塞俄比亚 水洗',
  roaster: 'Brew Guide',
  roastDate: '2026-05-13',
  startDay: 10,
  endDay: 60,
  remaining: '100',
  beanState: 'roasted',
};

describe('buildBeanReadyReminderItems', () => {
  it('includes beans that become ready today or tomorrow', () => {
    const today = buildBeanReadyReminderItems([baseBean], {
      today: '2026-05-23',
    });
    const tomorrow = buildBeanReadyReminderItems(
      [{ ...baseBean, id: 'bean-2', roastDate: '2026-05-14' }],
      { today: '2026-05-23' }
    );

    expect(today).toMatchObject([
      {
        beanId: 'bean-1',
        coffeeBean: 'Brew Guide 埃塞俄比亚 水洗',
        daysUntilReady: 0,
        daysText: '当天',
        readyDate: '2026-05-23',
      },
    ]);
    expect(tomorrow[0]?.daysText).toBe('1天后');
  });

  it('only includes the nearest two days', () => {
    const past = buildBeanReadyReminderItems(
      [{ ...baseBean, roastDate: '2026-05-12' }],
      { today: '2026-05-23' }
    );
    const twoDaysLater = buildBeanReadyReminderItems(
      [{ ...baseBean, roastDate: '2026-05-15' }],
      { today: '2026-05-23' }
    );

    expect(past).toEqual([]);
    expect(twoDaysLater).toEqual([]);
  });

  it('skips unavailable beans', () => {
    const items = buildBeanReadyReminderItems(
      [
        { ...baseBean, id: 'green', beanState: 'green' },
        { ...baseBean, id: 'frozen', isFrozen: true },
        { ...baseBean, id: 'transit', isInTransit: true },
        { ...baseBean, id: 'empty', remaining: '0' },
        { ...baseBean, id: 'missing-date', roastDate: '' },
      ],
      { today: '2026-05-23' }
    );

    expect(items).toEqual([]);
  });

  it('skips beans without an explicit aging period', () => {
    const items = buildBeanReadyReminderItems(
      [{ ...baseBean, startDay: undefined, endDay: undefined }],
      { today: '2026-05-20' }
    );

    expect(items).toEqual([]);
  });

  it('allows an aging period without a flavor period', () => {
    const items = buildBeanReadyReminderItems(
      [{ ...baseBean, startDay: 7, endDay: undefined }],
      { today: '2026-05-20' }
    );

    expect(items[0]?.readyDate).toBe('2026-05-20');
  });

  it('formats day labels', () => {
    expect(formatBeanReadyReminderDays(0)).toBe('当天');
    expect(formatBeanReadyReminderDays(1)).toBe('1天后');
  });
});
