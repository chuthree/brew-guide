import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { db } from '@/lib/core/db';
import {
  recordCrashCheckpoint,
  recordDataIntegrityReport,
} from '@/lib/app/crashDiagnostics';

const CORE_DATA_SNAPSHOT_KEY = 'brew-guide:data-integrity:core-snapshot';
const EXPECTED_CORE_DATA_MUTATION_KEY =
  'brew-guide:data-integrity:expected-core-mutation';
const EXPECTED_MUTATION_WINDOW_MS = 10 * 60 * 1000;

export type CoreDataMutationReason = 'data-import' | 'reset-all-data';

export interface CoreDataSnapshot {
  capturedAt: string;
  coffeeBeans: number;
  coffeeBeanImages: number;
  coffeeBeanImageThumbnails: number;
  brewingNotes: number;
  brewingNoteImages: number;
  brewingNoteImageThumbnails: number;
  appSettings: number;
  settings: number;
}

export interface ExpectedCoreDataMutation {
  reason: CoreDataMutationReason;
  recordedAt: string;
  expiresAt: string;
}

export interface CoreDataIntegrityCheck {
  previous: CoreDataSnapshot | null;
  current: CoreDataSnapshot;
  expectedMutation: ExpectedCoreDataMutation | null;
  shouldReport: boolean;
}

const nowIso = (): string => new Date().toISOString();

const parseJson = <T>(value: string | null | undefined): T | null => {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

const readStorageValue = async <T>(key: string): Promise<T | null> => {
  if (Capacitor.isNativePlatform()) {
    const { value } = await Preferences.get({ key });
    return parseJson<T>(value);
  }

  if (typeof window === 'undefined') return null;

  return parseJson<T>(window.localStorage.getItem(key));
};

const writeStorageValue = async (
  key: string,
  value: unknown
): Promise<void> => {
  const serialized = JSON.stringify(value);

  if (Capacitor.isNativePlatform()) {
    await Preferences.set({ key, value: serialized });
    return;
  }

  if (typeof window === 'undefined') return;

  window.localStorage.setItem(key, serialized);
};

const removeStorageValue = async (key: string): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    await Preferences.remove({ key });
    return;
  }

  if (typeof window === 'undefined') return;

  window.localStorage.removeItem(key);
};

const getCoreRecordCount = (snapshot: CoreDataSnapshot): number =>
  snapshot.coffeeBeans +
  snapshot.coffeeBeanImages +
  snapshot.coffeeBeanImageThumbnails +
  snapshot.brewingNotes +
  snapshot.brewingNoteImages +
  snapshot.brewingNoteImageThumbnails;

const hasSettingsData = (snapshot: CoreDataSnapshot): boolean =>
  snapshot.appSettings > 0 || snapshot.settings > 0;

const isExpectedMutationActive = (
  expectedMutation: ExpectedCoreDataMutation | null,
  nowMs: number
): boolean => {
  if (!expectedMutation) return false;

  return Date.parse(expectedMutation.expiresAt) > nowMs;
};

export const shouldReportUnexpectedCoreDataLoss = ({
  previous,
  current,
  expectedMutation,
  nowMs = Date.now(),
}: {
  previous: CoreDataSnapshot | null;
  current: CoreDataSnapshot;
  expectedMutation: ExpectedCoreDataMutation | null;
  nowMs?: number;
}): boolean => {
  if (!previous) return false;
  if (isExpectedMutationActive(expectedMutation, nowMs)) return false;

  return (
    getCoreRecordCount(previous) > 0 &&
    getCoreRecordCount(current) === 0 &&
    hasSettingsData(current)
  );
};

