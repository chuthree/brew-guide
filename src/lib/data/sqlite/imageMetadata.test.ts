import { describe, expect, it } from 'vitest';
import {
  decodeBrewingNoteImageMetadata,
  decodeCoffeeBeanImageMetadata,
  encodeBrewingNoteImageMetadata,
  encodeCoffeeBeanImageMetadata,
} from './imageMetadata';
import type {
  BrewingNoteImageMetadataRow,
  CoffeeBeanImageMetadataRow,
  LegacySourcePresenceMap,
} from './schemaV1';
import { SQLITE_SCHEMA_V1_SQL, SQLITE_SCHEMA_VERSION } from './schemaV1';

const beanFile = {
  imageId: 'bean-file-front',
  beanId: 'bean-1',
  slot: 'front',
  sourceKind: 'file',
  variant: 'original',
  relativePath: 'coffee-beans/bean-1/front/original.jpg',
  mimeType: 'IMAGE/JPEG; charset=binary',
  sizeBytes: 0,
  sha256: 'a'.repeat(64),
  updatedAt: 1_780_000_000_000,
} as const;

const beanExternal = {
  imageId: 'bean-external-back',
  beanId: 'bean-1',
  slot: 'back',
  sourceKind: 'external',
  variant: 'original',
  externalUrl: 'https://Example.COM/a%2Fb?b=2&a=1#Frag',
  updatedAt: 1_780_000_000_001,
} as const;

const noteFile = {
  imageId: 'note-file-1',
  noteId: 'note-1',
  position: 1,
  sourceKind: 'file',
  variant: 'original',
  relativePath: 'brewing-notes/note-1/1/original.webp',
  mimeType: 'image/webp',
  sizeBytes: 900,
} as const;

const noteExternal = {
  imageId: 'note-external-0',
  noteId: 'note-1',
  position: 0,
  sourceKind: 'external',
  variant: 'original',
  externalUrl: 'http://example.com/note.jpg?signature=fake#view',
} as const;

