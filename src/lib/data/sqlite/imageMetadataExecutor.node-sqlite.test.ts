import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SqlRow, SqliteDriver, SqliteExecutor } from './driver';
import { encodeCoffeeBeanImageMetadata } from './imageMetadata';
import type {
  BrewingNoteImageMetadata,
  CoffeeBeanImageMetadata,
} from './imageMetadata';
import type { NodeSqliteTestDatabase } from './repositories/testing/nodeSqliteTestDriver';
import {
  createNodeSqliteTestDatabase,
  supportsNodeSqlite,
} from './repositories/testing/nodeSqliteTestDriver';
import {
  getBrewingNoteImageMetadata,
  getCoffeeBeanImageMetadata,
  listBrewingNoteImageMetadata,
  listCoffeeBeanImageMetadata,
  replaceBrewingNoteImageMetadata,
  replaceCoffeeBeanImageMetadata,
} from './imageMetadataExecutor';

const describeNodeSqlite = supportsNodeSqlite() ? describe : describe.skip;
const nodeSqliteLabel = supportsNodeSqlite()
  ? 'real SQLite (node:sqlite, Node ' + process.versions.node + ')'
  : 'SKIPPED: node:sqlite unavailable on Node ' + process.versions.node;

let database: NodeSqliteTestDatabase | undefined;

function getDriver(): SqliteDriver {
  if (!database) throw new Error('Node SQLite test database is not open');
  return database.driver;
}

function beanImage(
  imageId: string,
  beanId: string,
  slot: CoffeeBeanImageMetadata['slot'],
  variant: CoffeeBeanImageMetadata['variant'],
  overrides: Partial<CoffeeBeanImageMetadata> = {}
): CoffeeBeanImageMetadata {
  return {
    imageId,
    beanId,
    slot,
    variant,
    relativePath: 'images/v1/objects/' + imageId,
    mimeType: 'image/jpeg',
    sizeBytes: 128,
    ...overrides,
  };
}

function noteImage(
  imageId: string,
  noteId: string,
  position: number,
  variant: BrewingNoteImageMetadata['variant'],
  overrides: Partial<BrewingNoteImageMetadata> = {}
): BrewingNoteImageMetadata {
  return {
    imageId,
    noteId,
    position,
    variant,
    relativePath: 'images/v1/objects/' + imageId,
    mimeType: 'image/webp',
    sizeBytes: 256,
    ...overrides,
  };
}

function failOnSecondBeanInsert(executor: SqliteExecutor): SqliteExecutor {
  let inserts = 0;
  return {
    query: (sql, params) => executor.query(sql, params),
    async execute(sql, params) {
      if (/^\s*INSERT\s+INTO\s+coffee_bean_images/i.test(sql)) {
        inserts += 1;
        if (inserts === 2) {
          throw new Error('Injected failure before second bean image INSERT');
        }
      }
      return executor.execute(sql, params);
    },
  };
}

