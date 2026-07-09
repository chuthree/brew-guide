import { describe, expect, it } from 'vitest';
import {
  shouldReportUnexpectedCoreDataLoss,
  type CoreDataSnapshot,
  type ExpectedCoreDataMutation,
} from './dataIntegrity';

const snapshot = (
  overrides: Partial<CoreDataSnapshot> = {}
): CoreDataSnapshot => ({
  capturedAt: '2026-07-09T00:00:00.000Z',
  coffeeBeans: 0,
  coffeeBeanImages: 0,
  coffeeBeanImageThumbnails: 0,
  brewingNotes: 0,
  brewingNoteImages: 0,
  brewingNoteImageThumbnails: 0,
  appSettings: 1,
  settings: 1,
  ...overrides,
});

const expectedMutation = (
  expiresAt = '2026-07-09T00:10:00.000Z'
): ExpectedCoreDataMutation => ({
  reason: 'reset-all-data',
  recordedAt: '2026-07-09T00:00:00.000Z',
  expiresAt,
});

describe('shouldReportUnexpectedCoreDataLoss', () => {
  it('reports when previous core data disappears while settings survive', () => {
    expect(
      shouldReportUnexpectedCoreDataLoss({
        previous: snapshot({ coffeeBeans: 3, brewingNotes: 5 }),
        current: snapshot(),
        expectedMutation: null,
        nowMs: Date.parse('2026-07-09T00:01:00.000Z'),
      })
    ).toBe(true);
  });

  it('does not report first-run empty data', () => {
    expect(
      shouldReportUnexpectedCoreDataLoss({
        previous: null,
        current: snapshot(),
        expectedMutation: null,
      })
    ).toBe(false);
  });

  it('does not report when the empty state came from a recent explicit action', () => {
    expect(
      shouldReportUnexpectedCoreDataLoss({
        previous: snapshot({ coffeeBeans: 2 }),
        current: snapshot(),
        expectedMutation: expectedMutation(),
        nowMs: Date.parse('2026-07-09T00:05:00.000Z'),
      })
    ).toBe(false);
  });

  it('reports again after an explicit-action marker expires', () => {
    expect(
      shouldReportUnexpectedCoreDataLoss({
        previous: snapshot({ brewingNotes: 2 }),
        current: snapshot(),
        expectedMutation: expectedMutation(),
        nowMs: Date.parse('2026-07-09T00:11:00.000Z'),
      })
    ).toBe(true);
  });

  it('does not report a full reset where settings are also gone', () => {
    expect(
      shouldReportUnexpectedCoreDataLoss({
        previous: snapshot({ coffeeBeans: 2, brewingNotes: 2 }),
        current: snapshot({ appSettings: 0, settings: 0 }),
        expectedMutation: null,
      })
    ).toBe(false);
  });
});
