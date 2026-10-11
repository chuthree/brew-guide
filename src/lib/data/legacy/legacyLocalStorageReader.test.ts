import { describe, expect, it, vi } from 'vitest';
import {
  LEGACY_LOCAL_STORAGE_MIGRATION_KEYS,
  readLegacyLocalStorageSnapshot,
} from './legacyLocalStorageReader';

describe('readLegacyLocalStorageSnapshot', () => {
  it('reads only the historical Dexie migration keys without changing storage', () => {
    const values = new Map<string, string>([
      ['brewGuideSettings', '{"state":{"settings":{"theme":"dark"}}}'],
      ['roaster-logos', '[{"roasterName":"Roaster"}]'],
      ['customFlavorDimensions', '[]'],
      ['flavorDimensionHistoricalLabels', '{}'],
      ['equipmentOrder', '{"equipmentIds":["v60"]}'],
      ['unrelated-preference', 'leave-me-alone'],
    ]);
    const getItem = vi.fn((key: string) => values.get(key) ?? null);

    const snapshot = readLegacyLocalStorageSnapshot({ getItem });

    expect(getItem.mock.calls.map(([key]) => key)).toEqual(
      LEGACY_LOCAL_STORAGE_MIGRATION_KEYS
    );
    expect(snapshot).toEqual({
      brewGuideSettings: '{"state":{"settings":{"theme":"dark"}}}',
      'roaster-logos': '[{"roasterName":"Roaster"}]',
      customFlavorDimensions: '[]',
      flavorDimensionHistoricalLabels: '{}',
      equipmentOrder: '{"equipmentIds":["v60"]}',
    });
    expect(values.get('unrelated-preference')).toBe('leave-me-alone');
  });
});
