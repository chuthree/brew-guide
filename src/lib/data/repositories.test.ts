import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import type { AppSettings, Grinder } from '@/lib/data/models';
import type {
  AppSettingsRepository,
  GrinderRepository,
} from '@/lib/data/contracts';
import { createDexieAppSettingsRepository } from '@/lib/data/adapters/dexie/settingsRepository';
import { createDexieGrinderRepository } from '@/lib/data/adapters/dexie/grinderRepository';

interface AppSettingsRow {
  id: string;
  data: AppSettings;
}

class RepositoryTestDatabase extends Dexie {
  appSettings!: Table<AppSettingsRow, string>;
  grinders!: Table<Grinder, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      appSettings: 'id',
      grinders: 'id, name',
    });
  }
}

describe('Dexie repository adapters', () => {
  let testDb: RepositoryTestDatabase;
  let appSettingsRepository: AppSettingsRepository;
  let grinderRepository: GrinderRepository;

  beforeEach(async () => {
    testDb = new RepositoryTestDatabase(
      `BrewGuideRepositoryTest-${Date.now()}-${Math.random()}`
    );
    await testDb.open();
    appSettingsRepository = createDexieAppSettingsRepository(
      testDb.appSettings
    );
    grinderRepository = createDexieGrinderRepository(testDb.grinders);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('returns undefined when app settings are empty', async () => {
    expect(await appSettingsRepository.get()).toBeUndefined();
    expect(await appSettingsRepository.count()).toBe(0);
  });

  it('saves app settings under the fixed main id and replaces the previous value', async () => {
    const first = {
      username: 'first',
      optionalFeature: { enabled: true, labels: ['a', 'b'] },
      layoutSettings: { dataFontSize: '3xl' },
    } as unknown as AppSettings;
    const second = {
      username: 'second',
      optionalFeature: { enabled: false, labels: ['nested', 'values'] },
      layoutSettings: { stepDisplayMode: 'time' },
    } as unknown as AppSettings;

    await appSettingsRepository.save(first);
    await appSettingsRepository.save(second);

    expect(await appSettingsRepository.get()).toEqual(second);
    expect(await testDb.appSettings.toArray()).toEqual([
      { id: 'main', data: second },
    ]);
    expect(await appSettingsRepository.count()).toBe(1);
  });

  it('clears app settings', async () => {
    await appSettingsRepository.save({ username: 'test' } as AppSettings);

    await appSettingsRepository.clear();

    expect(await appSettingsRepository.get()).toBeUndefined();
  });

  it('returns an empty grinder list for an empty table', async () => {
    expect(await grinderRepository.list()).toEqual([]);
    expect(await grinderRepository.count()).toBe(0);
  });

  it('saves and upserts a grinder by id', async () => {
    await grinderRepository.save({ id: 'c40', name: 'C40' });
    await grinderRepository.save({
      id: 'c40',
      name: 'Comandante C40',
      currentGrindSize: '22',
    });

    expect(await grinderRepository.list()).toEqual([
      {
        id: 'c40',
        name: 'Comandante C40',
        currentGrindSize: '22',
      },
    ]);
    expect(await grinderRepository.count()).toBe(1);
  });

  it('bulk upserts grinders and preserves nested grind history', async () => {
    const grinders: Grinder[] = [
      {
        id: 'c40',
        name: 'C40',
        grindSizeHistory: [
          {
            grindSize: '22',
            timestamp: 123,
            equipment: 'V60',
            coffeeBeanName: 'Ethiopia',
          },
        ],
      },
      { id: 'zp6', name: 'ZP6' },
    ];

    await grinderRepository.upsertMany(grinders);

    expect(await grinderRepository.list()).toEqual(grinders);
  });

  it('deletes a grinder by id', async () => {
    await grinderRepository.save({ id: 'c40', name: 'C40' });

    await grinderRepository.delete('c40');

    expect(await grinderRepository.list()).toEqual([]);
  });

  it('replaces all grinders, including replacing the table with an empty list', async () => {
    await grinderRepository.save({ id: 'old', name: 'Old' });
    const replacements: Grinder[] = [
      {
        id: 'c40',
        name: 'C40',
        grindSizeHistory: [{ grindSize: '20', timestamp: 456 }],
      },
      { id: 'zp6', name: 'ZP6' },
    ];

    await grinderRepository.replaceAll(replacements);
    expect(await grinderRepository.list()).toEqual(replacements);

    await grinderRepository.replaceAll([]);
    expect(await grinderRepository.list()).toEqual([]);
  });

  it('clears grinders', async () => {
    await grinderRepository.save({ id: 'c40', name: 'C40' });

    await grinderRepository.clear();

    expect(await grinderRepository.count()).toBe(0);
  });
});
