import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  openLegacyDexieReader,
  type LegacySourceTableName,
} from './legacyDexieReader';

const DATABASE_NAME = 'BrewGuideDB';

interface FixtureIndex {
  name: string;
  keyPath: string | string[];
  unique?: boolean;
  multiEntry?: boolean;
}

interface FixtureStore {
  keyPath: string | string[];
  autoIncrement?: boolean;
  indexes?: FixtureIndex[];
  records?: Record<string, unknown>[];
}

interface TableSnapshot {
  name: string;
  primaryKey: {
    keyPath: string | string[] | null;
    autoIncrement: boolean;
  };
  indexes: Array<{
    name: string;
    keyPath: string | string[];
    unique: boolean;
    multiEntry: boolean;
  }>;
  serializedRecords: string;
}

interface DatabaseSnapshot {
  version: number;
  tables: TableSnapshot[];
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function serializeValue(value: unknown): Promise<unknown> {
  if (value === undefined) return { type: 'undefined' };
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? value
      : { type: 'number', value: String(value) };
  }
  if (typeof value === 'bigint')
    return { type: 'bigint', value: String(value) };
  if (value instanceof Date) {
    return { type: 'date', value: value.toISOString() };
  }
  if (value instanceof Blob) {
    return {
      type: 'blob',
      mimeType: value.type,
      bytes: Array.from(new Uint8Array(await value.arrayBuffer())),
    };
  }
  if (value instanceof ArrayBuffer) {
    return { type: 'arraybuffer', bytes: Array.from(new Uint8Array(value)) };
  }
  if (ArrayBuffer.isView(value)) {
    return {
      type: value.constructor.name,
      bytes: Array.from(
        new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      ),
    };
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map(serializeValue));
  }
  if (typeof value === 'object') {
    const entries = await Promise.all(
      Object.keys(value)
        .sort()
        .map(async key => [
          key,
          await serializeValue((value as Record<string, unknown>)[key]),
        ])
    );
    return Object.fromEntries(entries);
  }
  return String(value);
}

async function serializeRecords(records: unknown[]): Promise<string> {
  return JSON.stringify(await serializeValue(records));
}

async function createFixture(
  dexieVersion: number,
  stores: Record<string, FixtureStore>
): Promise<void> {
  // Dexie stores its declared version multiplied by ten in IndexedDB.
  const openRequest = indexedDB.open(DATABASE_NAME, dexieVersion * 10);
  openRequest.onupgradeneeded = () => {
    const database = openRequest.result;
    for (const [name, definition] of Object.entries(stores)) {
      const objectStore = database.createObjectStore(name, {
        keyPath: definition.keyPath,
        autoIncrement: definition.autoIncrement ?? false,
      });

      for (const index of definition.indexes ?? []) {
        objectStore.createIndex(index.name, index.keyPath, {
          unique: index.unique ?? false,
          multiEntry: index.multiEntry ?? false,
        });
      }
    }
  };

  const database = await requestToPromise(openRequest);
  const tablesWithRecords = Object.entries(stores).filter(
    ([, definition]) => (definition.records?.length ?? 0) > 0
  );

  if (tablesWithRecords.length > 0) {
    const transaction = database.transaction(
      tablesWithRecords.map(([name]) => name),
      'readwrite'
    );
    const transactionComplete = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
    });

    for (const [name, definition] of tablesWithRecords) {
      const objectStore = transaction.objectStore(name);
      for (const record of definition.records ?? []) objectStore.add(record);
    }
    await transactionComplete;
  }

  database.close();
}

async function snapshotDatabase(): Promise<DatabaseSnapshot> {
  const database = await requestToPromise(indexedDB.open(DATABASE_NAME));
  const tableNames = Array.from(database.objectStoreNames).sort();
  const transaction = database.transaction(tableNames, 'readonly');
  const transactionComplete = new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });

  const tables = await Promise.all(
    tableNames.map(async (name): Promise<TableSnapshot> => {
      const objectStore = transaction.objectStore(name);
      const records = await requestToPromise(objectStore.getAll());
      const indexes = Array.from(objectStore.indexNames)
        .sort()
        .map(indexName => {
          const index = objectStore.index(indexName);
          return {
            name: index.name,
            keyPath: index.keyPath as string | string[],
            unique: index.unique,
            multiEntry: index.multiEntry,
          };
        });

      return {
        name,
        primaryKey: {
          keyPath: objectStore.keyPath as string | string[] | null,
          autoIncrement: objectStore.autoIncrement,
        },
        indexes,
        serializedRecords: await serializeRecords(records),
      };
    })
  );

  await transactionComplete;
  const version = database.version;
  database.close();
  return { version, tables };
}

