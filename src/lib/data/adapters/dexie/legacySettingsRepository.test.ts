import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { LegacySettingEntry } from '@/lib/data/contracts';
import { createDexieLegacySettingsRepository } from './legacySettingsRepository';

class LegacySettingsTestDatabase extends Dexie {
  settings!: Table<LegacySettingEntry, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ settings: 'key' });
  }
}

describe('Dexie LegacySettingsRepository', () => {
  let database: LegacySettingsTestDatabase;
  let repository: ReturnType<typeof createDexieLegacySettingsRepository>;

  beforeEach(async () => {
    database = new LegacySettingsTestDatabase(
      `BrewGuideLegacySettingsRepositoryTest-${Date.now()}-${Math.random()}`
    );
    await database.open();
    repository = createDexieLegacySettingsRepository(database.settings);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('returns undefined for a missing key and supports set, overwrite, and delete', async () => {
    expect(await repository.get('missing')).toBeUndefined();

    await repository.set('custom-key', 'first value');
    expect(await repository.get('custom-key')).toBe('first value');

    await repository.set('custom-key', 'replacement');
    expect(await repository.get('custom-key')).toBe('replacement');

    await repository.delete('custom-key');
    expect(await repository.get('custom-key')).toBeUndefined();
  });

  it('preserves arbitrary strings, empty strings, JSON, and migration markers verbatim', async () => {
    const structuredJson = '[{"id":"custom-1","name":"Origami"}]';
    const values = [
      ['arbitrary', 'value with spaces and = signs'],
      ['empty', ''],
      ['customEquipments', structuredJson],
      ['onboardingCompleted', 'true'],
      ['v4_migrated', 'true'],
      ['brewingNoteImagesMigrated', 'true'],
    ] as const;

    for (const [key, value] of values) {
      await repository.set(key, value);
    }

    for (const [key, value] of values) {
      expect(await repository.get(key)).toBe(value);
    }
    expect(await database.settings.get('customEquipments')).toEqual({
      key: 'customEquipments',
      value: structuredJson,
    });
  });

  it('counts and clears only records in the legacy settings table', async () => {
    await repository.set('one', '1');
    await repository.set('two', '2');
    expect(await repository.count()).toBe(2);

    await repository.clear();
    expect(await repository.count()).toBe(0);
  });
});
