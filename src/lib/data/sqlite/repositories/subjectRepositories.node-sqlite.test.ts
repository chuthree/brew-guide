import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import { encodeBrewingNote, encodeCoffeeBean } from '../codecs';
import type { NodeSqliteTestDatabase } from './testing/nodeSqliteTestDriver';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
} from './testing/nodeSqliteTestDriver';
import { createSqliteBrewingNoteRepository } from './brewingNote';
import {
  createSqliteCoffeeBeanRepository,
  listCoffeeBeans,
  saveCoffeeBean,
} from './coffeeBean';
import { listBrewingNotes, saveBrewingNote } from './brewingNote';
import { assertNoInlineImageFields } from './subjectRepositoryGuards';

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;
const nodeSqliteLabel = supportsNodeSqlite()
  ? `real SQLite (node:sqlite, Node ${process.versions.node})`
  : `SKIPPED: node:sqlite unavailable on Node ${process.versions.node}; requires Node >=22.13`;

describe('subject repository image-field guard', () => {
  it('checks own properties and ignores a prototype-only image property', () => {
    const record = Object.assign(Object.create({ image: 'inherited' }), {
      id: 'bean-1',
    });

    expect(() =>
      assertNoInlineImageFields('CoffeeBeanRepository', record, ['image'])
    ).not.toThrow();
  });
});

