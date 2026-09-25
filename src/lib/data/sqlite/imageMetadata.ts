import type {
  BrewingNoteImageMetadataRow,
  CoffeeBeanImageMetadataRow,
  SQLiteImageVariant,
} from './schemaV1';
import type { CoffeeBeanImageSlot } from './schemaV1';
import {
  assertPlainRecord,
  assertSafeInteger,
  assertString,
  assertStringId,
  assertTimestampMs,
  canonicalizePersistedSnapshot,
  codecError,
} from './serialization';

export interface CoffeeBeanImageMetadata {
  imageId: string;
  beanId: string;
  slot: CoffeeBeanImageSlot;
  variant: SQLiteImageVariant;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  updatedAt?: number;
}

export interface BrewingNoteImageMetadata {
  imageId: string;
  noteId: string;
  position: number;
  variant: SQLiteImageVariant;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256?: string;
  updatedAt?: number;
}

const canonicalMetadataRecord = (
  value: unknown,
  table: string
): {
  record: Record<string, unknown>;
  context: { table: string; recordId?: string };
} => {
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
};

const assertMetadataKeys = (
  record: Record<string, unknown>,
  keys: ReadonlySet<string>,
  context: { table: string; recordId?: string }
): void => {
  for (const key of Object.keys(record)) {
    if (!keys.has(key)) {
      codecError(
        context,
        key,
        'unknown field is not represented by image metadata row'
      );
    }
  }
};

const beanMetadataKeys = new Set([
  'imageId',
  'beanId',
  'slot',
  'variant',
  'relativePath',
  'mimeType',
  'sizeBytes',
  'sha256',
  'updatedAt',
]);
const noteMetadataKeys = new Set([
  'imageId',
  'noteId',
  'position',
  'variant',
  'relativePath',
  'mimeType',
  'sizeBytes',
  'sha256',
  'updatedAt',
]);

const validatePath = (
  value: unknown,
  table: string,
  recordId: string
): string => {
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
};

const validateVariant = (
  value: unknown,
  table: string,
  recordId: string
): SQLiteImageVariant => {
  if (value !== 'original' && value !== 'thumbnail') {
    codecError(
      { table, recordId },
      'variant',
      'expected original or thumbnail'
    );
  }
  return value;
};

const validateBeanSlot = (
  value: unknown,
  table: string,
  recordId: string
): CoffeeBeanImageSlot => {
  if (value !== 'front' && value !== 'back') {
    codecError({ table, recordId }, 'slot', 'expected front or back');
  }
  return value;
};

const validateCommon = (
  input: Record<string, unknown>,
  table: string,
  imageId: string
) => {
  const context = { table, recordId: imageId };
  const relativePath = validatePath(input.relativePath, table, imageId);
  const mimeType = assertString(input.mimeType, context, 'mimeType');
  const sizeBytes = assertSafeInteger(input.sizeBytes, context, 'sizeBytes');
  if (sizeBytes < 0) codecError(context, 'sizeBytes', 'must be >= 0');

  let sha256: string | undefined;
  if (input.sha256 !== undefined) {
    sha256 = assertString(input.sha256, context, 'sha256');
    if (!/^[0-9a-f]{64}$/.test(sha256)) {
      codecError(
        context,
        'sha256',
        'expected 64 lowercase hexadecimal characters'
      );
    }
  }

  let updatedAt: number | undefined;
  if (input.updatedAt !== undefined) {
    updatedAt = assertTimestampMs(input.updatedAt, context, 'updatedAt');
  }

  return { relativePath, mimeType, sizeBytes, sha256, updatedAt };
};

