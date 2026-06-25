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
};

const buildCandidate = (
  bean: CoffeeBean,
  options: Parameters<typeof buildBeanCalendarEventCandidates>[2] = {}
) =>
  buildBeanCalendarEventCandidates(bean, enabledSettings, {
    today: '2026-05-01',
    ...options,
  });

describe('buildBeanCalendarEventCandidates', () => {
  it('builds one all-day event on the day the bean finishes aging', () => {
    const event = buildCandidate(baseBean);

    expect(event).toEqual({
      stableId: 'bean-1',
      beanId: 'bean-1',
      title: 'Brew Guide 埃塞俄比亚 水洗',
      date: '2026-05-11',
    });
  });

  it('does not duplicate roaster when the bean name already contains it', () => {
    const event = buildCandidate({
      ...baseBean,
      name: 'Brew Guide 埃塞俄比亚 水洗',
    });

    expect(event?.title).toBe('Brew Guide 埃塞俄比亚 水洗');
  });

  it('does not use default periods when bean-level period values are empty', () => {
    const event = buildCandidate({
      ...baseBean,
      startDay: undefined,
      endDay: undefined,
    });

    expect(event).toBeNull();
  });

  it('allows an aging period without a flavor period', () => {
    const event = buildCandidate({
      ...baseBean,
      startDay: 7,
      endDay: undefined,
    });

    expect(event?.date).toBe('2026-05-08');
  });

  it('does not generate calendar events for disabled sync, green beans, frozen beans, in-transit beans, or beans without roast date', () => {
    const disabled = buildBeanCalendarEventCandidates(baseBean, {
      enabled: false,
    });
    const green = buildCandidate({ ...baseBean, beanState: 'green' });
    const frozen = buildCandidate({ ...baseBean, isFrozen: true });
    const inTransit = buildCandidate({ ...baseBean, isInTransit: true });
    const missingDate = buildCandidate({ ...baseBean, roastDate: '' });

    expect(disabled).toBeNull();
    expect(green).toBeNull();
    expect(frozen).toBeNull();
    expect(inTransit).toBeNull();
    expect(missingDate).toBeNull();
  });

  it('only generates events for beans with a positive remaining amount', () => {
    const available = buildCandidate({ ...baseBean, remaining: '12.5g' });
    const empty = buildCandidate({ ...baseBean, remaining: '0' });
    const missingRemaining = buildCandidate({ ...baseBean, remaining: '' });

    expect(available?.beanId).toBe(baseBean.id);
    expect(empty).toBeNull();
    expect(missingRemaining).toBeNull();
  });

  it('does not generate events for dates before today', () => {
    const past = buildBeanCalendarEventCandidates(baseBean, enabledSettings, {
      today: '2026-05-12',
    });
    const today = buildBeanCalendarEventCandidates(baseBean, enabledSettings, {
      today: '2026-05-11',
    });

    expect(past).toBeNull();
    expect(today?.date).toBe('2026-05-11');
  });
});
