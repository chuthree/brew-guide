import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrewGuideDB } from '@/lib/core/db';
import { createDexieDataImportPersistence } from './adapters/dexie/dataImportPersistence';
import { createSqliteRuntimeRepositories } from './sqlite/runtimeRepositories';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from './sqlite/repositories/testing/nodeSqliteTestDriver';
import type { DataImportPlan } from './importData';
import type { NativeImageFileStore } from './images/nativeImageFileStore';
import { defaultSettings } from '@/lib/settings/defaultSettings';

const backup = (value: string): DataImportPlan => ({
  coffeeBeans: [
    {
      id: 'bean',
      name: value,
      timestamp: 1,
      image: `data:image/png;base64,${value === 'old' ? 'AQID' : 'BAUG'}`,
    },
  ],
  brewingNotes: [
    {
      id: 'note',
      timestamp: 1,
      rating: 4,
      notes: value,
      taste: {},
      params: {},
    },
  ],
  grinders: [{ id: 'grinder', name: value }],
  customEquipments: [
    {
      id: 'equipment',
      name: value,
      animationType: 'pour',
      isCustom: true,
    } as never,
  ],
  methods: [
    {
      equipmentId: 'equipment',
      methods: [{ id: 'method', name: value } as never],
    },
  ],
  settings: {
    ...defaultSettings,
    username: value,
    customPresets: { origins: [value] },
  },
  legacy: { onboardingCompleted: value, brewingNotesVersion: value },
});

describe('atomic SQLite backup import', () => {
  let database: NodeSqliteTestDatabase;
  let files: Map<string, Uint8Array>;
  let fileStore: NativeImageFileStore;
  let repositories: ReturnType<typeof createSqliteRuntimeRepositories>;
  const tables = [
    'coffee_beans',
    'coffee_bean_images',
    'brewing_notes',
    'brewing_note_images',
    'custom_equipments',
    'custom_methods',
    'grinders',
    'app_settings',
    'legacy_settings',
  ];
  const snapshot = () =>
    Promise.all(
      tables.map(table => database.driver.query(`SELECT * FROM ${table}`))
    );
  beforeEach(async () => {
    database = await createNodeSqliteTestDatabase();
    files = new Map();
    fileStore = {
      async write(key, bytes) {
        if (files.has(key)) throw new Error('collision');
        files.set(key, bytes.slice());
      },
      async read(key) {
        if (!files.has(key)) throw new Error('missing');
        return files.get(key)!.slice();
      },
      async delete(key) {
        files.delete(key);
      },
      async exists(key) {
        return files.has(key);
      },
      async listObjectKeys() {
        return [...files.keys()];
      },
    };
    repositories = createSqliteRuntimeRepositories(database.driver, fileStore);
    await repositories.dataImportPersistence.importData(backup('old'));
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    await database.close();
  });

  it('rolls back records, images, settings, presets, methods and preferences on the final write', async () => {
    await database.driver.execute(
      "ALTER TABLE legacy_settings ADD COLUMN import_guard INTEGER CHECK (value != 'new' OR key != 'brewingNotesVersion')"
    );
    const before = await snapshot();
    const oldFiles = new Map(files);
    await expect(
      repositories.dataImportPersistence.importData(backup('new'))
    ).rejects.toThrow('CHECK constraint failed');
    expect(await snapshot()).toEqual(before);
    expect(files).toEqual(oldFiles);
  });

  it('keeps original records and files when writing a new image fails', async () => {
    const before = await snapshot();
    const oldFiles = new Map(files);
    vi.spyOn(fileStore, 'write').mockRejectedValueOnce(new Error('disk full'));
    await expect(
      repositories.dataImportPersistence.importData(backup('new'))
    ).rejects.toThrow('disk full');
    expect(await snapshot()).toEqual(before);
    expect(files).toEqual(oldFiles);
  });

  it('keeps old files until commit and removes only unreferenced files afterwards', async () => {
    const oldKeys = [...files.keys()];
    const transaction = database.driver.transaction.bind(database.driver);
    vi.spyOn(database.driver, 'transaction').mockImplementation(work =>
      transaction(async tx => {
        const result = await work(tx);
        for (const key of oldKeys) expect(files.has(key)).toBe(true);
        return result;
      })
    );
    await repositories.dataImportPersistence.importData(backup('new'));
    expect((await repositories.appSettingsRepository.get())?.username).toBe(
      'new'
    );
    expect(
      (await repositories.coffeeBeanImageRepository.exportAll())[0].image
    ).toBe(backup('new').coffeeBeans![0].image);
    for (const key of oldKeys) expect(files.has(key)).toBe(false);
    expect(files.size).toBe(1);
  });

  it('retains all files when rollback status is uncertain', async () => {
    const originalFiles = new Map(files);
    const failure = Object.assign(new Error('rollback status unknown'), {
      rollbackDiagnostic: new Error('connection lost'),
    });
    const transaction = database.driver.transaction.bind(database.driver);
    vi.spyOn(database.driver, 'transaction').mockImplementation(work =>
      transaction(async tx => {
        await work(tx);
        throw failure;
      })
    );
    await expect(
      repositories.dataImportPersistence.importData(backup('new'))
    ).rejects.toBe(failure);
    for (const [key, value] of originalFiles)
      expect(files.get(key)).toEqual(value);
    expect(files.size).toBeGreaterThan(originalFiles.size);
  });

  it('does not report a committed import as failed if obsolete file cleanup fails', async () => {
    vi.spyOn(fileStore, 'delete').mockRejectedValue(
      new Error('cleanup unavailable')
    );
    await expect(
      repositories.dataImportPersistence.importData(backup('new'))
    ).resolves.toBeUndefined();
    expect(
      (await repositories.appSettingsRepository.get())?.customPresets
    ).toEqual({ origins: ['new'] });
    expect(
      (await repositories.coffeeBeanImageRepository.exportAll())[0].name
    ).toBe('new');
  });
});

describe('atomic IndexedDB backup import', () => {
  let database: BrewGuideDB;
  beforeEach(async () => {
    database = new BrewGuideDB();
    await database.delete();
    await database.open();
  });
  afterEach(async () => {
    await database.delete();
  });
  const snapshot = () =>
    Promise.all(database.tables.map(table => table.toArray()));

  it('rolls back every table when a late settings write fails, including after reopening', async () => {
    const importer = createDexieDataImportPersistence(database);
    await importer.importData(backup('old'));
    const before = await snapshot();
    const reject = (_changes: unknown, key: string) => {
      if (key === 'brewingNotesVersion') throw new Error('quota exceeded');
    };
    database.settings.hook('updating', reject);
    await expect(importer.importData(backup('new'))).rejects.toThrow(
      'quota exceeded'
    );
    database.settings.hook('updating').unsubscribe(reject);
    database.close();
    await database.open();
    expect(await snapshot()).toEqual(before);
  });

  it('commits the complete backup, and treats explicit empty arrays as replacements', async () => {
    const importer = createDexieDataImportPersistence(database);
    await importer.importData(backup('old'));
    await importer.importData(backup('new'));
    expect(
      (await database.appSettings.get('main'))?.data.customPresets
    ).toEqual({ origins: ['new'] });
    expect((await database.grinders.get('grinder'))?.name).toBe('new');
    await importer.importData({
      coffeeBeans: [],
      brewingNotes: [],
      methods: [],
      legacy: {},
    });
    expect(await database.coffeeBeans.count()).toBe(0);
    expect(await database.coffeeBeanImages.count()).toBe(0);
    expect(await database.brewingNotes.count()).toBe(0);
    expect(await database.customMethods.count()).toBe(0);
  });
});