describeNodeSqlite(`${nodeSqliteLabel} subject repository integration`, () => {
  let database: NodeSqliteTestDatabase | undefined;

  const getDatabase = (): NodeSqliteTestDatabase => {
    if (!database) throw new Error('Node SQLite test database is not open');
    return database;
  };

  beforeEach(async () => {
    database = await createNodeSqliteTestDatabase();
  });

  afterEach(async () => {
    await database?.close();
    database = undefined;
  });

  it('composes executor-scoped subject operations inside a driver transaction', async () => {
    const driver = getDatabase().driver;
    await driver.transaction(async tx => {
      await saveCoffeeBean(tx, bean('transaction-bean', 100));
      await saveBrewingNote(tx, note('transaction-note', 200));
      expect((await listCoffeeBeans(tx)).map(record => record.id)).toEqual([
        'transaction-bean',
      ]);
      expect((await listBrewingNotes(tx)).map(record => record.id)).toEqual([
        'transaction-note',
      ]);
    });

    expect(
      await createSqliteCoffeeBeanRepository(driver).get('transaction-bean')
    ).toMatchObject({ id: 'transaction-bean' });
    expect(
      await createSqliteBrewingNoteRepository(driver).get('transaction-note')
    ).toMatchObject({ id: 'transaction-note' });
  });

  describe('CoffeeBeanRepository', () => {
    it('handles empty reads, missing ids, upsert, count, and id-ascending list order', async () => {
      const repository = createSqliteCoffeeBeanRepository(getDatabase().driver);
      expect(await repository.list()).toEqual([]);
      expect(await repository.get('missing')).toBeUndefined();
      expect(await repository.count()).toBe(0);

      await repository.upsertMany([
        bean('z-bean', 10),
        bean('m-bean', 20),
        bean('a-bean', 30),
      ]);
      expect((await repository.list()).map(record => record.id)).toEqual([
        'a-bean',
        'm-bean',
        'z-bean',
      ]);

      const replacement = bean('m-bean', 40, {
        name: 'Updated coffee',
        unknownFutureField: { nested: ['kept', 2, null] },
      });
      await repository.save(replacement);
      expect(await repository.get('m-bean')).toEqual(replacement);
      expect(await repository.count()).toBe(3);
    });

    it('preserves both type fields and legacy type-only records with unknown fields', async () => {
      const repository = createSqliteCoffeeBeanRepository(getDatabase().driver);
      const bothFields = bean('both-fields', 100, {
        type: 'legacy-type',
        beanType: 'current-bean-type',
        future: { values: ['unknown', { nested: true }] },
      });
      const legacyOnly = bean('legacy-only', 200, { type: 'old-roast-type' });
      delete (legacyOnly as unknown as Record<string, unknown>).beanType;

      await repository.upsertMany([bothFields, legacyOnly]);

      expect(await repository.get('both-fields')).toEqual(bothFields);
      const decodedLegacyOnly = (await repository.get('legacy-only')) as
        | (CoffeeBean & { type?: unknown })
        | undefined;
      expect(decodedLegacyOnly?.type).toBe('old-roast-type');
      expect(
        Object.prototype.hasOwnProperty.call(decodedLegacyOnly, 'beanType')
      ).toBe(false);
    });

    it.each([
      ['missing', undefined],
      ['string', '100'],
      ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ] as const)(
      'rejects a %s canonical timestamp without writing',
      async (_, timestamp) => {
        const repository = createSqliteCoffeeBeanRepository(
          getDatabase().driver
        );
        const input = bean('invalid-timestamp', 100);
        const rawInput = input as unknown as Record<string, unknown>;
        if (timestamp === undefined) delete rawInput.timestamp;
        else rawInput.timestamp = timestamp;

        await expect(repository.save(input)).rejects.toThrow();
        expect(await repository.count()).toBe(0);
      }
    );

    it.each([
      ['image data URL', 'image', 'data:image/png;base64,AA=='],
      ['empty image', 'image', ''],
      ['null image', 'image', null],
      ['undefined image', 'image', undefined],
      ['back image data URL', 'backImage', 'data:image/jpeg;base64,AA=='],
      ['empty back image', 'backImage', ''],
      ['null back image', 'backImage', null],
      ['undefined back image', 'backImage', undefined],
    ] as const)(
      'rejects an own %s property before writing',
      async (_, field, value) => {
        const repository = createSqliteCoffeeBeanRepository(
          getDatabase().driver
        );
        const input = {
          ...bean('image-bearing', 100),
          [field]: value,
        } as CoffeeBean;

        await expect(repository.save(input)).rejects.toThrow(
          new RegExp(`CoffeeBeanRepository.*${field}`)
        );
        expect(await repository.count()).toBe(0);
      }
    );

    it('rejects descriptor-producing inline images before any subject row is written', async () => {
      const repository = createSqliteCoffeeBeanRepository(getDatabase().driver);
      const input = bean('image-descriptor', 100, {
        image: 'data:image/png;base64,AA==',
      });
      expect(encodeCoffeeBean(input).imageSources).toHaveLength(1);

      await expect(repository.save(input)).rejects.toThrow(
        /CoffeeBeanRepository.*image/
      );
      expect(await repository.get('image-descriptor')).toBeUndefined();
    });

    it('keeps earlier upserts when an image-bearing middle item rejects and never attempts later items', async () => {
      const repository = createSqliteCoffeeBeanRepository(getDatabase().driver);
      const invalid = {
        ...bean('middle', 200),
        image: undefined,
      } as CoffeeBean;

      await expect(
        repository.upsertMany([bean('first', 100), invalid, bean('last', 300)])
      ).rejects.toThrow(/CoffeeBeanRepository.*image/);
      expect((await repository.list()).map(record => record.id)).toEqual([
        'first',
      ]);
    });

    it('deletes only subject rows and treats empty, duplicate, and missing ids harmlessly', async () => {
      const driver = getDatabase().driver;
      const repository = createSqliteCoffeeBeanRepository(driver);
      await repository.upsertMany([bean('bean-a', 100), bean('bean-b', 200)]);
      await insertBeanImage(driver, 'bean-image-a', 'bean-a');
      await repository.delete('missing');
      await repository.deleteMany([]);
      await repository.deleteMany(['bean-a', 'bean-a', 'missing']);

      expect((await repository.list()).map(record => record.id)).toEqual([
        'bean-b',
      ]);
      expect(await tableCount(driver, 'coffee_bean_images')).toBe(1);

      await repository.clear();
      expect(await repository.count()).toBe(0);
      expect(await tableCount(driver, 'coffee_bean_images')).toBe(1);
    });

    it('does not strip inline image fields while decoding an already stored row', async () => {
      const driver = getDatabase().driver;
      const repository = createSqliteCoffeeBeanRepository(driver);
      const record = {
        ...bean('legacy-inline', 100),
        image: 'legacy-inline-image',
        backImage: '',
      };
      await insertBeanRow(driver, 'legacy-inline', 100, JSON.stringify(record));

      await expect(repository.get('legacy-inline')).resolves.toMatchObject({
        image: 'legacy-inline-image',
        backImage: '',
      });
    });

    it('rejects malformed JSON and id or timestamp projection mismatches on reads', async () => {
      const driver = getDatabase().driver;
      const repository = createSqliteCoffeeBeanRepository(driver);
      await insertBeanRow(driver, 'corrupt', 100, '{');
      await expect(repository.get('corrupt')).rejects.toThrow();
      await expect(repository.list()).rejects.toThrow();

      await repository.clear();
      await insertBeanRow(
        driver,
        'row-id',
        100,
        JSON.stringify(bean('snapshot-id', 100))
      );
      await expect(repository.get('row-id')).rejects.toThrow();

      await repository.clear();
      await insertBeanRow(
        driver,
        'bean-time-mismatch',
        101,
        JSON.stringify(bean('bean-time-mismatch', 100))
      );
      await expect(repository.get('bean-time-mismatch')).rejects.toThrow();
    });
  });

  describe('BrewingNoteRepository', () => {
    it('handles empty reads, missing ids, upsert, count, and id-ascending list order', async () => {
      const repository = createSqliteBrewingNoteRepository(
        getDatabase().driver
      );
      expect(await repository.list()).toEqual([]);
      expect(await repository.get('missing')).toBeUndefined();
      expect(await repository.count()).toBe(0);

      await repository.upsertMany([
        note('z-note', 10),
        note('m-note', 20),
        note('a-note', 30),
      ]);
      expect((await repository.list()).map(record => record.id)).toEqual([
        'a-note',
        'm-note',
        'z-note',
      ]);

      const replacement = note('m-note', 40, {
        beanId: 'bean-2',
        updatedAt: 41,
        notes: 'Updated note',
        future: { nested: ['preserved', 3, null] },
      });
      await repository.save(replacement);
      expect(await repository.get('m-note')).toEqual(replacement);
      expect(await repository.count()).toBe(3);
    });

    it('orders bean notes by timestamp descending and id descending for ties', async () => {
      const repository = createSqliteBrewingNoteRepository(
        getDatabase().driver
      );
      await repository.upsertMany([
        note('note-c', 1000),
        note('note-a', 1000),
        note('note-b', 2000),
        note('other-bean', 3000, { beanId: 'bean-2' }),
      ]);

      expect(
        (await repository.listByBeanId('bean-1')).map(record => record.id)
      ).toEqual(['note-b', 'note-c', 'note-a']);
    });

    it.each([
      ['missing', undefined],
      ['string', '100'],
      ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ] as const)(
      'rejects a %s canonical timestamp without writing',
      async (_, timestamp) => {
        const repository = createSqliteBrewingNoteRepository(
          getDatabase().driver
        );
        const input = note('invalid-timestamp', 100);
        const rawInput = input as unknown as Record<string, unknown>;
        if (timestamp === undefined) delete rawInput.timestamp;
        else rawInput.timestamp = timestamp;

        await expect(repository.save(input)).rejects.toThrow();
        expect(await repository.count()).toBe(0);
      }
    );

    it('preserves missing, null, and numeric beanId/updatedAt semantics while SQL uses nullable projections', async () => {
      const driver = getDatabase().driver;
      const repository = createSqliteBrewingNoteRepository(driver);
      const missing = note('missing-values', 400);
      delete (missing as unknown as Record<string, unknown>).beanId;
      delete (missing as unknown as Record<string, unknown>).updatedAt;
      const explicitUndefined = note('undefined-values', 300, {
        beanId: undefined,
        updatedAt: undefined,
      });
      const explicitNull = note('null-values', 200, {
        beanId: null,
        updatedAt: null,
      });
      const concrete = note('concrete-values', 100, {
        beanId: 'bean-1',
        updatedAt: 123456,
      });
      await repository.upsertMany([
        missing,
        explicitUndefined,
        explicitNull,
        concrete,
      ]);

      for (const id of ['missing-values', 'undefined-values']) {
        const decoded = await repository.get(id);
        expect(Object.prototype.hasOwnProperty.call(decoded, 'beanId')).toBe(
          false
        );
        expect(Object.prototype.hasOwnProperty.call(decoded, 'updatedAt')).toBe(
          false
        );
      }
      expect(await repository.get('null-values')).toMatchObject({
        beanId: null,
        updatedAt: null,
      });
      expect(await repository.get('concrete-values')).toMatchObject({
        beanId: 'bean-1',
        updatedAt: 123456,
      });

      const projections = await driver.query(
        `SELECT id, bean_id, updated_at_ms
         FROM brewing_notes
         ORDER BY id ASC`
      );
      expect(projections).toEqual([
        { id: 'concrete-values', bean_id: 'bean-1', updated_at_ms: 123456 },
        { id: 'missing-values', bean_id: null, updated_at_ms: null },
        { id: 'null-values', bean_id: null, updated_at_ms: null },
        { id: 'undefined-values', bean_id: null, updated_at_ms: null },
      ]);
      expect(
        (await repository.listByBeanId('bean-1')).map(record => record.id)
      ).toEqual(['concrete-values']);
    });

    it.each([
      ['image data URL', 'image', 'data:image/png;base64,AA=='],
      ['empty image', 'image', ''],
      ['null image', 'image', null],
      ['undefined image', 'image', undefined],
      ['images array', 'images', ['data:image/jpeg;base64,AA==']],
      ['empty images array', 'images', []],
      ['null images', 'images', null],
      ['undefined images', 'images', undefined],
    ] as const)(
      'rejects an own %s property before writing',
      async (_, field, value) => {
        const repository = createSqliteBrewingNoteRepository(
          getDatabase().driver
        );
        const input = {
          ...note('image-bearing', 100),
          [field]: value,
        } as BrewingNote;

        await expect(repository.save(input)).rejects.toThrow(
          new RegExp(`BrewingNoteRepository.*${field}`)
        );
        expect(await repository.count()).toBe(0);
      }
    );

    it('rejects descriptor-producing image arrays, including empty arrays, before writing', async () => {
      const repository = createSqliteBrewingNoteRepository(
        getDatabase().driver
      );
      const input = note('image-descriptor', 100, { images: ['inline'] });
      expect(encodeBrewingNote(input).imageSources).toHaveLength(1);

      await expect(repository.save(input)).rejects.toThrow(
        /BrewingNoteRepository.*images/
      );
      await expect(
        repository.save(note('empty-images', 200, { images: [] }))
      ).rejects.toThrow(/BrewingNoteRepository.*images/);
      expect(await repository.count()).toBe(0);
    });

    it('keeps earlier upserts when an images-array middle item rejects and never attempts later items', async () => {
      const repository = createSqliteBrewingNoteRepository(
        getDatabase().driver
      );
      const invalid = note('middle', 200, { images: [] });

      await expect(
        repository.upsertMany([note('first', 100), invalid, note('last', 300)])
      ).rejects.toThrow(/BrewingNoteRepository.*images/);
      expect((await repository.list()).map(record => record.id)).toEqual([
        'first',
      ]);
    });

    it('deletes only subject rows and leaves image metadata untouched', async () => {
      const driver = getDatabase().driver;
      const repository = createSqliteBrewingNoteRepository(driver);
      await repository.upsertMany([note('note-a', 100), note('note-b', 200)]);
      await insertNoteImage(driver, 'note-image-a', 'note-a');
      await repository.delete('missing');
      await repository.deleteMany([]);
      await repository.deleteMany(['note-a', 'note-a', 'missing']);

      expect((await repository.list()).map(record => record.id)).toEqual([
        'note-b',
      ]);
      expect(await tableCount(driver, 'brewing_note_images')).toBe(1);

      await repository.clear();
      expect(await repository.count()).toBe(0);
      expect(await tableCount(driver, 'brewing_note_images')).toBe(1);
    });

    it('does not strip inline image fields while decoding an already stored row', async () => {
      const driver = getDatabase().driver;
      const repository = createSqliteBrewingNoteRepository(driver);
      const record = {
        ...note('legacy-inline', 100),
        image: 'legacy-single-image',
        images: ['legacy-array-image'],
      };
      const encoded = encodeBrewingNote(note('legacy-inline', 100)).row;
      await driver.execute(
        `INSERT INTO brewing_notes (
           id, timestamp_ms, updated_at_ms, bean_id, record_json
         ) VALUES (?, ?, ?, ?, ?)`,
        [
          encoded.id,
          encoded.timestamp_ms,
          encoded.updated_at_ms,
          encoded.bean_id,
          JSON.stringify(record),
        ]
      );

      await expect(repository.get('legacy-inline')).resolves.toMatchObject({
        image: 'legacy-single-image',
        images: ['legacy-array-image'],
      });
    });

    it('rejects malformed JSON and id, timestamp, beanId, or updatedAt projection mismatches on reads', async () => {
      const driver = getDatabase().driver;
      const repository = createSqliteBrewingNoteRepository(driver);
      const malformed = encodeBrewingNote(note('malformed', 100)).row;
      await insertNoteRow(driver, {
        ...malformed,
        record_json: '{',
      });
      await expect(repository.get('malformed')).rejects.toThrow();
      await expect(repository.list()).rejects.toThrow();

      const mismatchCases = [
        [
          'id',
          (row: ReturnType<typeof encodeBrewingNote>['row']) => ({
            ...row,
            id: 'row-id',
          }),
        ],
        [
          'timestamp',
          (row: ReturnType<typeof encodeBrewingNote>['row']) => ({
            ...row,
            timestamp_ms: row.timestamp_ms + 1,
          }),
        ],
        [
          'beanId',
          (row: ReturnType<typeof encodeBrewingNote>['row']) => ({
            ...row,
            bean_id: 'different-bean',
          }),
        ],
        [
          'updatedAt',
          (row: ReturnType<typeof encodeBrewingNote>['row']) => ({
            ...row,
            updated_at_ms: (row.updated_at_ms ?? 0) + 1,
          }),
        ],
      ] as const;

      for (const [field, alter] of mismatchCases) {
        await repository.clear();
        const row = encodeBrewingNote(note(`valid-${field}`, 200)).row;
        const mismatched = alter(row);
        await insertNoteRow(driver, mismatched);
        await expect(repository.get(mismatched.id)).rejects.toThrow();
        await expect(repository.list()).rejects.toThrow();
      }
    });
  });
});

