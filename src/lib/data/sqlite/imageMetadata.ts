import type {
  BrewingNoteImageMetadataRow,
  CoffeeBeanImageMetadataRow,
  CoffeeBeanImageSlot,
  SQLiteImageVariant,
} from './schemaV1';
import {
  assertPlainRecord,
  assertSafeInteger,
  assertString,
  assertStringId,
  assertTimestampMs,
  canonicalizePersistedSnapshot,
  codecError,
} from './serialization';
import { validateExternalImageUrl } from '../images/persistentImageSource';

export type ImageSourceKind = 'file' | 'external';

export type FileImageSource = {
  sourceKind: 'file';
  variant: SQLiteImageVariant;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
};

export type ExternalImageSource = {
  sourceKind: 'external';
  variant: 'original';
  externalUrl: string;
};

interface ImageMetadataBase {
  imageId: string;
  updatedAt?: number;
}

export type CoffeeBeanImageMetadata = ImageMetadataBase & {
  beanId: string;
  slot: CoffeeBeanImageSlot;
} & (FileImageSource | ExternalImageSource);

export type BrewingNoteImageMetadata = ImageMetadataBase & {
  noteId: string;
  position: number;
} & (FileImageSource | ExternalImageSource);

type MetadataContext = { table: string; recordId?: string };

function canonicalMetadataRecord(
  value: unknown,
  table: string
): { record: Record<string, unknown>; context: MetadataContext } {
  const initial = assertPlainRecord(value, { table });
  const descriptor = Object.getOwnPropertyDescriptor(initial, 'imageId');
  const imageId =
    descriptor && 'value' in descriptor && typeof descriptor.value === 'string'
      ? descriptor.value
      : undefined;
  const context = {
    table,
    ...(imageId !== undefined ? { recordId: imageId } : {}),
  };
  return {
    record: assertPlainRecord(
      canonicalizePersistedSnapshot(initial, context),
      context
    ),
    context,
  };
}

function assertMetadataKeys(
  record: Record<string, unknown>,
  keys: ReadonlySet<string>,
  context: MetadataContext
): void {
  for (const key of Object.keys(record)) {
    if (!keys.has(key)) {
      codecError(
        context,
        key,
        'field is not represented by this image metadata source'
      );
    }
  }
}

const beanFileKeys = new Set([
  'imageId',
  'beanId',
  'slot',
  'sourceKind',
  'variant',
  'relativePath',
  'mimeType',
  'sizeBytes',
  'sha256',
  'updatedAt',
]);
const beanExternalKeys = new Set([
  'imageId',
  'beanId',
  'slot',
  'sourceKind',
  'variant',
  'externalUrl',
  'updatedAt',
]);
const noteFileKeys = new Set([
  'imageId',
  'noteId',
  'position',
  'sourceKind',
  'variant',
  'relativePath',
  'mimeType',
  'sizeBytes',
  'sha256',
  'updatedAt',
]);
const noteExternalKeys = new Set([
  'imageId',
  'noteId',
  'position',
  'sourceKind',
  'variant',
  'externalUrl',
  'updatedAt',
]);

function validatePath(value: unknown, table: string, recordId: string): string {
  const context = { table, recordId };
  const path = assertString(value, context, 'relativePath');
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.startsWith('\\') ||
    /^[a-zA-Z]:/.test(path) ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(path) ||
    path.includes('\0') ||
    path.split(/[\\/]+/).some(segment => segment === '..')
  ) {
    codecError(
      context,
      'relativePath',
      'expected an app-private relative path'
    );
  }
  return path;
}

function validateVariant(
  value: unknown,
  table: string,
  recordId: string
): SQLiteImageVariant {
  if (value !== 'original' && value !== 'thumbnail') {
    codecError(
      { table, recordId },
      'variant',
      'expected original or thumbnail'
    );
  }
  return value;
}

function validateBeanSlot(
  value: unknown,
  table: string,
  recordId: string
): CoffeeBeanImageSlot {
  if (value !== 'front' && value !== 'back') {
    codecError({ table, recordId }, 'slot', 'expected front or back');
  }
  return value;
}

function validateUpdatedAt(
  value: unknown,
  table: string,
  recordId: string
): number | undefined {
  return value === undefined
    ? undefined
    : assertTimestampMs(value, { table, recordId }, 'updatedAt');
}

function validateFileSource(
  record: Record<string, unknown>,
  table: string,
  recordId: string
): {
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
} {
  const context = { table, recordId };
  const relativePath = validatePath(record.relativePath, table, recordId);
  const mimeType = assertString(record.mimeType, context, 'mimeType');
  const sizeBytes = assertSafeInteger(record.sizeBytes, context, 'sizeBytes');
  if (sizeBytes < 0) codecError(context, 'sizeBytes', 'must be >= 0');

  let sha256: string | undefined;
  if (record.sha256 !== undefined) {
    sha256 = assertString(record.sha256, context, 'sha256');
    if (!/^[0-9a-f]{64}$/.test(sha256)) {
      codecError(
        context,
        'sha256',
        'expected 64 lowercase hexadecimal characters'
      );
    }
  }

  return { relativePath, mimeType, sizeBytes, sha256 };
}