describe('SQLite v1 image metadata source-aware rows', () => {
  it('round-trips Bean file metadata without changing the existing file contract', () => {
    const row = encodeCoffeeBeanImageMetadata(beanFile);
    expect(decodeCoffeeBeanImageMetadata(row)).toEqual(beanFile);
    expect(row).toMatchObject({
      source_kind: 'file',
      relative_path: beanFile.relativePath,
      mime_type: beanFile.mimeType,
      size_bytes: 0,
      sha256: beanFile.sha256,
      external_url: null,
      updated_at_ms: beanFile.updatedAt,
    });

    const back = encodeCoffeeBeanImageMetadata({
      ...beanFile,
      imageId: 'bean-file-back',
      slot: 'back',
      sha256: undefined,
      updatedAt: undefined,
    });
    expect(decodeCoffeeBeanImageMetadata(back)).toEqual({
      ...beanFile,
      imageId: 'bean-file-back',
      slot: 'back',
      sha256: undefined,
      updatedAt: undefined,
    });
    expect(back.sha256).toBeNull();
    expect(back.updated_at_ms).toBeNull();

    const thumbnail = encodeCoffeeBeanImageMetadata({
      ...beanFile,
      imageId: 'bean-file-front-thumbnail',
      variant: 'thumbnail',
      relativePath: 'coffee-beans/bean-1/front/thumb.webp',
    });
    expect(thumbnail.variant).toBe('thumbnail');
    expect(thumbnail.relative_path).toContain('thumb.webp');
  });

  it('round-trips HTTP and HTTPS external references exactly', () => {
    const httpsRow = encodeCoffeeBeanImageMetadata(beanExternal);
    expect(decodeCoffeeBeanImageMetadata(httpsRow)).toEqual(beanExternal);
    expect(httpsRow).toMatchObject({
      source_kind: 'external',
      relative_path: null,
      mime_type: null,
      size_bytes: null,
      sha256: null,
      external_url: beanExternal.externalUrl,
      updated_at_ms: beanExternal.updatedAt,
    });

    const httpRow = encodeBrewingNoteImageMetadata(noteExternal);
    expect(decodeBrewingNoteImageMetadata(httpRow)).toEqual(noteExternal);
    expect(httpRow.external_url).toBe(noteExternal.externalUrl);
    expect(httpRow.relative_path).toBeNull();
    expect(httpRow.mime_type).toBeNull();
    expect(httpRow.size_bytes).toBeNull();
    expect(httpRow.sha256).toBeNull();
  });

  it('round-trips note file positions and file thumbnails', () => {
    const first = encodeBrewingNoteImageMetadata({ ...noteFile, position: 0 });
    const second = encodeBrewingNoteImageMetadata(noteFile);
    expect(decodeBrewingNoteImageMetadata(first)).toEqual({
      ...noteFile,
      position: 0,
    });
    expect(decodeBrewingNoteImageMetadata(second)).toEqual(noteFile);

    const thumbnail = encodeBrewingNoteImageMetadata({
      ...noteFile,
      imageId: 'note-file-1-thumb',
      variant: 'thumbnail',
      relativePath: 'brewing-notes/note-1/1/thumbnail.webp',
    });
    expect(thumbnail.variant).toBe('thumbnail');
    expect(thumbnail.external_url).toBeNull();
  });

  it.each([
    ['/absolute.jpg', 'expected an app-private relative path'],
    ['C:\\photos\\bean.jpg', 'expected an app-private relative path'],
    ['file:///photos/bean.jpg', 'expected an app-private relative path'],
    ['../outside.jpg', 'expected an app-private relative path'],
  ])('rejects file path %s', (relativePath, reason) => {
    expect(() =>
      encodeCoffeeBeanImageMetadata({ ...beanFile, relativePath })
    ).toThrow(reason);
  });

  it.each([
    ['sizeBytes', -1],
    ['sizeBytes', 1.5],
    ['sizeBytes', Number.MAX_SAFE_INTEGER + 1],
    ['updatedAt', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects invalid file %s value %s', (field, value) => {
    expect(() =>
      encodeCoffeeBeanImageMetadata({
        ...beanFile,
        sizeBytes: field === 'sizeBytes' ? value : beanFile.sizeBytes,
        updatedAt: field === 'updatedAt' ? value : beanFile.updatedAt,
      })
    ).toThrow(/sizeBytes|updatedAt/);
  });

  it('requires file source fields and validates slots, variants, positions and checksums', () => {
    expect(() =>
      encodeCoffeeBeanImageMetadata({ ...beanFile, slot: 'side' })
    ).toThrow(/slot/);
    expect(() =>
      encodeCoffeeBeanImageMetadata({ ...beanFile, variant: 'small' })
    ).toThrow(/variant/);
    expect(() =>
      encodeCoffeeBeanImageMetadata({ ...beanFile, sizeBytes: undefined })
    ).toThrow(/sizeBytes/);
    expect(() =>
      encodeCoffeeBeanImageMetadata({ ...beanFile, sha256: 'A'.repeat(64) })
    ).toThrow(/sha256/);
    expect(() =>
      encodeBrewingNoteImageMetadata({ ...noteFile, position: -1 })
    ).toThrow(/position/);
  });

  it('rejects external thumbnails and file-only fields on external inputs', () => {
    expect(() =>
      encodeCoffeeBeanImageMetadata({
        ...beanExternal,
        variant: 'thumbnail',
      })
    ).toThrow(/original/);
    expect(() =>
      encodeCoffeeBeanImageMetadata({
        ...beanExternal,
        relativePath: 'bean/front/original.jpg',
      })
    ).toThrow(/relativePath/);
    expect(() =>
      encodeBrewingNoteImageMetadata({
        ...noteExternal,
        mimeType: 'image/jpeg',
      })
    ).toThrow(/mimeType/);
  });

  it('rejects malformed source-aware rows returned from SQLite', () => {
    const beanFileRow = encodeCoffeeBeanImageMetadata(beanFile);
    const beanExternalRow = encodeCoffeeBeanImageMetadata(beanExternal);
    const noteExternalRow = encodeBrewingNoteImageMetadata(noteExternal);

    const malformedBeanRows: unknown[] = [
      { ...beanFileRow, external_url: beanExternal.externalUrl },
      { ...beanExternalRow, relative_path: 'unexpected.jpg' },
      { ...beanExternalRow, mime_type: 'image/jpeg' },
      { ...beanExternalRow, size_bytes: 1 },
      { ...beanExternalRow, sha256: 'a'.repeat(64) },
      { ...beanExternalRow, variant: 'thumbnail' },
      { ...beanExternalRow, source_kind: 'opaque' },
      { ...beanFileRow, size_bytes: null },
    ];
    for (const row of malformedBeanRows) {
      expect(() =>
        decodeCoffeeBeanImageMetadata(row as CoffeeBeanImageMetadataRow)
      ).toThrow();
    }

    const malformedNoteRow = {
      ...noteExternalRow,
      relative_path: 'unexpected.jpg',
    };
    expect(() =>
      decodeBrewingNoteImageMetadata(
        malformedNoteRow as BrewingNoteImageMetadataRow
      )
    ).toThrow(/relative_path/);
  });

  it('specifies the revised v1 schema while keeping source presence facts', () => {
    expect(SQLITE_SCHEMA_VERSION).toBe(1);
    const legacySourcePresence = {
      coffeeBeans: 'present-data',
      brewingNotes: 'present-empty',
      coffeeBeanImages: 'absent',
      coffeeBeanImageThumbnails: 'absent',
      brewingNoteImages: 'absent',
      brewingNoteImageThumbnails: 'absent',
      customEquipments: 'present-empty',
      customMethods: 'present-empty',
      grinders: 'present-empty',
      appSettings: 'present-data',
      settings: 'present-data',
      pendingOperations: 'absent',
      yearlyReports: 'present-empty',
    } satisfies LegacySourcePresenceMap;
    expect(legacySourcePresence.yearlyReports).toBe('present-empty');
    expect(legacySourcePresence.pendingOperations).toBe('absent');

    expect(SQLITE_SCHEMA_V1_SQL).toContain('CREATE TABLE coffee_bean_images');
    expect(SQLITE_SCHEMA_V1_SQL).toContain('CREATE TABLE brewing_note_images');
    for (const table of ['coffee_bean_images', 'brewing_note_images']) {
      const definition = SQLITE_SCHEMA_V1_SQL.match(
        new RegExp(`CREATE TABLE ${table} \\(([\\s\\S]*?)\\n\\);`)
      )?.[1];
      expect(definition).toBeDefined();
      expect(definition).toContain('source_kind TEXT NOT NULL');
      expect(definition).toContain('relative_path TEXT,');
      expect(definition).toContain('mime_type TEXT,');
      expect(definition).toContain('size_bytes INTEGER CHECK');
      expect(definition).toContain('external_url TEXT,');
      expect(definition).toContain("source_kind IN ('file', 'external')");
      expect(definition).toContain("variant = 'original'");
      expect(definition).toContain('external_url IS NULL');
      expect(definition).toContain('relative_path IS NULL');
      expect(definition).toContain('mime_type IS NULL');
      expect(definition).toContain('size_bytes IS NULL');
      expect(definition).toContain('sha256 IS NULL');
    }
    expect(SQLITE_SCHEMA_V1_SQL).toContain('UNIQUE (bean_id, slot, variant)');
    expect(SQLITE_SCHEMA_V1_SQL).toContain(
      'UNIQUE (note_id, position, variant)'
    );
    expect(SQLITE_SCHEMA_V1_SQL).toContain(
      'CREATE INDEX idx_brewing_notes_bean_timestamp_id'
    );
    expect(SQLITE_SCHEMA_V1_SQL).toContain(
      'CREATE INDEX idx_pending_operations_table_record'
    );
    expect(SQLITE_SCHEMA_V1_SQL).toContain(
      'CREATE INDEX idx_pending_operations_timestamp_id'
    );
    expect(SQLITE_SCHEMA_V1_SQL).toMatch(/table_name TEXT NOT NULL,/);
    expect(SQLITE_SCHEMA_V1_SQL).toMatch(/operation_type TEXT NOT NULL,/);
    expect(SQLITE_SCHEMA_V1_SQL).not.toMatch(/table_name[^\n]*CHECK/);
    expect(SQLITE_SCHEMA_V1_SQL).not.toMatch(/operation_type[^\n]*CHECK/);
    expect(SQLITE_SCHEMA_V1_SQL).not.toContain('FOREIGN KEY');
    expect(SQLITE_SCHEMA_V1_SQL).not.toContain('AUTOINCREMENT');
    expect(SQLITE_SCHEMA_V1_SQL).toContain('timestamp_ms INTEGER NOT NULL');
    expect(SQLITE_SCHEMA_V1_SQL).not.toContain(
      'CREATE INDEX idx_historical_yearly_reports'
    );
  });
});
