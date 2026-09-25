import { describe, expect, it } from 'vitest';
import {
  decodeBrewingNoteImageMetadata,
  decodeCoffeeBeanImageMetadata,
  encodeBrewingNoteImageMetadata,
  encodeCoffeeBeanImageMetadata,
} from './imageMetadata';
import { SQLITE_SCHEMA_V1_SQL, SQLITE_SCHEMA_VERSION } from './schemaV1';
import type { LegacySourcePresenceMap } from './schemaV1';

describe('SQLite v1 image metadata rows', () => {
  it('round-trips bean front/back originals independently and allows absent thumbnails', () => {
    const front = {
      imageId: 'img-front-original',
      beanId: 'bean-1',
      slot: 'front',
      variant: 'original',
      relativePath: 'coffee-beans/bean-1/front/original.jpg',
      mimeType: 'IMAGE/JPEG; charset=binary',
      sizeBytes: 0,
      sha256: 'a'.repeat(64),
      updatedAt: 1_780_000_000_000,
    } as const;
    const back = {
      imageId: 'img-back-original',
      beanId: 'bean-1',
      slot: 'back',
      variant: 'original',
      relativePath: 'coffee-beans/bean-1/back/source.bin',
      mimeType: 'application/octet-stream',
      sizeBytes: 2048,
    } as const;
    const frontRow = encodeCoffeeBeanImageMetadata(front);
    const backRow = encodeCoffeeBeanImageMetadata(back);
    expect(decodeCoffeeBeanImageMetadata(frontRow)).toEqual(front);
    expect(decodeCoffeeBeanImageMetadata(backRow)).toEqual(back);
    expect(frontRow.mime_type).toBe(front.mimeType);
    expect(frontRow.sha256).toBe(front.sha256);
    expect(backRow.updated_at_ms).toBeNull();

    const thumbnail = encodeCoffeeBeanImageMetadata({
      ...front,
      imageId: 'img-front-thumbnail',
      variant: 'thumbnail',
      relativePath: 'coffee-beans/bean-1/front/thumb.webp',
    });
    expect(thumbnail.variant).toBe('thumbnail');
    expect(thumbnail.relative_path).toContain('thumb.webp');
  });

  it('round-trips note image positions, including zero, with optional thumbnail rows', () => {
    const first = {
      imageId: 'note-image-0',
      noteId: 'note-1',
      position: 0,
      variant: 'original',
      relativePath: 'brewing-notes/note-1/0/original.png',
      mimeType: 'image/png',
      sizeBytes: 500,
    } as const;
    const second = {
      ...first,
      imageId: 'note-image-1',
      position: 1,
      variant: 'original',
      relativePath: 'brewing-notes/note-1/1/original.webp',
      mimeType: 'image/webp',
      sizeBytes: 900,
    } as const;
    expect(
      decodeBrewingNoteImageMetadata(encodeBrewingNoteImageMetadata(first))
    ).toEqual(first);
    expect(
      decodeBrewingNoteImageMetadata(encodeBrewingNoteImageMetadata(second))
    ).toEqual(second);
    expect(
      encodeBrewingNoteImageMetadata({
        ...first,
        imageId: 'note-image-0-thumb',
        variant: 'thumbnail',
        relativePath: 'brewing-notes/note-1/0/thumbnail.webp',
      }).variant
    ).toBe('thumbnail');
  });

  it.each([
    ['/absolute.jpg', 'expected an app-private relative path'],
    ['C:\\photos\\bean.jpg', 'expected an app-private relative path'],
    ['file:///photos/bean.jpg', 'expected an app-private relative path'],
    ['../outside.jpg', 'expected an app-private relative path'],
  ])('rejects path %s', (relativePath, reason) => {
    expect(() =>
      encodeCoffeeBeanImageMetadata({
        imageId: 'img-1',
        beanId: 'bean-1',
        slot: 'front',
        variant: 'original',
        relativePath,
        mimeType: 'image/jpeg',
        sizeBytes: 1,
      })
    ).toThrow(reason);
  });

  it.each([
    ['sizeBytes', -1],
    ['sizeBytes', 1.5],
    ['sizeBytes', Number.MAX_SAFE_INTEGER + 1],
  ])('rejects invalid %s value %s', (field, value) => {
    expect(() =>
      encodeCoffeeBeanImageMetadata({
        imageId: 'img-1',
        beanId: 'bean-1',
        slot: 'front',
        variant: 'original',
        relativePath: 'bean/front/original.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: field === 'sizeBytes' ? value : 1,
        updatedAt: field === 'updatedAt' ? value : undefined,
      })
    ).toThrow(/sizeBytes|updatedAt/);
  });

  it('validates bean slots, variants, note positions and optional lowercase SHA-256', () => {
    const beanMetadata = {
      imageId: 'img-1',
      beanId: 'bean-1',
      slot: 'side',
      variant: 'original',
      relativePath: 'bean/front/original.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1,
    };
    expect(() => encodeCoffeeBeanImageMetadata(beanMetadata)).toThrow(/slot/);
    expect(() =>
      encodeCoffeeBeanImageMetadata({
        ...beanMetadata,
        slot: 'front',
        variant: 'small',
      })
    ).toThrow(/variant/);
    expect(() =>
      encodeCoffeeBeanImageMetadata({
        ...beanMetadata,
        slot: 'front',
        sha256: 'A'.repeat(64),
      })
    ).toThrow(/sha256/);
    expect(() =>
      encodeBrewingNoteImageMetadata({
        imageId: 'img-note',
        noteId: 'note-1',
        position: -1,
        variant: 'original',
        relativePath: 'note/0/original.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 1,
      })
    ).toThrow(/position/);
  });

  it('specifies v1 tables and only query-backed order/lookup indexes without executing SQL', () => {
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
    const declaredTables = (
      SQLITE_SCHEMA_V1_SQL.match(/CREATE TABLE [a-z_]+/g) ?? []
    ).map(statement => statement.replace('CREATE TABLE ', ''));
    expect(declaredTables).toEqual([
      'coffee_beans',
      'brewing_notes',
      'custom_equipments',
      'custom_methods',
      'grinders',
      'app_settings',
      'legacy_settings',
      'pending_operations',
      'historical_yearly_reports',
      'coffee_bean_images',
      'brewing_note_images',
      'migration_state',
    ]);
    expect(SQLITE_SCHEMA_V1_SQL).toContain(
      'CREATE TABLE historical_yearly_reports'
    );
    expect(SQLITE_SCHEMA_V1_SQL).toContain('CREATE TABLE coffee_bean_images');
    expect(SQLITE_SCHEMA_V1_SQL).toContain('CREATE TABLE brewing_note_images');
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
    expect(SQLITE_SCHEMA_V1_SQL).toMatch(
      /CREATE TABLE coffee_beans \([\s\S]*?timestamp_ms INTEGER NOT NULL,/
    );
    expect(SQLITE_SCHEMA_V1_SQL).toMatch(
      /CREATE TABLE brewing_notes \([\s\S]*?timestamp_ms INTEGER NOT NULL,/
    );
    expect(SQLITE_SCHEMA_V1_SQL).toContain('timestamp_ms INTEGER NOT NULL');
    expect(SQLITE_SCHEMA_V1_SQL).not.toContain(
      'CREATE INDEX idx_historical_yearly_reports'
    );
  });
});