export function encodeCoffeeBeanImageMetadata(
  value: unknown
): CoffeeBeanImageMetadataRow {
  const { record, context: initialContext } = canonicalMetadataRecord(
    value,
    'coffee_bean_images'
  );
  const imageId = assertStringId(record.imageId, initialContext, 'imageId');
  const context = { table: 'coffee_bean_images', recordId: imageId };
  assertMetadataKeys(record, beanMetadataKeys, context);
  const beanId = assertStringId(record.beanId, context, 'beanId');
  const slot = validateBeanSlot(record.slot, 'coffee_bean_images', imageId);
  const variant = validateVariant(
    record.variant,
    'coffee_bean_images',
    imageId
  );
  const common = validateCommon(record, 'coffee_bean_images', imageId);
  return {
    image_id: imageId,
    bean_id: beanId,
    slot,
    variant,
    relative_path: common.relativePath,
    mime_type: common.mimeType,
    size_bytes: common.sizeBytes,
    sha256: common.sha256 ?? null,
    updated_at_ms: common.updatedAt ?? null,
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
  const updatedAt =
    row.updated_at_ms === null
      ? undefined
      : assertTimestampMs(row.updated_at_ms, context, 'updated_at_ms');
  const sha256 =
    row.sha256 === null
      ? undefined
      : assertString(row.sha256, context, 'sha256');
  const result: CoffeeBeanImageMetadata = {
    imageId,
    beanId: assertStringId(row.bean_id, context, 'bean_id'),
    slot: validateBeanSlot(row.slot, 'coffee_bean_images', imageId),
    variant: validateVariant(row.variant, 'coffee_bean_images', imageId),
    relativePath: validatePath(
      row.relative_path,
      'coffee_bean_images',
      imageId
    ),
    mimeType: assertString(row.mime_type, context, 'mime_type'),
    sizeBytes: assertSafeInteger(row.size_bytes, context, 'size_bytes'),
    ...(sha256 !== undefined ? { sha256 } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
  if (result.sizeBytes < 0) codecError(context, 'size_bytes', 'must be >= 0');
  if (sha256 !== undefined && !/^[0-9a-f]{64}$/.test(sha256)) {
    codecError(
      context,
      'sha256',
      'expected 64 lowercase hexadecimal characters'
    );
  }
  return result;
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
  assertMetadataKeys(record, noteMetadataKeys, context);
  const noteId = assertStringId(record.noteId, context, 'noteId');
  const position = assertSafeInteger(record.position, context, 'position');
  if (position < 0) codecError(context, 'position', 'must be >= 0');
  const variant = validateVariant(
    record.variant,
    'brewing_note_images',
    imageId
  );
  const common = validateCommon(record, 'brewing_note_images', imageId);
  return {
    image_id: imageId,
    note_id: noteId,
    position,
    variant,
    relative_path: common.relativePath,
    mime_type: common.mimeType,
    size_bytes: common.sizeBytes,
    sha256: common.sha256 ?? null,
    updated_at_ms: common.updatedAt ?? null,
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
  const updatedAt =
    row.updated_at_ms === null
      ? undefined
      : assertTimestampMs(row.updated_at_ms, context, 'updated_at_ms');
  const sha256 =
    row.sha256 === null
      ? undefined
      : assertString(row.sha256, context, 'sha256');
  const result: BrewingNoteImageMetadata = {
    imageId,
    noteId: assertStringId(row.note_id, context, 'note_id'),
    position: assertSafeInteger(row.position, context, 'position'),
    variant: validateVariant(row.variant, 'brewing_note_images', imageId),
    relativePath: validatePath(
      row.relative_path,
      'brewing_note_images',
      imageId
    ),
    mimeType: assertString(row.mime_type, context, 'mime_type'),
    sizeBytes: assertSafeInteger(row.size_bytes, context, 'size_bytes'),
    ...(sha256 !== undefined ? { sha256 } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
  };
  if (result.position < 0) codecError(context, 'position', 'must be >= 0');
  if (result.sizeBytes < 0) codecError(context, 'size_bytes', 'must be >= 0');
  if (sha256 !== undefined && !/^[0-9a-f]{64}$/.test(sha256)) {
    codecError(
      context,
      'sha256',
      'expected 64 lowercase hexadecimal characters'
    );
  }
  return result;
}