describeNodeSqlite(nodeSqliteLabel + ' image metadata executor', () => {
  beforeEach(async () => {
    database = await createNodeSqliteTestDatabase();
  });

  afterEach(async () => {
    await database?.close();
    database = undefined;
  });

  it('round-trips bean metadata and returns logical identities in deterministic order', async () => {
    const rows = [
      beanImage('bean-back-thumb', 'bean-read', 'back', 'thumbnail', {
        sha256: 'b'.repeat(64),
        updatedAt: 1_780_000_000_004,
      }),
      beanImage('bean-front-thumb', 'bean-read', 'front', 'thumbnail'),
      beanImage('bean-back-original', 'bean-read', 'back', 'original', {
        mimeType: 'IMAGE/JPEG; charset=binary',
        sizeBytes: 4096,
      }),
      beanImage('bean-front-original', 'bean-read', 'front', 'original', {
        sha256: 'a'.repeat(64),
        updatedAt: 1_780_000_000_001,
      }),
    ];
    await replaceCoffeeBeanImageMetadata(getDriver(), 'bean-read', rows);

    expect(await listCoffeeBeanImageMetadata(getDriver(), 'bean-read')).toEqual(
      [rows[3], rows[1], rows[2], rows[0]]
    );
    expect(
      await getCoffeeBeanImageMetadata(
        getDriver(),
        'bean-read',
        'front',
        'original'
      )
    ).toEqual(rows[3]);
    expect(
      await getCoffeeBeanImageMetadata(
        getDriver(),
        'bean-read',
        'front',
        'thumbnail'
      )
    ).toEqual(rows[1]);
    expect(
      await getCoffeeBeanImageMetadata(
        getDriver(),
        'bean-read',
        'back',
        'original'
      )
    ).toEqual(rows[2]);
    expect(
      await getCoffeeBeanImageMetadata(
        getDriver(),
        'bean-read',
        'back',
        'thumbnail'
      )
    ).toEqual(rows[0]);
    expect(
      await getCoffeeBeanImageMetadata(
        getDriver(),
        'missing-bean',
        'front',
        'original'
      )
    ).toBeUndefined();
  });

  it('round-trips note metadata at positions 0, 1, and 8 with position and variant ordering', async () => {
    const rows = [
      noteImage('note-8-thumb', 'note-read', 8, 'thumbnail'),
      noteImage('note-0-thumb', 'note-read', 0, 'thumbnail', {
        sha256: 'c'.repeat(64),
        updatedAt: 1_780_000_000_008,
      }),
      noteImage('note-1-original', 'note-read', 1, 'original'),
      noteImage('note-8-original', 'note-read', 8, 'original'),
      noteImage('note-0-original', 'note-read', 0, 'original', {
        mimeType: 'application/octet-stream',
        sizeBytes: 0,
      }),
    ];
    await replaceBrewingNoteImageMetadata(getDriver(), 'note-read', rows);

    expect(
      await listBrewingNoteImageMetadata(getDriver(), 'note-read')
    ).toEqual([rows[4], rows[1], rows[2], rows[3], rows[0]]);
    expect(
      await getBrewingNoteImageMetadata(getDriver(), 'note-read', 0, 'original')
    ).toEqual(rows[4]);
    expect(
      await getBrewingNoteImageMetadata(
        getDriver(),
        'note-read',
        8,
        'thumbnail'
      )
    ).toEqual(rows[0]);
    expect(
      await getBrewingNoteImageMetadata(getDriver(), 'note-read', 2, 'original')
    ).toBeUndefined();
  });

  it('replaces only the selected bean owner and allows an empty replacement', async () => {
    const driver = getDriver();
    const oldBeanRows = [
      beanImage('bean-a-old-front', 'bean-a', 'front', 'original'),
      beanImage('bean-a-old-back', 'bean-a', 'back', 'original'),
    ];
    const untouchedBeanRows = [
      beanImage('bean-b-untouched', 'bean-b', 'front', 'original'),
    ];
    await replaceCoffeeBeanImageMetadata(driver, 'bean-a', oldBeanRows);
    await replaceCoffeeBeanImageMetadata(driver, 'bean-b', untouchedBeanRows);

    const desired = [
      beanImage('bean-a-new-front', 'bean-a', 'front', 'original'),
      beanImage('bean-a-new-thumb', 'bean-a', 'front', 'thumbnail'),
    ];
    await replaceCoffeeBeanImageMetadata(driver, 'bean-a', desired);

    expect(await listCoffeeBeanImageMetadata(driver, 'bean-a')).toEqual(
      desired
    );
    expect(await listCoffeeBeanImageMetadata(driver, 'bean-b')).toEqual(
      untouchedBeanRows
    );

    await replaceCoffeeBeanImageMetadata(driver, 'bean-a', []);
    expect(await listCoffeeBeanImageMetadata(driver, 'bean-a')).toEqual([]);
    expect(await listCoffeeBeanImageMetadata(driver, 'bean-b')).toEqual(
      untouchedBeanRows
    );
  });

  it('reorders and replaces only the selected note owner without transient uniqueness conflicts', async () => {
    const driver = getDriver();
    const oldNoteRows = [
      noteImage('note-a-image-a', 'note-a', 0, 'original'),
      noteImage('note-a-image-b', 'note-a', 1, 'original'),
    ];
    const untouchedNoteRows = [
      noteImage('note-b-untouched', 'note-b', 0, 'original'),
    ];
    await replaceBrewingNoteImageMetadata(driver, 'note-a', oldNoteRows);
    await replaceBrewingNoteImageMetadata(driver, 'note-b', untouchedNoteRows);

    const reordered = [
      noteImage('note-a-image-a', 'note-a', 1, 'original'),
      noteImage('note-a-image-b', 'note-a', 0, 'original'),
    ];
    await replaceBrewingNoteImageMetadata(driver, 'note-a', reordered);

    expect(await listBrewingNoteImageMetadata(driver, 'note-a')).toEqual([
      reordered[1],
      reordered[0],
    ]);
    expect(await listBrewingNoteImageMetadata(driver, 'note-b')).toEqual(
      untouchedNoteRows
    );

    await replaceBrewingNoteImageMetadata(driver, 'note-a', []);
    expect(await listBrewingNoteImageMetadata(driver, 'note-a')).toEqual([]);
    expect(await listBrewingNoteImageMetadata(driver, 'note-b')).toEqual(
      untouchedNoteRows
    );
  });

  it('rejects bean owner mismatch before deleting existing rows', async () => {
    const driver = getDriver();
    const existing = beanImage(
      'bean-a-existing',
      'bean-a',
      'front',
      'original'
    );
    await replaceCoffeeBeanImageMetadata(driver, 'bean-a', [existing]);

    await expect(
      replaceCoffeeBeanImageMetadata(driver, 'bean-a', [
        beanImage('wrong-owner', 'bean-b', 'front', 'original'),
      ])
    ).rejects.toThrow(/owner mismatch/);
    expect(await listCoffeeBeanImageMetadata(driver, 'bean-a')).toEqual([
      existing,
    ]);
  });

  it('rejects note owner mismatch before deleting existing rows', async () => {
    const driver = getDriver();
    const existing = noteImage('note-a-existing', 'note-a', 0, 'original');
    await replaceBrewingNoteImageMetadata(driver, 'note-a', [existing]);

    await expect(
      replaceBrewingNoteImageMetadata(driver, 'note-a', [
        noteImage('wrong-owner', 'note-b', 0, 'original'),
      ])
    ).rejects.toThrow(/owner mismatch/);
    expect(await listBrewingNoteImageMetadata(driver, 'note-a')).toEqual([
      existing,
    ]);
  });

  it('rejects malformed bean metadata before deleting existing rows', async () => {
    const driver = getDriver();
    const existing = beanImage(
      'bean-a-existing',
      'bean-a',
      'front',
      'original'
    );
    await replaceCoffeeBeanImageMetadata(driver, 'bean-a', [existing]);
    const desired = [
      beanImage('valid-desired', 'bean-a', 'front', 'original'),
      beanImage('invalid-path', 'bean-a', 'back', 'original', {
        relativePath: '/absolute/image.jpg',
      }),
    ];

    await expect(
      replaceCoffeeBeanImageMetadata(driver, 'bean-a', desired)
    ).rejects.toThrow(/relativePath/);
    expect(await listCoffeeBeanImageMetadata(driver, 'bean-a')).toEqual([
      existing,
    ]);
  });

  it('rejects malformed note metadata before deleting existing rows', async () => {
    const driver = getDriver();
    const existing = noteImage('note-a-existing', 'note-a', 0, 'original');
    await replaceBrewingNoteImageMetadata(driver, 'note-a', [existing]);

    await expect(
      replaceBrewingNoteImageMetadata(driver, 'note-a', [
        noteImage('invalid-size', 'note-a', 1, 'original', { sizeBytes: -1 }),
      ])
    ).rejects.toThrow(/sizeBytes/);
    expect(await listBrewingNoteImageMetadata(driver, 'note-a')).toEqual([
      existing,
    ]);
  });

  it('rejects duplicate bean logical identities and image ids before deleting', async () => {
    const driver = getDriver();
    const existing = beanImage(
      'bean-a-existing',
      'bean-a',
      'front',
      'original'
    );
    await replaceCoffeeBeanImageMetadata(driver, 'bean-a', [existing]);

    await expect(
      replaceCoffeeBeanImageMetadata(driver, 'bean-a', [
        beanImage('duplicate-slot-a', 'bean-a', 'front', 'original'),
        beanImage('duplicate-slot-b', 'bean-a', 'front', 'original'),
      ])
    ).rejects.toThrow(/Duplicate coffee bean image slot and variant/);
    expect(await listCoffeeBeanImageMetadata(driver, 'bean-a')).toEqual([
      existing,
    ]);

    await expect(
      replaceCoffeeBeanImageMetadata(driver, 'bean-a', [
        beanImage('duplicate-id', 'bean-a', 'front', 'original'),
        beanImage('duplicate-id', 'bean-a', 'back', 'original'),
      ])
    ).rejects.toThrow(/Duplicate image_id/);
    expect(await listCoffeeBeanImageMetadata(driver, 'bean-a')).toEqual([
      existing,
    ]);
  });

  it('rejects duplicate note logical identities and image ids before deleting', async () => {
    const driver = getDriver();
    const existing = noteImage('note-a-existing', 'note-a', 0, 'original');
    await replaceBrewingNoteImageMetadata(driver, 'note-a', [existing]);

    await expect(
      replaceBrewingNoteImageMetadata(driver, 'note-a', [
        noteImage('duplicate-position-a', 'note-a', 0, 'original'),
        noteImage('duplicate-position-b', 'note-a', 0, 'original'),
      ])
    ).rejects.toThrow(/Duplicate brewing note image position and variant/);
    expect(await listBrewingNoteImageMetadata(driver, 'note-a')).toEqual([
      existing,
    ]);

    await expect(
      replaceBrewingNoteImageMetadata(driver, 'note-a', [
        noteImage('duplicate-id', 'note-a', 0, 'original'),
        noteImage('duplicate-id', 'note-a', 1, 'original'),
      ])
    ).rejects.toThrow(/Duplicate image_id/);
    expect(await listBrewingNoteImageMetadata(driver, 'note-a')).toEqual([
      existing,
    ]);
  });

  it('rolls back owner replacement when the caller transaction rejects', async () => {
    const driver = getDriver();
    const existing = [
      beanImage('bean-a-existing-front', 'bean-a', 'front', 'original'),
      beanImage('bean-a-existing-back', 'bean-a', 'back', 'original'),
    ];
    await replaceCoffeeBeanImageMetadata(driver, 'bean-a', existing);

    await expect(
      driver.transaction(async tx => {
        await replaceCoffeeBeanImageMetadata(tx, 'bean-a', [
          beanImage('bean-a-new-front', 'bean-a', 'front', 'original'),
        ]);
        throw new Error('abort outer transaction');
      })
    ).rejects.toThrow('abort outer transaction');

    expect(await listCoffeeBeanImageMetadata(driver, 'bean-a')).toEqual(
      existing
    );
  });

  it('restores old rows when an INSERT fails after owner DELETE and an earlier INSERT', async () => {
    const driver = getDriver();
    const existing = [
      beanImage('bean-a-existing-front', 'bean-a', 'front', 'original'),
      beanImage('bean-a-existing-back', 'bean-a', 'back', 'original'),
    ];
    await replaceCoffeeBeanImageMetadata(driver, 'bean-a', existing);
    const desired = [
      beanImage('bean-a-new-front', 'bean-a', 'front', 'original'),
      beanImage('bean-a-new-back', 'bean-a', 'back', 'original'),
    ];

    await expect(
      driver.transaction(tx =>
        replaceCoffeeBeanImageMetadata(
          failOnSecondBeanInsert(tx),
          'bean-a',
          desired
        )
      )
    ).rejects.toThrow('Injected failure before second bean image INSERT');

    expect(await listCoffeeBeanImageMetadata(driver, 'bean-a')).toEqual(
      existing
    );
  });

  it('rejects malformed rows returned by SQLite instead of skipping them', async () => {
    const row = encodeCoffeeBeanImageMetadata(
      beanImage('malformed-stored', 'bean-corrupt', 'front', 'original')
    );
    await getDriver().execute(
      'INSERT INTO coffee_bean_images (' +
        'image_id, bean_id, slot, variant, relative_path, mime_type, size_bytes, sha256, updated_at_ms' +
        ') VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        row.image_id,
        row.bean_id,
        row.slot,
        row.variant,
        '/absolute/stored.jpg',
        row.mime_type,
        row.size_bytes,
        row.sha256,
        row.updated_at_ms,
      ]
    );

    await expect(
      listCoffeeBeanImageMetadata(getDriver(), 'bean-corrupt')
    ).rejects.toThrow(/relativePath/);
    await expect(
      getCoffeeBeanImageMetadata(
        getDriver(),
        'bean-corrupt',
        'front',
        'original'
      )
    ).rejects.toThrow(/relativePath/);
  });

  it('rejects an impossible multi-row logical get result', async () => {
    const row = encodeCoffeeBeanImageMetadata(
      beanImage('cardinality-row', 'bean-cardinality', 'front', 'original')
    );
    const rawRow = row as unknown as SqlRow;
    const executor: SqliteExecutor = {
      async execute() {
        return { changes: 0 };
      },
      async query() {
        return [rawRow, rawRow];
      },
    };

    await expect(
      getCoffeeBeanImageMetadata(
        executor,
        'bean-cardinality',
        'front',
        'original'
      )
    ).rejects.toThrow(/returned multiple rows/);
  });
});
