import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { BrewGuideDB } from '@/lib/core/db';
import type { AppSettings, Grinder } from '@/lib/data/models';
import type { CoffeeBean } from '@/types/app';
import { createDexieRoasterRenamePersistence } from './roasterRenamePersistence';

class RoasterRenameTestDatabase extends Dexie {
  coffeeBeans!: Table<CoffeeBean, string>;
  brewingNotes!: Table<BrewingNote, string>;
  grinders!: Table<Grinder, string>;
  appSettings!: Table<{ id: string; data: AppSettings }, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      coffeeBeans: 'id',
      brewingNotes: 'id',
      grinders: 'id',
      appSettings: 'id',
    });
  }
}

type WritableTableName =
  | 'coffeeBeans'
  | 'brewingNotes'
  | 'grinders'
  | 'appSettings';

const withTableFailure = (
  database: RoasterRenameTestDatabase,
  tableName: WritableTableName,
  methodName: 'bulkPut' | 'put'
): BrewGuideDB => {
  const table = database[tableName];
  const failingTable = new Proxy(table, {
    get(target, property) {
      if (property === methodName) {
        return async () => {
          throw new Error(`Injected ${tableName}.${methodName} failure`);
        };
      }

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return new Proxy(database, {
    get(target, property) {
      if (property === tableName) return failingTable;

      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  }) as unknown as BrewGuideDB;
};

const oldBean: CoffeeBean = {
  id: 'bean-1',
  timestamp: 10,
  name: 'Old Roaster Espresso',
  roaster: 'Old Roaster',
};

const oldNote: BrewingNote = {
  id: 'note-1',
  timestamp: 20,
  updatedAt: 21,
  beanId: 'bean-1',
  coffeeBeanInfo: {
    name: 'Old Roaster Espresso',
    roaster: 'Old Roaster',
    roastLevel: 'medium',
  },
  rating: 4,
  taste: {},
  notes: 'old note',
};

const oldGrinder: Grinder = {
  id: 'grinder-1',
  name: 'C40',
  grindSizeHistory: [
    { grindSize: '20', timestamp: 1, coffeeBeanRoaster: 'Old Roaster' },
  ],
};

const oldSettings = {
  username: 'tester',
  roasterConfigs: [
    { roasterName: 'Old Roaster', logoData: 'logo', updatedAt: 30 },
  ],
} as AppSettings;

const performRename = (
  persistence: ReturnType<typeof createDexieRoasterRenamePersistence>
) =>
  persistence.renameReferences({
    renames: new Map([['Old Roaster', 'New Roaster']]),
    now: 100,
    getFallbackSettings: () => oldSettings,
  });

describe('Dexie RoasterRenamePersistence', () => {
  let database: RoasterRenameTestDatabase;

  beforeEach(async () => {
    database = new RoasterRenameTestDatabase(
      `BrewGuideRoasterRenamePersistenceTest-${Date.now()}-${Math.random()}`
    );
    await database.open();
    await database.coffeeBeans.put(oldBean);
    await database.brewingNotes.put(oldNote);
    await database.grinders.put(oldGrinder);
    await database.appSettings.put({ id: 'main', data: oldSettings });
  });

  afterEach(async () => {
    await database.delete();
  });

  it('reads and writes all four tables in the domain operation', async () => {
    const persistence = createDexieRoasterRenamePersistence(
      database as unknown as BrewGuideDB
    );

    const result = await performRename(persistence);

    expect(result.updatedBeans).toHaveLength(1);
    expect(result.updatedNotes).toHaveLength(1);
    expect(result.updatedGrinderCount).toBe(1);
    expect(result.updatedConfigCount).toBe(1);
    expect(await database.coffeeBeans.get(oldBean.id)).toMatchObject({
      name: 'Espresso',
      roaster: 'New Roaster',
      timestamp: 100,
    });
    expect(await database.brewingNotes.get(oldNote.id)).toMatchObject({
      coffeeBeanInfo: { name: 'Espresso', roaster: 'New Roaster' },
      updatedAt: 100,
    });
    expect(await database.grinders.get(oldGrinder.id)).toMatchObject({
      grindSizeHistory: [
        { grindSize: '20', timestamp: 1, coffeeBeanRoaster: 'New Roaster' },
      ],
    });
    expect(await database.appSettings.get('main')).toMatchObject({
      data: {
        roasterConfigs: [
          { roasterName: 'New Roaster', logoData: 'logo', updatedAt: 100 },
        ],
      },
    });
  });

  it.each([
    ['coffeeBeans', 'bulkPut'],
    ['brewingNotes', 'bulkPut'],
    ['grinders', 'bulkPut'],
    ['appSettings', 'put'],
  ] as const)(
    'rolls all four tables back when %s.%s fails',
    async (tableName, methodName) => {
      const failingDatabase = withTableFailure(database, tableName, methodName);
      const persistence = createDexieRoasterRenamePersistence(failingDatabase);

      await expect(performRename(persistence)).rejects.toThrow(
        `Injected ${tableName}.${methodName} failure`
      );

      expect(await database.coffeeBeans.toArray()).toEqual([oldBean]);
      expect(await database.brewingNotes.toArray()).toEqual([oldNote]);
      expect(await database.grinders.toArray()).toEqual([oldGrinder]);
      expect(await database.appSettings.toArray()).toEqual([
        { id: 'main', data: oldSettings },
      ]);
    }
  );
});
