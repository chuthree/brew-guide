import { describe, expect, it } from 'vitest';
import type { CoffeeBean } from '../../types/app';
import {
  buildBeanCalendarEventCandidates,
  type CalendarSyncSettings,
} from './eventCandidates';

const baseBean: CoffeeBean = {
  id: 'bean-1',
  timestamp: 1,
  name: '埃塞俄比亚 水洗',
  roaster: 'Brew Guide',
  roastDate: '2026-05-01',
  startDay: 10,
  endDay: 60,
  remaining: '100',
  beanState: 'roasted',
};

const enabledSettings: CalendarSyncSettings = {
  enabled: true,
  syncAgingPeriod: true,
  syncFlavorPeriod: true,
};

describe('buildBeanCalendarEventCandidates', () => {
  it('builds all-day exclusive-end range events for aging and flavor periods', () => {
    const events = buildBeanCalendarEventCandidates(baseBean, enabledSettings);

    expect(events).toEqual([
      {
        stableId: 'bean-1:aging-period',
        beanId: 'bean-1',
        kind: 'aging-period',
        title: '养豆期｜Brew Guide 埃塞俄比亚 水洗',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
        description:
          'Brew Guide 自动同步：Brew Guide 埃塞俄比亚 水洗，烘焙日期 2026-05-01，养豆期至 2026-05-10。',
      },
      {
        stableId: 'bean-1:flavor-period',
        beanId: 'bean-1',
        kind: 'flavor-period',
        title: '赏味期｜Brew Guide 埃塞俄比亚 水洗',
        startDate: '2026-05-11',
        endDate: '2026-07-01',
        description:
          'Brew Guide 自动同步：Brew Guide 埃塞俄比亚 水洗，赏味期 2026-05-11 至 2026-06-30。',
      },
    ]);
  });

  it('uses switches to filter generated periods', () => {
    const events = buildBeanCalendarEventCandidates(baseBean, {
      ...enabledSettings,
      syncAgingPeriod: false,
    });

    expect(events.map(event => event.kind)).toEqual(['flavor-period']);
  });

  it('does not duplicate roaster when the bean name already contains it', () => {
    const events = buildBeanCalendarEventCandidates(
      { ...baseBean, name: 'Brew Guide 埃塞俄比亚 水洗' },
      enabledSettings
    );

    expect(events.map(event => event.title)).toEqual([
      '养豆期｜Brew Guide 埃塞俄比亚 水洗',
      '赏味期｜Brew Guide 埃塞俄比亚 水洗',
    ]);
  });

  it('uses the provided period resolver when bean-level period values are not set', () => {
    const events = buildBeanCalendarEventCandidates(
      { ...baseBean, startDay: undefined, endDay: undefined },
      enabledSettings,
      {
        resolvePeriod: () => ({ startDay: 7, endDay: 30 }),
      }
    );

    expect(
      events.map(event => [event.kind, event.startDate, event.endDate])
    ).toEqual([
      ['aging-period', '2026-05-01', '2026-05-07'],
      ['flavor-period', '2026-05-08', '2026-06-01'],
    ]);
  });

  it('uses the visible aging end date when flavor period sync is disabled', () => {
    const events = buildBeanCalendarEventCandidates(baseBean, {
      ...enabledSettings,
      syncFlavorPeriod: false,
    });

    expect(events).toEqual([
      {
        stableId: 'bean-1:aging-period',
        beanId: 'bean-1',
        kind: 'aging-period',
        title: '养豆期｜Brew Guide 埃塞俄比亚 水洗',
        startDate: '2026-05-01',
        endDate: '2026-05-10',
        description:
          'Brew Guide 自动同步：Brew Guide 埃塞俄比亚 水洗，烘焙日期 2026-05-01，养豆期至 2026-05-10。',
      },
    ]);
  });

  it('does not generate calendar events for disabled sync, green beans, frozen beans, in-transit beans, or beans without roast date', () => {
    const disabled = buildBeanCalendarEventCandidates(baseBean, {
      ...enabledSettings,
      enabled: false,
    });
    const green = buildBeanCalendarEventCandidates(
      { ...baseBean, beanState: 'green' },
      enabledSettings
    );
    const frozen = buildBeanCalendarEventCandidates(
      { ...baseBean, isFrozen: true },
      enabledSettings
    );
    const inTransit = buildBeanCalendarEventCandidates(
      { ...baseBean, isInTransit: true },
      enabledSettings
    );
    const missingDate = buildBeanCalendarEventCandidates(
      { ...baseBean, roastDate: '' },
      enabledSettings
    );

    expect(disabled).toEqual([]);
    expect(green).toEqual([]);
    expect(frozen).toEqual([]);
    expect(inTransit).toEqual([]);
    expect(missingDate).toEqual([]);
  });

  it('only generates events for beans with a positive remaining amount', () => {
    const available = buildBeanCalendarEventCandidates(
      { ...baseBean, remaining: '12.5g' },
      enabledSettings
    );
    const empty = buildBeanCalendarEventCandidates(
      { ...baseBean, remaining: '0' },
      enabledSettings
    );
    const missingRemaining = buildBeanCalendarEventCandidates(
      { ...baseBean, remaining: '' },
      enabledSettings
    );

    expect(available.map(event => event.kind)).toEqual([
      'aging-period',
      'flavor-period',
    ]);
    expect(empty).toEqual([]);
    expect(missingRemaining).toEqual([]);
  });
});