function bean(
  id: string,
  timestamp: number,
  extra: Record<string, unknown> = {}
): CoffeeBean {
  return {
    id,
    timestamp,
    name: `Coffee ${id}`,
    type: 'legacy-type',
    beanType: 'filter',
    flavor: ['peach', 'cocoa'],
    blendComponents: [
      {
        origin: 'Ethiopia',
        process: 'Natural',
        percentage: 100,
        notes: { lot: 'Lot 12' },
      },
    ],
    nestedUnknown: { exact: ['中文', 1, null] },
    ...extra,
  } as unknown as CoffeeBean;
}

function note(
  id: string,
  timestamp: number,
  extra: Record<string, unknown> = {}
): BrewingNote {
  return {
    id,
    timestamp,
    updatedAt: timestamp + 1,
    beanId: 'bean-1',
    equipment: 'V60',
    method: 'Pulse pour',
    params: {
      coffee: '15g',
      water: '225g',
      stages: [
        { label: 'Bloom', water: '45g', duration: 30 },
        { label: 'Pour', water: '180g', duration: 60 },
      ],
    },
    coffeeBeanInfo: {
      name: 'Ethiopia Guji',
      roastLevel: 'medium',
      roastDate: '2026-08-15',
    },
    rating: 4.5,
    taste: { sweetness: 4, acidity: 3.5, body: 3 },
    notes: `Brew ${id}`,
    futureNested: { values: ['preserve', { exact: true }] },
    ...extra,
  } as unknown as BrewingNote;
}