function validateExternalSource(
  record: Record<string, unknown>,
  table: string,
  recordId: string
): string {
  if (record.variant !== 'original') {
    codecError(
      { table, recordId },
      'variant',
      'external image metadata only supports original'
    );
  }
  const externalUrl = assertString(
    record.externalUrl,
    { table, recordId },
    'externalUrl'
  );
  try {
    return validateExternalImageUrl(externalUrl);
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'invalid external image URL';
    codecError({ table, recordId }, 'externalUrl', reason);
  }
}

function nullableUpdatedAt(
  value: unknown,
  table: string,
  recordId: string
): number | undefined {
  return value === null
    ? undefined
    : assertTimestampMs(value, { table, recordId }, 'updated_at_ms');
}

function decodeFileRowFields(
  row: {
    relative_path: unknown;
    mime_type: unknown;
    size_bytes: unknown;
    sha256: unknown;
    external_url: unknown;
  },
  table: string,
  recordId: string
) {
  const context = { table, recordId };
  if (row.external_url !== null) {
    codecError(context, 'external_url', 'file source must not contain a URL');
  }
  const relativePath = validatePath(row.relative_path, table, recordId);
  const mimeType = assertString(row.mime_type, context, 'mime_type');
  const sizeBytes = assertSafeInteger(row.size_bytes, context, 'size_bytes');
  if (sizeBytes < 0) codecError(context, 'size_bytes', 'must be >= 0');

  let sha256: string | undefined;
  if (row.sha256 !== null) {
    sha256 = assertString(row.sha256, context, 'sha256');
    if (!/^[0-9a-f]{64}$/.test(sha256)) {
      codecError(
        context,
        'sha256',
        'expected 64 lowercase hexadecimal characters'
      );
    }
  }

  return {
    relativePath,
    mimeType,
    sizeBytes,
    ...(sha256 !== undefined ? { sha256 } : {}),
  };
}

