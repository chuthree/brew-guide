import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import type { SqliteDriver, SqliteExecutor } from './driver';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
  type NodeSqliteTestDatabase,
} from './repositories/testing/nodeSqliteTestDriver';
import {
  LEGACY_DEXIE_MIGRATION_ID,
  runLegacySqliteMigration,
} from './legacyMigrationExecutor';
import { readLegacyMigrationSource } from './legacyMigrationSource';
import { createSqliteImageDataServices } from './imageDataServices';
import { createSqliteBrewingNoteRepository } from './repositories/brewingNote';
import { createSqliteCoffeeBeanRepository } from './repositories/coffeeBean';

const LEGACY_DATABASE_NAME = 'BrewGuideDB';
const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;
const nodeSqliteLabel = supportsNodeSqlite()
  ? `real SQLite (node:sqlite, Node ${process.versions.node})`
  : `SKIPPED: node:sqlite unavailable on Node ${process.versions.node}`;

interface LegacySnapshot {
  version: number;
  tables: Array<{
    name: string;
    keyPath: string | string[] | null;
    autoIncrement: boolean;
    indexes: Array<{
      name: string;
      keyPath: string | string[];
      unique: boolean;
      multiEntry: boolean;
    }>;
    records: string;
  }>;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function snapshotLegacyDatabase(): Promise<LegacySnapshot> {
  const database = await requestResult(indexedDB.open(LEGACY_DATABASE_NAME));
  const names = Array.from(database.objectStoreNames).sort();
  const transaction = database.transaction(names, 'readonly');
  const finished = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
  const tables = await Promise.all(
    names.map(async name => {
      const store = transaction.objectStore(name);
      const records = await requestResult(store.getAll());
      const indexes = Array.from(store.indexNames)
        .sort()
        .map(indexName => {
          const index = store.index(indexName);
          return {
            name: index.name,
            keyPath: index.keyPath as string | string[],
            unique: index.unique,
            multiEntry: index.multiEntry,
          };
        });
      return {
        name,
        keyPath: store.keyPath as string | string[] | null,
        autoIncrement: store.autoIncrement,
        indexes,
        records: JSON.stringify(records),
      };
    })
  );
  await finished;
  const snapshot = { version: database.version, tables };
  database.close();
  return snapshot;
}

async function legacyDatabaseExists(): Promise<boolean> {
  return (await indexedDB.databases()).some(
    database => database.name === LEGACY_DATABASE_NAME
  );
}

async function deleteLegacyDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LEGACY_DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Legacy fixture is blocked'));
  });
}

