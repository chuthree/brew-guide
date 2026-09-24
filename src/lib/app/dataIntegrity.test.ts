import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearExpectedCoreDataDeletion,
  markExpectedCoreDataDeletionIfEmpty,
  shouldReportUnexpectedCoreDataLoss,
  type CoreDataSnapshot,
  type ExpectedCoreDataMutation,
} from './dataIntegrity';

const mocks = vi.hoisted(() => ({
  coffeeBeansCount: vi.fn(),
  appSettingsCount: vi.fn(),
  legacySettingsCount: vi.fn(),
  brewingNotesCount: vi.fn(),
  preferencesGet: vi.fn(),
  preferencesRemove: vi.fn(),
  preferencesSet: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: mocks.preferencesGet,
    set: mocks.preferencesSet,
    remove: mocks.preferencesRemove,
  },
}));

vi.mock('@/lib/data/repositories', () => ({
  appSettingsRepository: { count: mocks.appSettingsCount },
  legacySettingsRepository: { count: mocks.legacySettingsCount },
  brewingNoteRepository: { count: mocks.brewingNotesCount },
  coffeeBeanRepository: { count: mocks.coffeeBeansCount },
}));

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

  it('consumes an intentional final-record deletion even after ten minutes', () => {
    expect(
      shouldReportUnexpectedCoreDataLoss({
        previous: snapshot({ coffeeBeans: 1 }),
        current: snapshot(),
        expectedMutation: {
          reason: 'record-delete',
          recordedAt: '2026-07-09T00:00:00.000Z',
          expiresAt: '2026-07-09T00:10:00.000Z',
        },
        nowMs: Date.parse('2026-07-10T00:00:00.000Z'),
      })
    ).toBe(false);
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

describe('markExpectedCoreDataDeletionIfEmpty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.coffeeBeansCount.mockResolvedValue(0);
    mocks.brewingNotesCount.mockResolvedValue(0);
    mocks.appSettingsCount.mockResolvedValue(1);
    mocks.preferencesGet.mockResolvedValue({ value: null });
    mocks.preferencesRemove.mockResolvedValue(undefined);
    mocks.preferencesSet.mockResolvedValue(undefined);
  });

  it('marks an intentional deletion only after the last core record is gone', async () => {
    await markExpectedCoreDataDeletionIfEmpty();

    expect(mocks.preferencesSet).toHaveBeenCalledOnce();
    expect(
      JSON.parse(mocks.preferencesSet.mock.calls[0][0].value)
    ).toMatchObject({ reason: 'record-delete' });
  });

  it('does not mask data loss while another core record remains', async () => {
    mocks.coffeeBeansCount.mockResolvedValue(1);

    await markExpectedCoreDataDeletionIfEmpty();

    expect(mocks.preferencesSet).not.toHaveBeenCalled();
  });

  it('clears the deletion marker after new core data is created', async () => {
    mocks.preferencesGet.mockResolvedValue({
      value: JSON.stringify({
        reason: 'record-delete',
        recordedAt: '2026-07-09T00:00:00.000Z',
        expiresAt: '2026-07-09T00:10:00.000Z',
      }),
    });

    await clearExpectedCoreDataDeletion();

    expect(mocks.preferencesRemove).toHaveBeenCalledOnce();
  });
});