const collectCoreDataSnapshot = async (): Promise<CoreDataSnapshot> => {
  const [
    coffeeBeans,
    coffeeBeanImages,
    coffeeBeanImageThumbnails,
    brewingNotes,
    brewingNoteImages,
    brewingNoteImageThumbnails,
    appSettings,
    settings,
  ] = await Promise.all([
    db.coffeeBeans.count(),
    db.coffeeBeanImages.count(),
    db.coffeeBeanImageThumbnails.count(),
    db.brewingNotes.count(),
    db.brewingNoteImages.count(),
    db.brewingNoteImageThumbnails.count(),
    db.appSettings.count(),
    db.settings.count(),
  ]);

  return {
    capturedAt: nowIso(),
    coffeeBeans,
    coffeeBeanImages,
    coffeeBeanImageThumbnails,
    brewingNotes,
    brewingNoteImages,
    brewingNoteImageThumbnails,
    appSettings,
    settings,
  };
};

const buildReportMeta = (
  source: string,
  previous: CoreDataSnapshot,
  current: CoreDataSnapshot,
  expectedMutation: ExpectedCoreDataMutation | null
) => ({
  source,
  previousCapturedAt: previous.capturedAt,
  previousCoreCount: getCoreRecordCount(previous),
  currentCoreCount: getCoreRecordCount(current),
  previousCoffeeBeans: previous.coffeeBeans,
  previousBrewingNotes: previous.brewingNotes,
  currentCoffeeBeans: current.coffeeBeans,
  currentBrewingNotes: current.brewingNotes,
  currentAppSettings: current.appSettings,
  currentSettings: current.settings,
  expectedMutationReason: expectedMutation?.reason,
  expectedMutationExpiresAt: expectedMutation?.expiresAt,
});

export async function markExpectedCoreDataMutation(
  reason: CoreDataMutationReason
): Promise<void> {
  const recordedAt = new Date();
  await writeStorageValue(EXPECTED_CORE_DATA_MUTATION_KEY, {
    reason,
    recordedAt: recordedAt.toISOString(),
    expiresAt: new Date(
      recordedAt.getTime() + EXPECTED_MUTATION_WINDOW_MS
    ).toISOString(),
  } satisfies ExpectedCoreDataMutation);
}

export async function inspectCoreDataIntegrity(
  source = 'startup'
): Promise<CoreDataIntegrityCheck> {
  const [previous, expectedMutation, current] = await Promise.all([
    readStorageValue<CoreDataSnapshot>(CORE_DATA_SNAPSHOT_KEY),
    readStorageValue<ExpectedCoreDataMutation>(
      EXPECTED_CORE_DATA_MUTATION_KEY
    ),
    collectCoreDataSnapshot(),
  ]);
  const nowMs = Date.now();
  const shouldReport = shouldReportUnexpectedCoreDataLoss({
    previous,
    current,
    expectedMutation,
    nowMs,
  });

  recordCrashCheckpoint('data-integrity:checked', {
    source,
    previousCoreCount: previous ? getCoreRecordCount(previous) : undefined,
    currentCoreCount: getCoreRecordCount(current),
    currentCoffeeBeans: current.coffeeBeans,
    currentBrewingNotes: current.brewingNotes,
    currentAppSettings: current.appSettings,
    currentSettings: current.settings,
    expectedMutationReason: expectedMutation?.reason,
  });

  if (shouldReport && previous) {
    const reportMeta = buildReportMeta(
      source,
      previous,
      current,
      expectedMutation
    );
    recordCrashCheckpoint('data-integrity:unexpected-empty-core', reportMeta);
    await recordDataIntegrityReport(
      '检测到本地核心数据表异常变为空，但设置数据仍然存在。请先导出抢救数据和诊断信息。',
      reportMeta
    );
  }

  await writeStorageValue(CORE_DATA_SNAPSHOT_KEY, current);

  if (
    !isExpectedMutationActive(expectedMutation, nowMs) ||
    getCoreRecordCount(current) > 0
  ) {
    await removeStorageValue(EXPECTED_CORE_DATA_MUTATION_KEY);
  }

  return {
    previous,
    current,
    expectedMutation,
    shouldReport,
  };
}