async function deleteFixtureDatabase(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('Fixture database delete blocked'));
  });
}

async function databaseExistsWithoutOpening(name: string): Promise<boolean> {
  const databases = await indexedDB.databases();
  return databases.some(database => database.name === name);
}

const currentVersion11Stores: Record<string, FixtureStore> = {
  brewingNotes: {
    keyPath: 'id',
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'equipment', keyPath: 'equipment' },
      { name: 'method', keyPath: 'method' },
      { name: 'beanId', keyPath: 'beanId' },
      {
        name: '[beanId+timestamp]',
        keyPath: ['beanId', 'timestamp'],
      },
    ],
    records: [
      {
        id: 'note-1',
        timestamp: 1720000000000,
        beanId: 'bean-1',
        images: ['data:image/jpeg;base64,inline-note-image'],
      },
    ],
  },
  brewingNoteImages: {
    keyPath: 'noteId',
    indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }],
    records: [
      {
        noteId: 'note-1',
        image: new Blob(['note-image'], { type: 'image/jpeg' }),
        updatedAt: 1720000000001,
      },
    ],
  },
  brewingNoteImageThumbnails: {
    keyPath: 'noteId',
    indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }],
    records: [
      { noteId: 'note-1', imageThumbnail: 'data:image/jpeg;base64,thumb' },
    ],
  },
  coffeeBeans: {
    keyPath: 'id',
    indexes: [
      { name: 'timestamp', keyPath: 'timestamp' },
      { name: 'name', keyPath: 'name' },
      { name: 'type', keyPath: 'type' },
    ],
    records: [
      {
        id: 'bean-1',
        timestamp: 1720000000000,
        name: 'Ethiopia',
        image: 'legacy-inline-image',
        backImage: null,
        optionalUndefined: undefined,
        unknownLegacyObject: { values: [undefined, null, 'kept'] },
      },
    ],
  },
  coffeeBeanImages: {
    keyPath: 'beanId',
    indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }],
    records: [
      {
        beanId: 'bean-1',
        image: new Blob(['bean-image'], { type: 'image/png' }),
        binary: new Uint8Array([1, 2, 3]).buffer,
        updatedAt: 1720000000002,
      },
    ],
  },
  coffeeBeanImageThumbnails: {
    keyPath: 'beanId',
    indexes: [{ name: 'updatedAt', keyPath: 'updatedAt' }],
    records: [
      { beanId: 'bean-1', imageThumbnail: 'data:image/png;base64,thumb' },
    ],
  },
  settings: {
    keyPath: 'key',
    records: [{ key: 'brewingNoteImagesMigrated', value: 'true' }],
  },
  customEquipments: {
    keyPath: 'id',
    indexes: [{ name: 'name', keyPath: 'name' }],
    records: [{ id: 'equipment-1', name: 'V60' }],
  },
  customMethods: {
    keyPath: 'equipmentId',
    records: [{ equipmentId: 'equipment-1', methods: ['pour-over'] }],
  },
  grinders: {
    keyPath: 'id',
    indexes: [{ name: 'name', keyPath: 'name' }],
    records: [{ id: 'grinder-1', name: 'Hand grinder' }],
  },
  appSettings: {
    keyPath: 'id',
    records: [{ id: 'main', data: { theme: 'dark' } }],
  },
  pendingOperations: {
    keyPath: 'id',
    indexes: [
      { name: 'table', keyPath: 'table' },
      { name: 'recordId', keyPath: 'recordId' },
      { name: 'timestamp', keyPath: 'timestamp' },
    ],
    records: [
      {
        id: 'operation-1',
        table: 'coffeeBeans',
        recordId: 'bean-1',
        type: 'upsert',
        data: { id: 'bean-1', name: 'Ethiopia' },
        timestamp: 1720000000003,
        retryCount: 2,
        lastError: 'Network unavailable',
        failedAt: new Date('2024-07-03T00:00:00.000Z'),
      },
    ],
  },
};