function decodeExternalRowFields(
  row: {
    variant: unknown;
    relative_path: unknown;
    mime_type: unknown;
    size_bytes: unknown;
    sha256: unknown;
    external_url: unknown;
  },
  table: string,
  recordId: string
): { variant: 'original'; externalUrl: string } {
  const context = { table, recordId };
  if (row.variant !== 'original') {
    codecError(
      context,
      'variant',
      'external image metadata only supports original'
    );
  }
  if (row.relative_path !== null) {
    codecError(
      context,
      'relative_path',
      'external source must not contain a path'
    );
  }
  if (row.mime_type !== null) {
    codecError(
      context,
      'mime_type',
      'external source must not contain a MIME type'
    );
  }
  if (row.size_bytes !== null) {
    codecError(
      context,
      'size_bytes',
      'external source must not contain a file size'
    );
  }
  if (row.sha256 !== null) {
    codecError(
      context,
      'sha256',
      'external source must not contain a checksum'
    );
  }

  const externalUrl = assertString(row.external_url, context, 'external_url');
  try {
    return {
      variant: 'original',
      externalUrl: validateExternalImageUrl(externalUrl),
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'invalid external image URL';
    codecError(context, 'external_url', reason);
  }
}

function decodeUpdatedAt(
  value: unknown,
  table: string,
  recordId: string
): { updatedAt?: number } {
  const updatedAt = nullableUpdatedAt(value, table, recordId);
  return updatedAt === undefined ? {} : { updatedAt };
}

function assertSourceKind(
  value: unknown,
  table: string,
  recordId: string
): 'file' | 'external' {
  if (value !== 'file' && value !== 'external') {
    codecError({ table, recordId }, 'source_kind', 'expected file or external');
  }
  return value;
}

export function encodeCoffeeBeanImageMetadata(
  value: unknown
): CoffeeBeanImageMetadataRow {
  const { record, context: initialContext } = canonicalMetadataRecord(
    value,
    'coffee_bean_images'
  );
  const imageId = assertStringId(record.imageId, initialContext, 'imageId');
  const context = { table: 'coffee_bean_images', recordId: imageId };
  const sourceKind = assertSourceKind(
    record.sourceKind,
    context.table,
    imageId
  );
  assertMetadataKeys(
    record,
    sourceKind === 'file' ? beanFileKeys : beanExternalKeys,
    context
  );
  const beanId = assertStringId(record.beanId, context, 'beanId');
  const slot = validateBeanSlot(record.slot, context.table, imageId);
  const updatedAt = validateUpdatedAt(record.updatedAt, context.table, imageId);

  if (sourceKind === 'file') {
    const variant = validateVariant(record.variant, context.table, imageId);
    const file = validateFileSource(record, context.table, imageId);
    return {
      image_id: imageId,
      bean_id: beanId,
      slot,
      variant,
      source_kind: 'file',
      relative_path: file.relativePath,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      sha256: file.sha256 ?? null,
      external_url: null,
      updated_at_ms: updatedAt ?? null,
    };
  }

  const externalUrl = validateExternalSource(record, context.table, imageId);
  return {
    image_id: imageId,
    bean_id: beanId,
    slot,
    variant: 'original',
    source_kind: 'external',
    relative_path: null,
    mime_type: null,
    size_bytes: null,
    sha256: null,
    external_url: externalUrl,
    updated_at_ms: updatedAt ?? null,
  };
}

export function decodeCoffeeBeanImageMetadata(
  row: CoffeeBeanImageMetadataRow
): CoffeeBeanImageMetadata {
  const imageId = assertStringId(
    row.image_id,
    { table: 'coffee_bean_images' },
    'image_id'
  );
  const context = { table: 'coffee_bean_images', recordId: imageId };
  const beanId = assertStringId(row.bean_id, context, 'bean_id');
  const slot = validateBeanSlot(row.slot, context.table, imageId);
  const updated = decodeUpdatedAt(row.updated_at_ms, context.table, imageId);
  const sourceKind = assertSourceKind(row.source_kind, context.table, imageId);

  if (sourceKind === 'file') {
    const file = decodeFileRowFields(row, context.table, imageId);
    return {
      imageId,
      beanId,
      slot,
      sourceKind,
      variant: validateVariant(row.variant, context.table, imageId),
      ...file,
      ...updated,
    };
  }

  const external = decodeExternalRowFields(row, context.table, imageId);
  return { imageId, beanId, slot, sourceKind, ...external, ...updated };
}

export function encodeBrewingNoteImageMetadata(
  value: unknown
): BrewingNoteImageMetadataRow {
  const { record, context: initialContext } = canonicalMetadataRecord(
    value,
    'brewing_note_images'
  );
  const imageId = assertStringId(record.imageId, initialContext, 'imageId');
  const context = { table: 'brewing_note_images', recordId: imageId };
  const sourceKind = assertSourceKind(
    record.sourceKind,
    context.table,
    imageId
  );
  assertMetadataKeys(
    record,
    sourceKind === 'file' ? noteFileKeys : noteExternalKeys,
    context
  );
  const noteId = assertStringId(record.noteId, context, 'noteId');
  const position = assertSafeInteger(record.position, context, 'position');
  if (position < 0) codecError(context, 'position', 'must be >= 0');
  const updatedAt = validateUpdatedAt(record.updatedAt, context.table, imageId);

  if (sourceKind === 'file') {
    const variant = validateVariant(record.variant, context.table, imageId);
    const file = validateFileSource(record, context.table, imageId);
    return {
      image_id: imageId,
      note_id: noteId,
      position,
      variant,
      source_kind: 'file',
      relative_path: file.relativePath,
      mime_type: file.mimeType,
      size_bytes: file.sizeBytes,
      sha256: file.sha256 ?? null,
      external_url: null,
      updated_at_ms: updatedAt ?? null,
    };
  }

  const externalUrl = validateExternalSource(record, context.table, imageId);
  return {
    image_id: imageId,
    note_id: noteId,
    position,
    variant: 'original',
    source_kind: 'external',
    relative_path: null,
    mime_type: null,
    size_bytes: null,
    sha256: null,
    external_url: externalUrl,
    updated_at_ms: updatedAt ?? null,
  };
}

export function decodeBrewingNoteImageMetadata(
  row: BrewingNoteImageMetadataRow
): BrewingNoteImageMetadata {
  const imageId = assertStringId(
    row.image_id,
    { table: 'brewing_note_images' },
    'image_id'
  );
  const context = { table: 'brewing_note_images', recordId: imageId };
  const noteId = assertStringId(row.note_id, context, 'note_id');
  const position = assertSafeInteger(row.position, context, 'position');
  if (position < 0) codecError(context, 'position', 'must be >= 0');
  const updated = decodeUpdatedAt(row.updated_at_ms, context.table, imageId);
  const sourceKind = assertSourceKind(row.source_kind, context.table, imageId);

  if (sourceKind === 'file') {
    const file = decodeFileRowFields(row, context.table, imageId);
    return {
      imageId,
      noteId,
      position,
      sourceKind,
      variant: validateVariant(row.variant, context.table, imageId),
      ...file,
      ...updated,
    };
  }

  const external = decodeExternalRowFields(row, context.table, imageId);
  return { imageId, noteId, position, sourceKind, ...external, ...updated };
}