async function createLegacyV8Fixture(
  options: {
    invalidBeanImage?: boolean;
    noteRating?: unknown;
    omitNoteRating?: boolean;
  } = {}
): Promise<void> {
  const legacy = new Dexie(LEGACY_DATABASE_NAME);
  legacy.version(8).stores({
    brewingNotes:
      'id, timestamp, equipment, method, beanId, [beanId+timestamp]',
    coffeeBeans: 'id, timestamp, name, type',
    coffeeBeanImages: 'beanId, updatedAt',
    coffeeBeanImageThumbnails: 'beanId, updatedAt',
    settings: 'key',
    customEquipments: 'id, name',
    customMethods: 'equipmentId',
    grinders: 'id, name',
    yearlyReports: 'id, year, createdAt',
    appSettings: 'id',
    pendingOperations: 'id, table, recordId, timestamp',
  });
  await legacy.open();
  try {
    await legacy.transaction(
      'rw',
      [
        legacy.table('coffeeBeans'),
        legacy.table('coffeeBeanImages'),
        legacy.table('coffeeBeanImageThumbnails'),
        legacy.table('brewingNotes'),
        legacy.table('customEquipments'),
        legacy.table('customMethods'),
        legacy.table('grinders'),
        legacy.table('appSettings'),
        legacy.table('settings'),
        legacy.table('pendingOperations'),
        legacy.table('yearlyReports'),
      ],
      async () => {
        await legacy.table('coffeeBeans').add({
          id: 'legacy-bean',
          timestamp: 1_700_000_000_000,
          name: 'Legacy Ethiopia',
          type: 'light',
          beanType: 'washed',
          futureBeanField: { retained: true },
        });
        await legacy.table('coffeeBeanImages').add({
          beanId: 'legacy-bean',
          image: options.invalidBeanImage
            ? 'blob:unrecoverable'
            : 'data:image/png;base64,AQID',
          backImage: 'https://Example.test/back.jpg?sig=Exact%2fValue',
          updatedAt: 1_700_000_000_001,
        });
        await legacy.table('coffeeBeanImageThumbnails').add({
          beanId: 'legacy-bean',
          imageThumbnail: 'data:image/webp;base64,BAUG',
          updatedAt: 1_700_000_000_002,
        });
        const note: Record<string, unknown> = {
          id: 'legacy-note',
          timestamp: 1_700_000_001_000,
          updatedAt: 1_700_000_001_100,
          notes: '保留原始记录',
          taste: { citrus: 4 },
          beanId: 'legacy-bean',
          images: [
            'data:image/jpeg;base64,BwgJ',
            'https://images.example.test/note.jpg?sig=exact',
            'data:image/jpeg;base64,BwgJ',
          ],
        };
        if (!options.omitNoteRating) {
          note.rating = Object.prototype.hasOwnProperty.call(
            options,
            'noteRating'
          )
            ? options.noteRating
            : 4;
        }
        await legacy.table('brewingNotes').add(note);
        await legacy.table('customEquipments').add({
          id: 'legacy-equipment',
          name: 'Old Dripper',
          animationType: 'pour',
          isCustom: true,
          svg: '<svg>保留</svg>',
        });
        await legacy.table('customMethods').add({
          equipmentId: 'legacy-equipment',
          methods: [{ id: 'method-1', name: 'Slow pour' }],
          futureMethodField: { retained: true },
        });
        await legacy.table('appSettings').add({
          id: 'main',
          data: { theme: 'light', roasterConfigs: [] },
        });
        await legacy.table('settings').bulkAdd([
          { key: 'v4_migrated', value: 'true' },
          {
            key: 'customMethods_legacy-equipment',
            value: '{"methods":["legacy raw value"]}',
          },
        ]);
        await legacy.table('pendingOperations').add({
          id: 'legacy-op',
          table: 'coffeeBeans',
          type: 'upsert',
          recordId: 'legacy-bean',
          timestamp: 1_700_000_002_000,
          retryCount: 2,
          data: { name: 'Legacy Ethiopia' },
          lastError: 'kept for retry',
          failedAt: 1_700_000_002_100,
          futureQueueField: { retained: true },
        });
        await legacy.table('yearlyReports').add({
          id: 'legacy-report-2024',
          year: 2024,
          username: '咖啡师',
          content: '第一行\nExact report：保留。',
          createdAt: 1_700_000_003_000,
          futureReportField: ['retained'],
        });
      }
    );
  } finally {
    legacy.close();
  }
}

class MemoryImageFileStore implements NativeImageFileStore {
  readonly objects = new Map<string, Uint8Array>();
  beforeWrite?: (objectKey: string) => Promise<void>;
  writeCount = 0;
  deleteCount = 0;

  async write(objectKey: string, bytes: Uint8Array): Promise<void> {
    if (this.objects.has(objectKey)) {
      throw new Error('Image object already exists');
    }
    await this.beforeWrite?.(objectKey);
    this.objects.set(objectKey, new Uint8Array(bytes));
    this.writeCount += 1;
  }

  async read(objectKey: string): Promise<Uint8Array> {
    const bytes = this.objects.get(objectKey);
    if (!bytes) throw new Error('Image object is missing');
    return new Uint8Array(bytes);
  }

  async delete(objectKey: string): Promise<void> {
    this.deleteCount += 1;
    this.objects.delete(objectKey);
  }

  async exists(objectKey: string): Promise<boolean> {
    return this.objects.has(objectKey);
  }

  async listObjectKeys(): Promise<string[]> {
    return [...this.objects.keys()].sort();
  }
}

class PartialWriteImageFileStore extends MemoryImageFileStore {
  private leavePartialObject = true;

  override async write(objectKey: string, bytes: Uint8Array): Promise<void> {
    if (this.leavePartialObject) {
      this.leavePartialObject = false;
      this.objects.set(objectKey, new Uint8Array([0xff]));
      throw new Error('Injected interrupted image file write');
    }
    await super.write(objectKey, bytes);
  }
}