describe('Legacy Dexie reader', () => {
  beforeEach(async () => {
    await deleteFixtureDatabase();
  });

  afterEach(async () => {
    await deleteFixtureDatabase();
  });

  it('reads a current-like v11 database without changing its version, schema, or records (Case A)', async () => {
    await createFixture(11, currentVersion11Stores);
    const before = await snapshotDatabase();
    const opened = await openLegacyDexieReader();

    expect(opened.exists).toBe(true);
    if (!opened.exists)
      throw new Error('Expected the fixture database to exist');

    try {
      const info = opened.reader.inspect();
      const data = await opened.reader.readMigrationData();
      expect(info.version).toBe(11);
      expect(info.tables.map(({ name }) => name).sort()).toEqual(
        before.tables.map(({ name }) => name)
      );
      expect(info.absentSourceTables).toEqual([]);
      const noteTable = info.tables.find(({ name }) => name === 'brewingNotes');
      expect(noteTable?.primaryKey).toMatchObject({
        keyPath: 'id',
        autoIncrement: false,
      });
      expect(noteTable?.indexes).toContainEqual(
        expect.objectContaining({ keyPath: ['beanId', 'timestamp'] })
      );
      expect(data.coffeeBeans.records[0]).toMatchObject({
        id: 'bean-1',
        image: 'legacy-inline-image',
        backImage: null,
      });
      expect(data.coffeeBeans.records[0]).toHaveProperty(
        'optionalUndefined',
        undefined
      );
      expect(data.brewingNoteImages.records).toHaveLength(1);
      expect(data.pendingOperations.records[0]).toMatchObject({
        lastError: 'Network unavailable',
        failedAt: new Date('2024-07-03T00:00:00.000Z'),
      });

      const after = await snapshotDatabase();
      expect(after).toEqual(before);
      for (const table of before.tables) {
        expect(
          await serializeRecords(
            data[table.name as LegacySourceTableName].records
          )
        ).toBe(table.serializedRecords);
      }
    } finally {
      opened.reader.close();
    }
  });

  it('preserves inline coffee-bean images and does not create split image tables (Case B)', async () => {
    await createFixture(5, {
      coffeeBeans: {
        keyPath: 'id',
        indexes: [{ name: 'name', keyPath: 'name' }],
        records: [
          {
            id: 'legacy-bean',
            name: 'Legacy bean',
            image: 'data:image/jpeg;base64,front',
            backImage: 'data:image/jpeg;base64,back',
          },
        ],
      },
      settings: {
        keyPath: 'key',
        records: [{ key: 'v4_migrated', value: 'true' }],
      },
    });
    const before = await snapshotDatabase();
    const opened = await openLegacyDexieReader();

    expect(opened.exists).toBe(true);
    if (!opened.exists)
      throw new Error('Expected the fixture database to exist');

    try {
      const info = opened.reader.inspect();
      const beanRead = await opened.reader.readTable('coffeeBeans');
      expect(info.version).toBe(5);
      expect(info.tables.map(({ name }) => name)).toEqual([
        'coffeeBeans',
        'settings',
      ]);
      expect(info.tables.some(({ name }) => name === 'coffeeBeanImages')).toBe(
        false
      );
      expect(
        info.tables.some(({ name }) => name === 'coffeeBeanImageThumbnails')
      ).toBe(false);
      expect(beanRead.records[0]).toEqual({
        id: 'legacy-bean',
        name: 'Legacy bean',
        image: 'data:image/jpeg;base64,front',
        backImage: 'data:image/jpeg;base64,back',
      });
      expect(await snapshotDatabase()).toEqual(before);
    } finally {
      opened.reader.close();
    }
  });

  it('preserves inline brewing-note images without splitting or modifying them (Case C)', async () => {
    await createFixture(8, {
      brewingNotes: {
        keyPath: 'id',
        indexes: [{ name: 'timestamp', keyPath: 'timestamp' }],
        records: [
          {
            id: 'legacy-note',
            timestamp: 1720000000000,
            image: 'data:image/jpeg;base64,first',
            images: [
              'data:image/jpeg;base64,first',
              'data:image/jpeg;base64,second',
            ],
          },
        ],
      },
      settings: { keyPath: 'key', records: [] },
    });
    const before = await snapshotDatabase();
    const opened = await openLegacyDexieReader();

    expect(opened.exists).toBe(true);
    if (!opened.exists)
      throw new Error('Expected the fixture database to exist');

    try {
      const info = opened.reader.inspect();
      const noteRead = await opened.reader.readTable('brewingNotes');
      expect(info.version).toBe(8);
      expect(info.tables.some(({ name }) => name === 'brewingNoteImages')).toBe(
        false
      );
      expect(
        info.tables.some(({ name }) => name === 'brewingNoteImageThumbnails')
      ).toBe(false);
      expect(noteRead.records[0]).toEqual({
        id: 'legacy-note',
        timestamp: 1720000000000,
        image: 'data:image/jpeg;base64,first',
        images: [
          'data:image/jpeg;base64,first',
          'data:image/jpeg;base64,second',
        ],
      });
      expect(await snapshotDatabase()).toEqual(before);
    } finally {
      opened.reader.close();
    }
  });

  it('returns empty absent-table results without upgrading the partial schema (Case D)', async () => {
    await createFixture(2, {
      coffeeBeans: {
        keyPath: 'id',
        records: [{ id: 'bean-2', name: 'Present' }],
      },
      brewingNotes: { keyPath: 'id', records: [] },
      settings: { keyPath: 'key', records: [] },
    });
    const before = await snapshotDatabase();
    const opened = await openLegacyDexieReader();

    expect(opened.exists).toBe(true);
    if (!opened.exists)
      throw new Error('Expected the fixture database to exist');

    try {
      const info = opened.reader.inspect();
      const data = await opened.reader.readMigrationData();
      expect(info.version).toBe(2);
      expect(data.coffeeBeans).toEqual({
        status: 'present',
        records: [{ id: 'bean-2', name: 'Present' }],
      });
      expect(data.brewingNoteImages).toEqual({ status: 'absent', records: [] });
      expect(data.coffeeBeanImages).toEqual({ status: 'absent', records: [] });
      expect(data.pendingOperations).toEqual({ status: 'absent', records: [] });
      expect(info.absentSourceTables).toContain('pendingOperations');
      expect(await snapshotDatabase()).toEqual(before);
    } finally {
      opened.reader.close();
    }
  });

  it('retains an old yearlyReports store instead of applying the current removal schema (Case E)', async () => {
    await createFixture(8, {
      coffeeBeans: { keyPath: 'id', records: [] },
      brewingNotes: { keyPath: 'id', records: [] },
      settings: { keyPath: 'key', records: [] },
      yearlyReports: {
        keyPath: 'id',
        indexes: [{ name: 'year', keyPath: 'year' }],
        records: [{ id: 'report-2024', year: 2024, total: 18 }],
      },
    });
    const before = await snapshotDatabase();
    const opened = await openLegacyDexieReader();

    expect(opened.exists).toBe(true);
    if (!opened.exists)
      throw new Error('Expected the fixture database to exist');

    try {
      const info = opened.reader.inspect();
      expect(info.version).toBe(8);
      expect(info.tables.map(({ name }) => name)).toContain('yearlyReports');
      expect(await snapshotDatabase()).toEqual(before);
    } finally {
      opened.reader.close();
    }
  });

  it('returns pending-operation fields that are absent from current row typings (Case F)', async () => {
    const pendingOperation = {
      id: 'operation-extra',
      table: 'brewingNotes',
      recordId: 'note-legacy',
      type: 'delete',
      timestamp: 1720000000000,
      retryCount: 4,
      lastError: 'Remote conflict',
      failedAt: 1720000000010,
      extraLegacyField: { retryable: false },
    };
    await createFixture(5, {
      pendingOperations: {
        keyPath: 'id',
        indexes: [
          { name: 'table', keyPath: 'table' },
          { name: 'recordId', keyPath: 'recordId' },
          { name: 'timestamp', keyPath: 'timestamp' },
        ],
        records: [pendingOperation],
      },
    });
    const before = await snapshotDatabase();
    const opened = await openLegacyDexieReader();

    expect(opened.exists).toBe(true);
    if (!opened.exists)
      throw new Error('Expected the fixture database to exist');

    try {
      const queueRead = await opened.reader.readTable('pendingOperations');
      expect(queueRead.records).toEqual([pendingOperation]);
      expect(queueRead.records[0]).toHaveProperty(
        'lastError',
        'Remote conflict'
      );
      expect(queueRead.records[0]).toHaveProperty('failedAt', 1720000000010);
      expect(queueRead.records[0]).toHaveProperty('extraLegacyField', {
        retryable: false,
      });
      expect(await snapshotDatabase()).toEqual(before);
    } finally {
      opened.reader.close();
    }
  });

  it('reports a missing BrewGuideDB without leaving a database behind (Case G)', async () => {
    expect(await databaseExistsWithoutOpening(DATABASE_NAME)).toBe(false);

    const opened = await openLegacyDexieReader();

    expect(opened).toEqual({ exists: false });
    expect(await databaseExistsWithoutOpening(DATABASE_NAME)).toBe(false);
    expect(await Dexie.exists(DATABASE_NAME)).toBe(false);
  });
});
