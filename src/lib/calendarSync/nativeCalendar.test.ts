import { describe, expect, it } from 'vitest';
import { toNativeCalendarDateTimestamp } from './nativeCalendar';

describe('toNativeCalendarDateTimestamp', () => {
  it('uses UTC midnight for Android all-day calendar events', () => {
    expect(toNativeCalendarDateTimestamp('2026-05-01', 'android')).toBe(
      Date.UTC(2026, 4, 1)
    );
  });

  it('uses local midnight for iOS all-day calendar events', () => {
    expect(toNativeCalendarDateTimestamp('2026-05-01', 'ios')).toBe(
      new Date(2026, 4, 1).getTime()
    );
  });
});