class LostWriteAcknowledgementFileStore extends MemoryImageFileStore {
  private loseNextAcknowledgement = true;

  override async write(objectKey: string, bytes: Uint8Array): Promise<void> {
    await super.write(objectKey, bytes);
    if (this.loseNextAcknowledgement) {
      this.loseNextAcknowledgement = false;
      throw new Error('Injected lost file write acknowledgement');
    }
  }
}

function sourceStorage(values: Record<string, string | null> = {}) {
  return {
    getItem(key: string) {
      return values[key] ?? null;
    },
  };
}

function queryCount(driver: SqliteExecutor, table: string): Promise<number> {
  return driver
    .query(`SELECT COUNT(*) AS count FROM ${table}`)
    .then(rows => Number(rows[0]?.count ?? 0));
}

function driverWithTransactionFailure(
  base: SqliteDriver,
  mode: 'before' | 'after'
): SqliteDriver {
  let transactionCount = 0;
  return {
    execute: (sql, params) => base.execute(sql, params),
    query: (sql, params) => base.query(sql, params),
    async transaction<T>(work: (tx: SqliteExecutor) => Promise<T>): Promise<T> {
      transactionCount += 1;
      if (transactionCount !== 2) return base.transaction(work);
      if (mode === 'before') {
        throw new Error('Injected transaction failure before target commit');
      }
      const result = await base.transaction(work);
      throw new Error('Injected lost acknowledgement after target commit', {
        cause: result,
      });
    },
    close: () => base.close(),
  };
}

const legacyLocalStorage = {
  brewGuideSettings: JSON.stringify({
    state: {
      settings: {
        theme: 'dark',
        grinders: [{ id: 'legacy-grinder', name: 'C40', grindSizeHistory: [] }],
      },
    },
    version: 2,
  }),
  'roaster-logos':
    '[{"roasterName":"Legacy Roaster","logoData":"data:image/png;base64,AQID"}]',
  customFlavorDimensions: null,
  flavorDimensionHistoricalLabels: null,
  equipmentOrder: null,
};

