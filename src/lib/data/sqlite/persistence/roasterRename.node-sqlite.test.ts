import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BrewGuideDB } from '@/lib/core/db';
import type { BrewingNote } from '@/lib/core/config';
import type { AppSettings, Grinder } from '@/lib/data/models';
import type { SqliteDriver, SqliteExecutor } from '@/lib/data/sqlite/driver';
import { transformRoasterRenameRecords } from '@/lib/data/roasterRename';
import { createDexieRoasterRenamePersistence } from '@/lib/data/adapters/dexie/roasterRenamePersistence';
import type { CoffeeBean } from '@/types/app';
import type { NodeSqliteTestDatabase } from '../repositories/testing/nodeSqliteTestDriver';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
} from '../repositories/testing/nodeSqliteTestDriver';
import { createSqliteAppSettingsRepository } from '../repositories/appSettings';
import { createSqliteBrewingNoteRepository } from '../repositories/brewingNote';
import { createSqliteCoffeeBeanRepository } from '../repositories/coffeeBean';
import { createSqliteGrinderRepository } from '../repositories/grinder';
import { createSqliteRoasterRenamePersistence } from './roasterRename';

class RoasterRenameParityDatabase extends Dexie {
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

interface RenameFixture {
  beans: CoffeeBean[];
  notes: BrewingNote[];
  grinders: Grinder[];
  settings: AppSettings;
}

interface RenameSnapshot {
  beans: CoffeeBean[];
  notes: BrewingNote[];
  grinders: Grinder[];
  settings: AppSettings | undefined;
}

const RENAMES = new Map([['Old Roaster', 'New Roaster']]);
const RENAME_NOW = 100;

function makeFixture(): RenameFixture {
  const beans = [
    {
      id: 'bean-a',
      timestamp: 10,
      name: 'Old Roaster Espresso',
      roaster: 'Old Roaster',
      flavor: ['chocolate'],
      futureBeanField: { nested: ['kept', 1, null] },
    },
    {
      id: 'bean-m',
      timestamp: 11,
      name: 'Washed Lot',
      roaster: 'Old Roaster',
    },
    {
      id: 'bean-z',
      timestamp: 12,
      name: 'Other Lot',
      roaster: 'Other Roaster',
      futureBeanField: { untouched: true },
    },
  ] as CoffeeBean[];

  const notes = [
    {
      id: 'note-a',
      timestamp: 20,
      updatedAt: 21,
      beanId: 'bean-a',
      coffeeBeanInfo: {
        name: 'Old Roaster Espresso',
        roaster: 'Old Roaster',
        roastLevel: 'medium',
        futureBeanInfoField: { retained: true },
      },
      rating: 4,
      taste: { sweet: 4 },
      notes: 'rename this note',
      futureNoteField: { nested: { retained: true } },
    },
    {
      id: 'note-z',
      timestamp: 30,
      updatedAt: 31,
      beanId: 'bean-z',
      coffeeBeanInfo: {
        name: 'Other Lot',
        roaster: 'Other Roaster',
        roastLevel: 'light',
      },
      rating: 3,
      taste: { citrus: 3 },
      notes: 'leave this note alone',
    },
  ] as BrewingNote[];

  const grinders = [
    {
      id: 'grinder-a',
      name: 'C40',
      grindSizeHistory: [
        {
          grindSize: '20',
          timestamp: 1,
          coffeeBeanRoaster: 'Old Roaster',
        },
        {
          grindSize: '21',
          timestamp: 2,
          coffeeBeanRoaster: 'Other Roaster',
        },
      ],
      futureGrinderField: ['preserved'],
    },
    {
      id: 'grinder-z',
      name: 'K6',
      grindSizeHistory: [
        {
          grindSize: '30',
          timestamp: 3,
          coffeeBeanRoaster: 'Other Roaster',
        },
      ],
    },
  ] as Grinder[];

  const settings = {
    username: 'fixture user',
    roasterConfigs: [
      {
        roasterName: 'New Roaster',
        logoData: 'target-logo',
        updatedAt: 30,
        targetOnlyField: 'target-wins',
      },
      {
        roasterName: 'Old Roaster',
        logoData: 'source-logo',
        flavorPeriod: {
          light: { startDay: 1, endDay: 10 },
          medium: { startDay: 2, endDay: 20 },
          dark: { startDay: 3, endDay: 30 },
        },
        updatedAt: 31,
      },
      {
        roasterName: 'Unchanged Roaster',
        logoData: 'other-logo',
        updatedAt: 32,
      },
    ],
    futureSettingsField: { nested: ['untouched', true] },
  } as unknown as AppSettings;

  return { beans, notes, grinders, settings };
}

function makeEmptyRenameSettings(roasterName: string): AppSettings {
  return {
    username: 'fallback user',
    roasterConfigs: [{ roasterName, updatedAt: 1 }],
  } as AppSettings;
}

async function seedSqlite(
  driver: SqliteDriver,
  fixture: RenameFixture,
  options: { includeSettings?: boolean } = {}
): Promise<void> {
  const beans = createSqliteCoffeeBeanRepository(driver);
  const notes = createSqliteBrewingNoteRepository(driver);
  const grinders = createSqliteGrinderRepository(driver);
  const settings = createSqliteAppSettingsRepository(driver);

  for (const bean of [...fixture.beans].reverse()) await beans.save(bean);
  for (const note of [...fixture.notes].reverse()) await notes.save(note);
  for (const grinder of [...fixture.grinders].reverse()) {
    await grinders.save(grinder);
  }
  if (options.includeSettings !== false) await settings.save(fixture.settings);
}

async function seedDexie(
  database: RoasterRenameParityDatabase,
  fixture: RenameFixture,
  options: { includeSettings?: boolean } = {}
): Promise<void> {
  await database.coffeeBeans.bulkPut([...fixture.beans].reverse());
  await database.brewingNotes.bulkPut([...fixture.notes].reverse());
  await database.grinders.bulkPut([...fixture.grinders].reverse());
  if (options.includeSettings !== false) {
    await database.appSettings.put({ id: 'main', data: fixture.settings });
  }
}

async function readSqliteSnapshot(
  driver: SqliteDriver
): Promise<RenameSnapshot> {
  return {
    beans: await createSqliteCoffeeBeanRepository(driver).list(),
    notes: await createSqliteBrewingNoteRepository(driver).list(),
    grinders: await createSqliteGrinderRepository(driver).list(),
    settings: await createSqliteAppSettingsRepository(driver).get(),
  };
}

async function readDexieSnapshot(
  database: RoasterRenameParityDatabase
): Promise<RenameSnapshot> {
  return {
    beans: await database.coffeeBeans.toArray(),
    notes: await database.brewingNotes.toArray(),
    grinders: await database.grinders.toArray(),
    settings: (await database.appSettings.get('main'))?.data,
  };
}

function transformFixture(fixture: RenameFixture, settings = fixture.settings) {
  return transformRoasterRenameRecords({
    ...fixture,
    settings,
    renames: RENAMES,
    now: RENAME_NOW,
  });
}

function wrapSqliteDriver(
  driver: SqliteDriver,
  options: {
    failAt?: 'coffee_beans' | 'brewing_notes' | 'grinders' | 'app_settings';
    attemptedWrites?: string[];
  } = {}
): SqliteDriver {
  return {
    execute: (sql, params) => driver.execute(sql, params),
    query: (sql, params) => driver.query(sql, params),
    transaction<T>(work: (tx: SqliteExecutor) => Promise<T>): Promise<T> {
      return driver.transaction(tx =>
        work({
          query: (sql, params) => tx.query(sql, params),
          async execute(sql, params) {
            const table = /^\s*INSERT\s+INTO\s+([a-z_]+)/i.exec(sql)?.[1];
            if (table) {
              options.attemptedWrites?.push(table);
              if (table === options.failAt) {
                throw new Error(`Injected ${table} write failure`);
              }
            }
            return tx.execute(sql, params);
          },
        })
      );
    },
    close: () => driver.close(),
  };
}

async function readRawFourTables(
  driver: SqliteDriver
): Promise<Record<string, Record<string, unknown>[]>> {
  const result: Record<string, Record<string, unknown>[]> = {};
  for (const [table, key] of [
    ['coffee_beans', 'id'],
    ['brewing_notes', 'id'],
    ['grinders', 'id'],
    ['app_settings', 'id'],
  ] as const) {
    result[table] = await driver.query(
      `SELECT * FROM ${table} ORDER BY ${key} ASC`
    );
  }
  return result;
}

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;
const nodeSqliteLabel = supportsNodeSqlite()
  ? `real SQLite (node:sqlite, Node ${process.versions.node})`
  : `SKIPPED: node:sqlite unavailable on Node ${process.versions.node}; requires Node >=22.13`;

describeNodeSqlite(`${nodeSqliteLabel} RoasterRenamePersistence`, () => {
  let database: NodeSqliteTestDatabase | undefined;
  let dexieDatabase: RoasterRenameParityDatabase;

  const getDatabase = (): NodeSqliteTestDatabase => {
    if (!database) throw new Error('Node SQLite test database is not open');
    return database;
  };

  beforeEach(async () => {
    database = await createNodeSqliteTestDatabase();
    dexieDatabase = new RoasterRenameParityDatabase(
      `BrewGuideRoasterRenameParity-${Date.now()}-${Math.random()}`
    );
    await dexieDatabase.open();
  });

  afterEach(async () => {
    await dexieDatabase?.delete();
    await database?.close();
    database = undefined;
  });

  it('transforms and persists beans, notes, grinders, and settings using the shared domain function', async () => {
    const fixture = makeFixture();
    const driver = getDatabase().driver;
    await seedSqlite(driver, fixture);

    const expected = transformFixture(fixture);
    const result = await createSqliteRoasterRenamePersistence(
      driver
    ).renameReferences({
      renames: RENAMES,
      now: RENAME_NOW,
      getFallbackSettings: () => fixture.settings,
    });

    expect(result).toEqual(expected);
    expect(await readSqliteSnapshot(driver)).toEqual({
      beans: expected.beans,
      notes: expected.notes,
      grinders: expected.grinders,
      settings: expected.settings,
    });

    const renamedBean = (await createSqliteCoffeeBeanRepository(driver).get(
      'bean-a'
    )) as (CoffeeBean & { futureBeanField: unknown }) | undefined;
    expect(renamedBean).toMatchObject({
      name: 'Espresso',
      roaster: 'New Roaster',
      timestamp: RENAME_NOW,
      futureBeanField: { nested: ['kept', 1, null] },
    });
    expect(
      (await createSqliteBrewingNoteRepository(driver).get('note-a'))?.updatedAt
    ).toBe(RENAME_NOW);
    expect(
      (await createSqliteGrinderRepository(driver).list())[0]
        ?.grindSizeHistory?.[0]?.coffeeBeanRoaster
    ).toBe('New Roaster');
    expect(
      (await createSqliteAppSettingsRepository(driver).get())?.roasterConfigs
    ).toMatchObject([
      {
        roasterName: 'New Roaster',
        logoData: 'target-logo',
        flavorPeriod: {
          light: { startDay: 1, endDay: 10 },
        },
        updatedAt: RENAME_NOW,
      },
      { roasterName: 'Unchanged Roaster', logoData: 'other-logo' },
    ]);
    expect(result.updatedConfigCount).toBe(1);
  });

  it('matches Dexie final rows and ordering when records are inserted in reverse id order', async () => {
    const fixture = makeFixture();
    const driver = getDatabase().driver;
    await seedSqlite(driver, fixture);
    await seedDexie(dexieDatabase, fixture);

    const sqlitePersistence = createSqliteRoasterRenamePersistence(driver);
    const dexiePersistence = createDexieRoasterRenamePersistence(
      dexieDatabase as unknown as BrewGuideDB
    );
    const input = {
      renames: RENAMES,
      now: RENAME_NOW,
      getFallbackSettings: () => fixture.settings,
    };

    const [sqliteResult, dexieResult] = await Promise.all([
      sqlitePersistence.renameReferences(input),
      dexiePersistence.renameReferences(input),
    ]);

    expect(sqliteResult).toEqual(dexieResult);
    expect(await readSqliteSnapshot(driver)).toEqual(
      await readDexieSnapshot(dexieDatabase)
    );
    expect(
      (await readSqliteSnapshot(driver)).beans.map(bean => bean.id)
    ).toEqual(['bean-a', 'bean-m', 'bean-z']);
    expect(
      (await readSqliteSnapshot(driver)).notes.map(note => note.id)
    ).toEqual(['note-a', 'note-z']);
    expect(
      (await readSqliteSnapshot(driver)).grinders.map(grinder => grinder.id)
    ).toEqual(['grinder-a', 'grinder-z']);
  });

  it('keeps a missing main settings row absent when fallback settings have no matching config', async () => {
    const fixture = makeFixture();
    const driver = getDatabase().driver;
    await seedSqlite(driver, fixture, { includeSettings: false });
    const fallback = makeEmptyRenameSettings('Different Roaster');
    const attemptedWrites: string[] = [];
    const persistence = createSqliteRoasterRenamePersistence(
      wrapSqliteDriver(driver, { attemptedWrites })
    );
    const getFallbackSettings = vi.fn(() => fallback);

    const result = await persistence.renameReferences({
      renames: RENAMES,
      now: RENAME_NOW,
      getFallbackSettings,
    });

    expect(getFallbackSettings).toHaveBeenCalledOnce();
    expect(result.updatedConfigCount).toBe(0);
    expect(attemptedWrites).not.toContain('app_settings');
    expect(
      await createSqliteAppSettingsRepository(driver).get()
    ).toBeUndefined();
  });

  it('persists a renamed fallback config when main settings are absent and the transform changes it', async () => {
    const fixture = makeFixture();
    const driver = getDatabase().driver;
    await seedSqlite(driver, fixture, { includeSettings: false });
    const fallback = makeEmptyRenameSettings('Old Roaster');
    await seedDexie(dexieDatabase, fixture, { includeSettings: false });

    const input = {
      renames: RENAMES,
      now: RENAME_NOW,
      getFallbackSettings: () => fallback,
    };
    const [sqliteResult, dexieResult] = await Promise.all([
      createSqliteRoasterRenamePersistence(driver).renameReferences(input),
      createDexieRoasterRenamePersistence(
        dexieDatabase as unknown as BrewGuideDB
      ).renameReferences(input),
    ]);

    expect(sqliteResult).toEqual(dexieResult);
    expect(sqliteResult.updatedConfigCount).toBe(1);
    expect(await createSqliteAppSettingsRepository(driver).get()).toEqual(
      sqliteResult.settings
    );
    expect(await dexieDatabase.appSettings.get('main')).toEqual({
      id: 'main',
      data: sqliteResult.settings,
    });
  });

  it('does not write any table when the rename map matches no stored references', async () => {
    const fixture = makeFixture();
    const driver = getDatabase().driver;
    await seedSqlite(driver, fixture);
    const before = await readRawFourTables(driver);
    const attemptedWrites: string[] = [];

    const result = await createSqliteRoasterRenamePersistence(
      wrapSqliteDriver(driver, { attemptedWrites })
    ).renameReferences({
      renames: new Map([['No Such Roaster', 'Unused Target']]),
      now: RENAME_NOW,
      getFallbackSettings: () => fixture.settings,
    });

    expect(result.updatedBeans).toEqual([]);
    expect(result.updatedNotes).toEqual([]);
    expect(result.updatedGrinderCount).toBe(0);
    expect(result.updatedConfigCount).toBe(0);
    expect(attemptedWrites).toEqual([]);
    expect(await readRawFourTables(driver)).toEqual(before);
  });

  it.each([
    {
      failingTable: 'coffee_beans',
      expectedAttempts: ['coffee_beans'],
    },
    {
      failingTable: 'brewing_notes',
      expectedAttempts: ['coffee_beans', 'coffee_beans', 'brewing_notes'],
    },
    {
      failingTable: 'grinders',
      expectedAttempts: [
        'coffee_beans',
        'coffee_beans',
        'brewing_notes',
        'grinders',
      ],
    },
    {
      failingTable: 'app_settings',
      expectedAttempts: [
        'coffee_beans',
        'coffee_beans',
        'brewing_notes',
        'grinders',
        'grinders',
        'app_settings',
      ],
    },
  ] as const)(
    'rolls all four tables back when the $failingTable write fails',
    async ({ failingTable, expectedAttempts }) => {
      const fixture = makeFixture();
      const driver = getDatabase().driver;
      await seedSqlite(driver, fixture);
      const before = await readRawFourTables(driver);
      const attemptedWrites: string[] = [];
      const failingDriver = wrapSqliteDriver(driver, {
        failAt: failingTable,
        attemptedWrites,
      });

      await expect(
        createSqliteRoasterRenamePersistence(failingDriver).renameReferences({
          renames: RENAMES,
          now: RENAME_NOW,
          getFallbackSettings: () => fixture.settings,
        })
      ).rejects.toThrow(`Injected ${failingTable} write failure`);

      expect(attemptedWrites).toEqual(expectedAttempts);
      expect(await readRawFourTables(driver)).toEqual(before);
    }
  );

  it('rejects corrupt codec rows without modifying any table', async () => {
    const fixture = makeFixture();
    const driver = getDatabase().driver;
    await seedSqlite(driver, fixture);
    await driver.execute(
      'UPDATE coffee_beans SET record_json = ? WHERE id = ?',
      ['{', 'bean-a']
    );
    const before = await readRawFourTables(driver);

    await expect(
      createSqliteRoasterRenamePersistence(driver).renameReferences({
        renames: RENAMES,
        now: RENAME_NOW,
        getFallbackSettings: () => fixture.settings,
      })
    ).rejects.toThrow(/JSON/i);

    expect(await readRawFourTables(driver)).toEqual(before);
  });

  it('does not strip an inline image field when a renamed bean reaches subject persistence', async () => {
    const fixture = makeFixture();
    const driver = getDatabase().driver;
    const sourceBean = fixture.beans[0];
    await driver.execute(
      `INSERT INTO coffee_beans (id, timestamp_ms, record_json)
       VALUES (?, ?, ?)`,
      [
        sourceBean.id,
        sourceBean.timestamp,
        JSON.stringify({ ...sourceBean, image: null }),
      ]
    );
    await createSqliteAppSettingsRepository(driver).save(fixture.settings);
    const before = await readRawFourTables(driver);

    await expect(
      createSqliteRoasterRenamePersistence(driver).renameReferences({
        renames: RENAMES,
        now: RENAME_NOW,
        getFallbackSettings: () => fixture.settings,
      })
    ).rejects.toThrow(/CoffeeBeanRepository.*image/);

    expect(await readRawFourTables(driver)).toEqual(before);
  });
});