async function tableCount(
  driver: NodeSqliteTestDatabase['driver'],
  table: 'coffee_bean_images' | 'brewing_note_images'
): Promise<number> {
  const rows = await driver.query(`SELECT COUNT(*) AS count FROM ${table}`);
  return rows[0]?.count as number;
}

async function insertBeanRow(
  driver: NodeSqliteTestDatabase['driver'],
  id: string,
  timestampMs: number,
  recordJson: string
): Promise<void> {
  await driver.execute(
    `INSERT INTO coffee_beans (id, timestamp_ms, record_json)
     VALUES (?, ?, ?)`,
    [id, timestampMs, recordJson]
  );
}

async function insertNoteRow(
  driver: NodeSqliteTestDatabase['driver'],
  row: ReturnType<typeof encodeBrewingNote>['row']
): Promise<void> {
  await driver.execute(
    `INSERT INTO brewing_notes (
       id, timestamp_ms, updated_at_ms, bean_id, record_json
     ) VALUES (?, ?, ?, ?, ?)`,
    [row.id, row.timestamp_ms, row.updated_at_ms, row.bean_id, row.record_json]
  );
}

async function insertBeanImage(
  driver: NodeSqliteTestDatabase['driver'],
  imageId: string,
  beanId: string
): Promise<void> {
  await driver.execute(
    `INSERT INTO coffee_bean_images (
       image_id, bean_id, slot, variant, relative_path, mime_type,
       size_bytes, sha256, updated_at_ms
     ) VALUES (?, ?, 'front', 'original', ?, 'image/jpeg', 1, NULL, NULL)`,
    [imageId, beanId, `coffee-beans/${imageId}.jpg`]
  );
}

async function insertNoteImage(
  driver: NodeSqliteTestDatabase['driver'],
  imageId: string,
  noteId: string
): Promise<void> {
  await driver.execute(
    `INSERT INTO brewing_note_images (
       image_id, note_id, position, variant, relative_path, mime_type,
       size_bytes, sha256, updated_at_ms
     ) VALUES (?, ?, 0, 'original', ?, 'image/jpeg', 1, NULL, NULL)`,
    [imageId, noteId, `brewing-notes/${imageId}.jpg`]
  );
}