describeNodeSqlite(`${nodeSqliteLabel} legacy migration executor`, () => {
  let database: NodeSqliteTestDatabase | undefined;

  beforeEach(async () => {
    await deleteLegacyDatabase();
    database = await createNodeSqliteTestDatabase();
  });

  afterEach(async () => {
    await database?.close();
    database = undefined;
    await deleteLegacyDatabase();
  });

  it('migrates a real v8 IndexedDB snapshot and proves the source stays unchanged', async () => {
    await createLegacyV8Fixture({ noteRating: null });
    const before = await snapshotLegacyDatabase();
    const fileStore = new MemoryImageFileStore();
    fileStore.beforeWrite = async () => {
      expect(await queryCount(database!.driver, 'coffee_beans')).toBe(0);
      expect(await queryCount(database!.driver, 'brewing_notes')).toBe(0);
      expect(await queryCount(database!.driver, 'coffee_bean_images')).toBe(0);
      expect(await queryCount(database!.driver, 'brewing_note_images')).toBe(0);
    };

    const result = await runLegacySqliteMigration({
      driver: database!.driver,
      imageFileStore: fileStore,
      loadSource: () =>
        readLegacyMigrationSource(sourceStorage(legacyLocalStorage)),
    });

    expect(result).toEqual({ status: 'migrated', sourceVersion: 8 });
    expect(fileStore.writeCount).toBe(4);
    expect(await queryCount(database!.driver, 'coffee_beans')).toBe(1);
    expect(await queryCount(database!.driver, 'brewing_notes')).toBe(1);
    expect(await queryCount(database!.driver, 'coffee_bean_images')).toBe(3);
    expect(await queryCount(database!.driver, 'brewing_note_images')).toBe(3);
    expect(await queryCount(database!.driver, 'custom_equipments')).toBe(1);
    expect(await queryCount(database!.driver, 'custom_methods')).toBe(1);
    expect(await queryCount(database!.driver, 'grinders')).toBe(1);
    expect(await queryCount(database!.driver, 'app_settings')).toBe(1);
    expect(await queryCount(database!.driver, 'legacy_settings')).toBe(2);
    expect(await queryCount(database!.driver, 'pending_operations')).toBe(1);
    expect(
      await queryCount(database!.driver, 'historical_yearly_reports')
    ).toBe(1);

    const bean = await database!.driver.query(
      'SELECT record_json FROM coffee_beans WHERE id = ?',
      ['legacy-bean']
    );
    expect(JSON.parse(String(bean[0]?.record_json))).toMatchObject({
      type: 'light',
      beanType: 'washed',
      futureBeanField: { retained: true },
    });
    expect(JSON.parse(String(bean[0]?.record_json))).not.toHaveProperty(
      'image'
    );
    const note = await database!.driver.query(
      'SELECT record_json FROM brewing_notes WHERE id = ?',
      ['legacy-note']
    );
    expect(JSON.parse(String(note[0]?.record_json))).toMatchObject({
      rating: 0,
    });
    expect(
      (
        await database!.driver.query(
          'SELECT external_url FROM coffee_bean_images WHERE source_kind = ?',
          ['external']
        )
      )[0]?.external_url
    ).toBe('https://Example.test/back.jpg?sig=Exact%2fValue');
    expect(
      (
        await database!.driver.query(
          'SELECT content FROM historical_yearly_reports WHERE id = ?',
          ['legacy-report-2024']
        )
      )[0]?.content
    ).toBe('第一行\nExact report：保留。');
    expect(
      (
        await database!.driver.query(
          'SELECT status FROM migration_state WHERE id = ?',
          [LEGACY_DEXIE_MIGRATION_ID]
        )
      )[0]?.status
    ).toBe('completed');

    const imageServices = createSqliteImageDataServices(
      database!.driver,
      fileStore
    );
    const beans = await createSqliteCoffeeBeanRepository(
      database!.driver
    ).list();
    const notes = await createSqliteBrewingNoteRepository(
      database!.driver
    ).list();
    const reconstructedBean = (
      await imageServices.coffeeBeanImageRepository.mergeBeans(beans)
    )[0];
    const reconstructedNote = (
      await imageServices.brewingNoteImageRepository.mergeNotes(notes)
    )[0];
    expect(reconstructedBean).toMatchObject({
      image: 'data:image/png;base64,AQID',
      backImage: 'https://Example.test/back.jpg?sig=Exact%2fValue',
    });
    expect(reconstructedNote).toMatchObject({
      image: 'data:image/jpeg;base64,BwgJ',
      images: [
        'data:image/jpeg;base64,BwgJ',
        'https://images.example.test/note.jpg?sig=exact',
        'data:image/jpeg;base64,BwgJ',
      ],
    });

    const after = await snapshotLegacyDatabase();
    expect(after).toEqual(before);
    expect(after.version).toBe(80);
    expect(after.tables.map(table => table.name)).toContain('yearlyReports');
    expect(await legacyDatabaseExists()).toBe(true);

    const loadSource = vi.fn(async () => {
      throw new Error('Completed migration must not reread its source');
    });
    await expect(
      runLegacySqliteMigration({
        driver: database!.driver,
        imageFileStore: fileStore,
        loadSource,
      })
    ).resolves.toEqual({ status: 'already-completed' });
    expect(loadSource).not.toHaveBeenCalled();
  });

  it('resumes a failed pre-commit attempt without overwriting files or duplicating rows', async () => {
    await createLegacyV8Fixture({ noteRating: null });
    const sourceBefore = await snapshotLegacyDatabase();
    const base = database!.driver;
    const flakyDriver = driverWithTransactionFailure(base, 'before');
    const fileStore = new MemoryImageFileStore();
    const loadSource = () =>
      readLegacyMigrationSource(sourceStorage(legacyLocalStorage));
    const options = {
      driver: flakyDriver,
      imageFileStore: fileStore,
      loadSource,
    };

    await expect(runLegacySqliteMigration(options)).rejects.toThrow(
      'Injected transaction failure before target commit'
    );
    expect(await queryCount(base, 'coffee_beans')).toBe(0);
    expect(await queryCount(base, 'coffee_bean_images')).toBe(0);
    expect(
      (await base.query('SELECT status FROM migration_state'))[0]?.status
    ).toBe('failed');
    const keysAfterFailure = await fileStore.listObjectKeys();
    expect(keysAfterFailure).toHaveLength(4);

    await expect(runLegacySqliteMigration(options)).resolves.toEqual({
      status: 'migrated',
      sourceVersion: 8,
    });
    expect(fileStore.writeCount).toBe(4);
    expect(await fileStore.listObjectKeys()).toEqual(keysAfterFailure);
    expect(await queryCount(base, 'coffee_beans')).toBe(1);
    expect(await queryCount(base, 'coffee_bean_images')).toBe(3);
    expect(
      (await base.query('SELECT status FROM migration_state'))[0]?.status
    ).toBe('completed');
    expect(await snapshotLegacyDatabase()).toEqual(sourceBefore);
  });

  it('rejects malformed non-null ratings before any target or image write', async () => {
    await createLegacyV8Fixture({ noteRating: 'unrated' });
    const sourceBefore = await snapshotLegacyDatabase();
    const fileStore = new MemoryImageFileStore();

    await expect(
      runLegacySqliteMigration({
        driver: database!.driver,
        imageFileStore: fileStore,
        loadSource: () =>
          readLegacyMigrationSource(sourceStorage(legacyLocalStorage)),
      })
    ).rejects.toThrow(
      /brewing_notes record legacy-note at rating: expected a finite number/
    );

    expect(await queryCount(database!.driver, 'migration_state')).toBe(0);
    expect(await queryCount(database!.driver, 'coffee_beans')).toBe(0);
    expect(await queryCount(database!.driver, 'brewing_notes')).toBe(0);
    expect(fileStore.writeCount).toBe(0);
    expect(await snapshotLegacyDatabase()).toEqual(sourceBefore);
  });

  it('recovers an uncertain FileStore write only after byte-identical read-back', async () => {
    await createLegacyV8Fixture();
    const fileStore = new LostWriteAcknowledgementFileStore();

    await expect(
      runLegacySqliteMigration({
        driver: database!.driver,
        imageFileStore: fileStore,
        loadSource: () =>
          readLegacyMigrationSource(sourceStorage(legacyLocalStorage)),
      })
    ).resolves.toEqual({ status: 'migrated', sourceVersion: 8 });

    expect(fileStore.writeCount).toBe(4);
    expect(await queryCount(database!.driver, 'coffee_beans')).toBe(1);
    expect(await queryCount(database!.driver, 'coffee_bean_images')).toBe(3);
  });

  it('repairs an interrupted partial file only while no SQLite row references it', async () => {
    await createLegacyV8Fixture();
    const fileStore = new PartialWriteImageFileStore();
    const options = {
      driver: database!.driver,
      imageFileStore: fileStore,
      loadSource: () =>
        readLegacyMigrationSource(sourceStorage(legacyLocalStorage)),
    };

    await expect(runLegacySqliteMigration(options)).rejects.toThrow(
      'Injected interrupted image file write'
    );
    expect(await fileStore.listObjectKeys()).toHaveLength(1);
    expect(await queryCount(database!.driver, 'coffee_bean_images')).toBe(0);
    expect(await queryCount(database!.driver, 'brewing_note_images')).toBe(0);

    vi.spyOn(fileStore, 'read').mockRejectedValueOnce(
      new Error('Injected unreadable partial file')
    );
    await expect(runLegacySqliteMigration(options)).resolves.toEqual({
      status: 'migrated',
      sourceVersion: 8,
    });
    expect(fileStore.deleteCount).toBe(1);
    expect(fileStore.writeCount).toBe(4);
    expect(await queryCount(database!.driver, 'coffee_bean_images')).toBe(3);
  });

  it('uses read-back after a lost SQLite commit acknowledgement', async () => {
    await createLegacyV8Fixture();
    const base = database!.driver;
    const uncertainDriver = driverWithTransactionFailure(base, 'after');
    const fileStore = new MemoryImageFileStore();

    await expect(
      runLegacySqliteMigration({
        driver: uncertainDriver,
        imageFileStore: fileStore,
        loadSource: () =>
          readLegacyMigrationSource(sourceStorage(legacyLocalStorage)),
      })
    ).resolves.toEqual({ status: 'migrated', sourceVersion: 8 });

    expect(await queryCount(base, 'coffee_beans')).toBe(1);
    expect(await queryCount(base, 'brewing_notes')).toBe(1);
    expect(await queryCount(base, 'coffee_bean_images')).toBe(3);
    expect(await queryCount(base, 'brewing_note_images')).toBe(3);
    expect(
      (await base.query('SELECT status FROM migration_state'))[0]?.status
    ).toBe('completed');
  });

  it('never deletes a differing file after SQLite metadata has committed', async () => {
    await createLegacyV8Fixture();
    const fileStore = new MemoryImageFileStore();
    const driver = database!.driver;
    const options = {
      driver,
      imageFileStore: fileStore,
      loadSource: () =>
        readLegacyMigrationSource(sourceStorage(legacyLocalStorage)),
    };
    await expect(runLegacySqliteMigration(options)).resolves.toMatchObject({
      status: 'migrated',
    });

    const [objectKey] = await fileStore.listObjectKeys();
    fileStore.objects.set(objectKey, new Uint8Array([0xff]));
    await driver.execute(
      `UPDATE migration_state SET status = 'in_progress' WHERE id = ?`,
      [LEGACY_DEXIE_MIGRATION_ID]
    );

    await expect(runLegacySqliteMigration(options)).rejects.toThrow(
      /already referenced by SQLite/
    );
    expect(fileStore.deleteCount).toBe(0);
    expect(await queryCount(driver, 'coffee_bean_images')).toBe(3);
    expect(
      (await driver.query('SELECT status FROM migration_state'))[0]?.status
    ).toBe('in_progress');
  });

  it('fails closed on unowned target rows before reading or mutating legacy data', async () => {
    const base = database!.driver;
    await base.execute(
      'INSERT INTO coffee_beans (id, timestamp_ms, record_json) VALUES (?, ?, ?)',
      ['native-bean', 1_700_000_000_000, '{"id":"native-bean"}']
    );
    const loadSource = vi.fn(async () => {
      throw new Error(
        'Legacy source must not be opened for an occupied target'
      );
    });

    await expect(
      runLegacySqliteMigration({
        driver: base,
        imageFileStore: new MemoryImageFileStore(),
        loadSource,
      })
    ).rejects.toThrow(
      'SQLite target contains data without a migration ownership marker'
    );
    expect(loadSource).not.toHaveBeenCalled();
    expect(await queryCount(base, 'coffee_beans')).toBe(1);
    expect(await queryCount(base, 'migration_state')).toBe(0);
  });

  it('preflights every image before creating migration state or writing targets', async () => {
    await createLegacyV8Fixture({ invalidBeanImage: true });
    const before = await snapshotLegacyDatabase();
    const fileStore = new MemoryImageFileStore();

    await expect(
      runLegacySqliteMigration({
        driver: database!.driver,
        imageFileStore: fileStore,
        loadSource: () =>
          readLegacyMigrationSource(sourceStorage(legacyLocalStorage)),
      })
    ).rejects.toThrow(/coffeeBeanImages.*supported image/);

    expect(await queryCount(database!.driver, 'migration_state')).toBe(0);
    expect(await queryCount(database!.driver, 'coffee_beans')).toBe(0);
    expect(await queryCount(database!.driver, 'brewing_notes')).toBe(0);
    expect(await queryCount(database!.driver, 'coffee_bean_images')).toBe(0);
    expect(await queryCount(database!.driver, 'brewing_note_images')).toBe(0);
    expect(fileStore.writeCount).toBe(0);
    expect(await snapshotLegacyDatabase()).toEqual(before);
  });

  it('records an absent-source fresh install without creating BrewGuideDB', async () => {
    expect(await legacyDatabaseExists()).toBe(false);
    const fileStore = new MemoryImageFileStore();
    const options = {
      driver: database!.driver,
      imageFileStore: fileStore,
      loadSource: () => readLegacyMigrationSource(sourceStorage()),
    };

    await expect(runLegacySqliteMigration(options)).resolves.toEqual({
      status: 'fresh-install',
    });
    expect(await legacyDatabaseExists()).toBe(false);
    expect(
      (
        await database!.driver.query(
          'SELECT status, source_presence_json, details_json FROM migration_state WHERE id = ?',
          [LEGACY_DEXIE_MIGRATION_ID]
        )
      )[0]
    ).toMatchObject({ status: 'completed' });
    await expect(runLegacySqliteMigration(options)).resolves.toEqual({
      status: 'already-completed',
    });
    expect(await legacyDatabaseExists()).toBe(false);
  });
});
