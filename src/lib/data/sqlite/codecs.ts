import type { CustomEquipment, BrewingNote, Method } from '@/lib/core/config';
import type { AppSettings, Grinder } from '@/lib/data/models';
import type { CoffeeBean } from '@/types/app';
import type { PendingOperation } from '@/lib/supabase/realtime/types';
import type {
  AppSettingsRow,
  BrewingNoteRow,
  CoffeeBeanRow,
  CustomEquipmentRow,
  CustomMethodsRow,
  GrinderRow,
  HistoricalYearlyReportRow,
  LegacySettingsRow,
  PendingOperationRow,
} from './schemaV1';
import {
  assertFiniteNumber,
  assertPlainRecord,
  assertProjectionEqual,
  assertSafeInteger,
  assertString,
  assertStringId,
  assertTimestampMs,
  canonicalizePersistedSnapshot,
  codecError,
  decodeJSONSnapshot,
  encodeJSONSnapshot,
  isPresent,
  type CodecContext,
} from './serialization';

export interface ImageSourceDescriptor {
  slot: 'front' | 'back' | 'note';
  /** Preserves whether a note image came from the compatibility scalar or array. */
  field?: 'image' | 'images';
  position?: number;
  data: string;
  source: 'inline';
}

export interface EncodedCoffeeBean {
  row: CoffeeBeanRow;
  imageSources: ImageSourceDescriptor[];
}

export interface EncodedBrewingNote {
  row: BrewingNoteRow;
  imageSources: ImageSourceDescriptor[];
}

export interface CustomMethodsSnapshot {
  equipmentId: string;
  methods: Method[];
  [key: string]: unknown;
}

/**
 * A persisted queue snapshot, not a promise that the operation is executable.
 * Legacy table and operation names stay raw strings until the queue processor
 * validates them against its current runtime contract.
 */
export type PendingOperationStorageSnapshot = Omit<
  PendingOperation,
  'table' | 'type'
> & {
  table: string;
  type: string;
  [key: string]: unknown;
};

const ownKeysExcept = (
  value: Record<string, unknown>,
  omitted: ReadonlySet<string>
): Record<string, unknown> => {
  const result = Object.create(null) as Record<string, unknown>;
  for (const key of Object.keys(value)) {
    if (!omitted.has(key)) result[key] = value[key];
  }
  return result;
};

const canonicalRecord = (
  value: unknown,
  table: string,
  idKey: string
): { record: Record<string, unknown>; context: CodecContext } => {
  const initial = assertPlainRecord(value, { table });
  const descriptor = Object.getOwnPropertyDescriptor(initial, idKey);
  const possibleId =
    descriptor && 'value' in descriptor && typeof descriptor.value === 'string'
      ? descriptor.value
      : undefined;
  const context: CodecContext = {
    table,
    ...(possibleId !== undefined ? { recordId: possibleId } : {}),
  };
  return {
    record: assertPlainRecord(
      canonicalizePersistedSnapshot(initial, context),
      context
    ),
    context,
  };
};

const assertOnlyKeys = (
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  context: CodecContext
): void => {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      codecError(
        context,
        key,
        'unknown field is not represented by this row contract'
      );
    }
  }
};

const projectionStringOrNull = (
  value: unknown,
  context: CodecContext,
  path: string
): string | null => {
  if (value === undefined || value === null) return null;
  return assertString(value, context, path);
};

const projectionTimestampOrNull = (
  value: unknown,
  context: CodecContext,
  path: string
): number | null => {
  if (value === undefined || value === null) return null;
  return assertTimestampMs(value, context, path);
};

export function encodeCoffeeBean(value: unknown): EncodedCoffeeBean {
  const { record: snapshot, context: initialContext } = canonicalRecord(
    value,
    'coffee_beans',
    'id'
  );
  const id = assertStringId(snapshot.id, initialContext);
  const context = { table: 'coffee_beans', recordId: id };
  const timestamp = assertTimestampMs(snapshot.timestamp, context, 'timestamp');
  assertString(snapshot.name, context, 'name');
  const imageSources: ImageSourceDescriptor[] = [];

  for (const [key, slot] of [
    ['image', 'front'],
    ['backImage', 'back'],
  ] as const) {
    const source = snapshot[key];
    if (source === undefined || source === null) continue;
    if (typeof source !== 'string') {
      codecError(
        context,
        key,
        'inline image value must be a string, null, or absent'
      );
    }
    if (source.length > 0) {
      imageSources.push({ slot, data: source, source: 'inline' });
    }
  }

  const imageFieldsToSplit = new Set(
    (['image', 'backImage'] as const).filter(
      key => typeof snapshot[key] === 'string' && snapshot[key] !== ''
    )
  );
  const persisted = ownKeysExcept(snapshot, imageFieldsToSplit);
  const recordJson = encodeJSONSnapshot(persisted, context, 'record_json');
  return {
    row: { id, timestamp_ms: timestamp, record_json: recordJson },
    imageSources,
  };
}

export function decodeCoffeeBean(
  row: CoffeeBeanRow,
  imageSources: readonly ImageSourceDescriptor[] = []
): CoffeeBean {
  const context = { table: 'coffee_beans', recordId: row.id };
  const rowId = assertStringId(row.id, context);
  const rowTimestamp = assertTimestampMs(
    row.timestamp_ms,
    context,
    'timestamp_ms'
  );
  const bean = decodeJSONSnapshot<Record<string, unknown>>(
    row.record_json,
    context,
    'record_json'
  );
  assertPlainRecord(bean, context, 'record_json');
  const snapshotId = assertStringId(bean.id, context, 'record_json.id');
  const snapshotTimestamp = assertTimestampMs(
    bean.timestamp,
    context,
    'record_json.timestamp'
  );
  assertString(bean.name, context, 'record_json.name');
  assertProjectionEqual(rowId, snapshotId, context, 'id');
  assertProjectionEqual(
    rowTimestamp,
    snapshotTimestamp,
    context,
    'timestamp_ms'
  );

  const result = { ...bean };
  const seen = new Set<string>();
  for (const [index, source] of imageSources.entries()) {
    if (source.slot !== 'front' && source.slot !== 'back') {
      codecError(
        context,
        `imageSources[${index}].slot`,
        'expected front or back'
      );
    }
    if (seen.has(source.slot)) {
      codecError(context, `images.${source.slot}`, 'duplicate image slot');
    }
    seen.add(source.slot);
    result[source.slot === 'front' ? 'image' : 'backImage'] = assertString(
      source.data,
      context,
      `images.${source.slot}.data`
    );
  }
  return result as unknown as CoffeeBean;
}

export function encodeBrewingNote(value: unknown): EncodedBrewingNote {
  const { record: note, context: initialContext } = canonicalRecord(
    value,
    'brewing_notes',
    'id'
  );
  const id = assertStringId(note.id, initialContext);
  const context = { table: 'brewing_notes', recordId: id };
  const timestamp = assertTimestampMs(note.timestamp, context, 'timestamp');
  assertFiniteNumber(note.rating, context, 'rating');
  assertString(note.notes, context, 'notes');
  const taste = assertPlainRecord(note.taste, context, 'taste');
  for (const [key, value] of Object.entries(taste)) {
    assertFiniteNumber(value, context, `taste.${key}`);
  }
  const beanId = projectionStringOrNull(note.beanId, context, 'beanId');
  const updatedAt = projectionTimestampOrNull(
    note.updatedAt,
    context,
    'updatedAt'
  );

  const imageSources: ImageSourceDescriptor[] = [];
  if (note.images !== undefined && note.images !== null) {
    if (!Array.isArray(note.images)) {
      codecError(
        context,
        'images',
        'expected an array of inline image strings'
      );
    }
    // Validate the complete array before moving its strings out of the entity
    // JSON, so sparse/undefined entries cannot disappear.
    encodeJSONSnapshot(note.images, context, 'images');
    note.images.forEach((image, index) => {
      if (typeof image !== 'string') {
        codecError(
          context,
          `images[${index}]`,
          'inline image must be a string'
        );
      }
      imageSources.push({
        slot: 'note',
        field: 'images',
        position: index,
        data: image,
        source: 'inline',
      });
    });
  }
  if (typeof note.image === 'string' && note.image.length > 0) {
    imageSources.push({
      slot: 'note',
      field: 'image',
      data: note.image,
      source: 'inline',
    });
  } else if (
    note.image !== undefined &&
    note.image !== null &&
    typeof note.image !== 'string'
  ) {
    codecError(
      context,
      'image',
      'inline image value must be a string, null, or absent'
    );
  }

  const imageFieldsToSplit = new Set<string>();
  if (Array.isArray(note.images) && note.images.length > 0) {
    imageFieldsToSplit.add('images');
  }
  if (typeof note.image === 'string' && note.image.length > 0) {
    imageFieldsToSplit.add('image');
  }
  const persisted = ownKeysExcept(note, imageFieldsToSplit);
  const row: BrewingNoteRow = {
    id,
    timestamp_ms: timestamp,
    updated_at_ms: updatedAt,
    bean_id: beanId,
    record_json: encodeJSONSnapshot(persisted, context, 'record_json'),
  };
  return { row, imageSources };
}

export function decodeBrewingNote(
  row: BrewingNoteRow,
  imageSources: readonly ImageSourceDescriptor[] = []
): BrewingNote {
  const context = { table: 'brewing_notes', recordId: row.id };
  const rowId = assertStringId(row.id, context);
  const rowTimestamp = assertTimestampMs(
    row.timestamp_ms,
    context,
    'timestamp_ms'
  );
  const rowUpdatedAt =
    row.updated_at_ms === null
      ? null
      : assertTimestampMs(row.updated_at_ms, context, 'updated_at_ms');
  const rowBeanId =
    row.bean_id === null ? null : assertString(row.bean_id, context, 'bean_id');
  const note = decodeJSONSnapshot<Record<string, unknown>>(
    row.record_json,
    context,
    'record_json'
  );
  assertPlainRecord(note, context, 'record_json');
  const snapshotId = assertStringId(note.id, context, 'record_json.id');
  const snapshotTimestamp = assertTimestampMs(
    note.timestamp,
    context,
    'record_json.timestamp'
  );
  assertFiniteNumber(note.rating, context, 'record_json.rating');
  assertString(note.notes, context, 'record_json.notes');
  const taste = assertPlainRecord(note.taste, context, 'record_json.taste');
  for (const [key, value] of Object.entries(taste)) {
    assertFiniteNumber(value, context, `record_json.taste.${key}`);
  }
  const snapshotUpdatedAt = projectionTimestampOrNull(
    note.updatedAt,
    context,
    'record_json.updatedAt'
  );
  const snapshotBeanId = projectionStringOrNull(
    note.beanId,
    context,
    'record_json.beanId'
  );

  assertProjectionEqual(rowId, snapshotId, context, 'id');
  assertProjectionEqual(
    rowTimestamp,
    snapshotTimestamp,
    context,
    'timestamp_ms'
  );
  assertProjectionEqual(
    rowUpdatedAt,
    snapshotUpdatedAt,
    context,
    'updated_at_ms'
  );
  assertProjectionEqual(rowBeanId, snapshotBeanId, context, 'bean_id');

  const noteImages = [...imageSources].map((source, index) => {
    if (source.slot !== 'note') {
      codecError(context, `imageSources[${index}].slot`, 'expected note');
    }
    if (source.field !== 'image' && source.field !== 'images') {
      codecError(
        context,
        `imageSources[${index}].field`,
        'expected image or images'
      );
    }
    if (source.field === 'image') {
      if (source.position !== undefined && source.position !== 0) {
        codecError(
          context,
          `imageSources[${index}].position`,
          'scalar image position must be zero when provided'
        );
      }
      return { source, field: 'image' as const, position: 0 };
    }

    const position = assertSafeInteger(
      source.position,
      context,
      `imageSources[${index}].position`
    );
    if (position < 0) {
      codecError(context, `imageSources[${index}].position`, 'must be >= 0');
    }
    return { source, field: 'images' as const, position };
  });
  const scalarImages = noteImages.filter(image => image.field === 'image');
  if (scalarImages.length > 1) {
    codecError(context, 'image', 'duplicate scalar note image source');
  }
  const arrayImages = noteImages
    .filter(image => image.field === 'images')
    .sort((left, right) => left.position - right.position);
  if (scalarImages.length > 0 && Object.hasOwn(note, 'image')) {
    codecError(
      context,
      'image',
      'row JSON and image source both contain the field'
    );
  }
  if (arrayImages.length > 0 && Object.hasOwn(note, 'images')) {
    codecError(
      context,
      'images',
      'row JSON and image sources both contain the field'
    );
  }
  const seenPositions = new Set<number>();
  for (const [index, { position }] of arrayImages.entries()) {
    if (seenPositions.has(position)) {
      codecError(
        context,
        `images[${position}]`,
        'duplicate note image position'
      );
    }
    if (position !== index) {
      codecError(
        context,
        `images[${index}]`,
        'note image positions must be contiguous from zero'
      );
    }
    seenPositions.add(position);
  }
  const result = { ...note };
  const scalarImage = scalarImages[0];
  if (scalarImage) {
    result.image = assertString(scalarImage.source.data, context, 'image');
  }
  if (arrayImages.length > 0) {
    result.images = arrayImages.map(({ source }, index) =>
      assertString(source.data, context, `images[${index}]`)
    );
  }
  return result as unknown as BrewingNote;
}

export function encodeCustomEquipment(value: unknown): CustomEquipmentRow {
  const { record: equipment, context: initialContext } = canonicalRecord(
    value,
    'custom_equipments',
    'id'
  );
  const id = assertStringId(equipment.id, initialContext);
  const context = { table: 'custom_equipments', recordId: id };
  assertString(equipment.name, context, 'name');
  assertString(equipment.animationType, context, 'animationType');
  if (equipment.isCustom !== true) {
    codecError(
      context,
      'isCustom',
      'expected true for a custom equipment snapshot'
    );
  }
  return {
    id,
    record_json: encodeJSONSnapshot(equipment, context, 'record_json'),
  };
}

export function decodeCustomEquipment(
  row: CustomEquipmentRow
): CustomEquipment {
  const context = { table: 'custom_equipments', recordId: row.id };
  const id = assertStringId(row.id, context);
  const equipment = decodeJSONSnapshot<Record<string, unknown>>(
    row.record_json,
    context,
    'record_json'
  );
  assertPlainRecord(equipment, context, 'record_json');
  assertProjectionEqual(
    id,
    assertStringId(equipment.id, context, 'record_json.id'),
    context,
    'id'
  );
  assertString(equipment.name, context, 'record_json.name');
  assertString(equipment.animationType, context, 'record_json.animationType');
  if (equipment.isCustom !== true) {
    codecError(
      context,
      'record_json.isCustom',
      'expected true for a custom equipment snapshot'
    );
  }
  return equipment as unknown as CustomEquipment;
}

export function encodeCustomMethods(value: unknown): CustomMethodsRow {
  const { record, context: initialContext } = canonicalRecord(
    value,
    'custom_methods',
    'equipmentId'
  );
  const equipmentId = assertStringId(
    record.equipmentId,
    initialContext,
    'equipmentId'
  );
  const context = { table: 'custom_methods', recordId: equipmentId };
  if (!Array.isArray(record.methods)) {
    codecError(context, 'methods', 'expected an ordered method array');
  }
  const methodsJson = encodeJSONSnapshot(
    record.methods,
    context,
    'methods_json'
  );
  const extra = ownKeysExcept(record, new Set(['equipmentId', 'methods']));
  const extraJson = encodeJSONSnapshot(extra, context, 'extra_json');
  return {
    equipment_id: equipmentId,
    methods_json: methodsJson,
    extra_json: extraJson,
  };
}

export function decodeCustomMethods(
  row: CustomMethodsRow
): CustomMethodsSnapshot {
  const context = { table: 'custom_methods', recordId: row.equipment_id };
  const equipmentId = assertStringId(row.equipment_id, context, 'equipment_id');
  const methods = decodeJSONSnapshot<Method[]>(
    row.methods_json,
    context,
    'methods_json'
  );
  if (!Array.isArray(methods))
    codecError(context, 'methods_json', 'expected an array');
  const extra = decodeJSONSnapshot<Record<string, unknown>>(
    row.extra_json,
    context,
    'extra_json'
  );
  assertPlainRecord(extra, context, 'extra_json');
  if (isPresent(extra, 'equipmentId') || isPresent(extra, 'methods')) {
    codecError(context, 'extra_json', 'extra fields collide with known fields');
  }
  return { ...extra, equipmentId, methods } as CustomMethodsSnapshot;
}

export function encodeGrinder(value: unknown): GrinderRow {
  const { record: grinder, context: initialContext } = canonicalRecord(
    value,
    'grinders',
    'id'
  );
  const id = assertStringId(grinder.id, initialContext);
  const context = { table: 'grinders', recordId: id };
  assertString(grinder.name, context, 'name');
  return {
    id,
    record_json: encodeJSONSnapshot(grinder, context, 'record_json'),
  };
}

export function decodeGrinder(row: GrinderRow): Grinder {
  const context = { table: 'grinders', recordId: row.id };
  const id = assertStringId(row.id, context);
  const grinder = decodeJSONSnapshot<Record<string, unknown>>(
    row.record_json,
    context,
    'record_json'
  );
  assertPlainRecord(grinder, context, 'record_json');
  assertProjectionEqual(
    id,
    assertStringId(grinder.id, context, 'record_json.id'),
    context,
    'id'
  );
  assertString(grinder.name, context, 'record_json.name');
  return grinder as unknown as Grinder;
}

export function encodeAppSettings(value: unknown): AppSettingsRow {
  const { record, context: initialContext } = canonicalRecord(
    value,
    'app_settings',
    'id'
  );
  const id = assertStringId(record.id, initialContext);
  const recordContext = { table: 'app_settings', recordId: id };
  assertOnlyKeys(record, new Set(['id', 'data']), recordContext);
  return {
    id,
    data_json: encodeJSONSnapshot(record.data, recordContext, 'data_json'),
  };
}

export function decodeAppSettings(row: AppSettingsRow): {
  id: string;
  data: AppSettings;
} {
  const context = { table: 'app_settings', recordId: row.id };
  const id = assertStringId(row.id, context);
  const data = decodeJSONSnapshot<unknown>(row.data_json, context, 'data_json');
  assertPlainRecord(data, context, 'data_json');
  return {
    id,
    data: data as AppSettings,
  };
}

export function encodeLegacySetting(value: unknown): LegacySettingsRow {
  const { record: entry, context: initialContext } = canonicalRecord(
    value,
    'legacy_settings',
    'key'
  );
  const key = assertString(entry.key, initialContext, 'key');
  const context = { table: 'legacy_settings', recordId: key };
  assertOnlyKeys(entry, new Set(['key', 'value']), context);
  const storedValue = assertString(entry.value, context, 'value');
  return { key, value: storedValue };
}

export function decodeLegacySetting(row: LegacySettingsRow): {
  key: string;
  value: string;
} {
  const context = { table: 'legacy_settings', recordId: row.key };
  return {
    key: assertString(row.key, context, 'key'),
    value: assertString(row.value, context, 'value'),
  };
}

const pendingKnownKeys = new Set([
  'id',
  'table',
  'type',
  'recordId',
  'data',
  'timestamp',
  'retryCount',
  'lastError',
  'failedAt',
]);

export function encodePendingOperation(value: unknown): PendingOperationRow {
  const { record: operation, context: initialContext } = canonicalRecord(
    value,
    'pending_operations',
    'id'
  );
  const id = assertStringId(operation.id, initialContext);
  const context = { table: 'pending_operations', recordId: id };
  const table = assertString(operation.table, context, 'table');
  const type = assertString(operation.type, context, 'type');
  const recordId = assertString(operation.recordId, context, 'recordId');
  const timestamp = assertTimestampMs(
    operation.timestamp,
    context,
    'timestamp'
  );
  const retryCount = assertSafeInteger(
    operation.retryCount,
    context,
    'retryCount'
  );
  if (retryCount < 0) codecError(context, 'retryCount', 'must be >= 0');

  const lastError = operation.lastError;
  if (
    lastError !== undefined &&
    lastError !== null &&
    typeof lastError !== 'string'
  ) {
    codecError(context, 'lastError', 'expected a string, null, or absent');
  }
  const failedAt = operation.failedAt;
  if (failedAt !== undefined && failedAt !== null) {
    assertTimestampMs(failedAt, context, 'failedAt');
  }

  const extra = ownKeysExcept(operation, pendingKnownKeys);
  if (lastError === null) extra.lastError = null;
  if (failedAt === null) extra.failedAt = null;

  const dataJson =
    operation.data === undefined
      ? null
      : encodeJSONSnapshot(operation.data, context, 'data_json');

  return {
    id,
    table_name: table,
    operation_type: type,
    record_id: recordId,
    timestamp_ms: timestamp,
    retry_count: retryCount,
    last_error: typeof lastError === 'string' ? lastError : null,
    failed_at_ms:
      typeof failedAt === 'number'
        ? assertTimestampMs(failedAt, context, 'failedAt')
        : null,
    data_json: dataJson,
    extra_json: encodeJSONSnapshot(extra, context, 'extra_json'),
  };
}

export function decodePendingOperation(
  row: PendingOperationRow
): PendingOperationStorageSnapshot {
  const context = { table: 'pending_operations', recordId: row.id };
  const id = assertStringId(row.id, context);
  const table = assertString(row.table_name, context, 'table_name');
  const type = assertString(row.operation_type, context, 'operation_type');
  const recordId = assertString(row.record_id, context, 'record_id');
  const timestamp = assertTimestampMs(
    row.timestamp_ms,
    context,
    'timestamp_ms'
  );
  const retryCount = assertSafeInteger(row.retry_count, context, 'retry_count');
  if (retryCount < 0) codecError(context, 'retry_count', 'must be >= 0');
  const extra = decodeJSONSnapshot<Record<string, unknown>>(
    row.extra_json,
    context,
    'extra_json'
  );
  assertPlainRecord(extra, context, 'extra_json');
  for (const key of pendingKnownKeys) {
    const explicitNullableValue =
      (key === 'lastError' && row.last_error === null && extra[key] === null) ||
      (key === 'failedAt' && row.failed_at_ms === null && extra[key] === null);
    if (explicitNullableValue) continue;
    if (key !== 'data' && isPresent(extra, key)) {
      codecError(
        context,
        `extra_json.${key}`,
        'extra field collides with known field'
      );
    }
    if (key === 'data' && isPresent(extra, key)) {
      codecError(
        context,
        'extra_json.data',
        'extra field collides with known field'
      );
    }
  }
  const result: Record<string, unknown> = {
    ...extra,
    id,
    table,
    type,
    recordId,
    timestamp,
    retryCount,
  };
  if (row.last_error !== null) {
    result.lastError = assertString(row.last_error, context, 'last_error');
  } else if (isPresent(extra, 'lastError')) {
    if (extra.lastError !== null) {
      codecError(
        context,
        'extra_json.lastError',
        'expected null for an explicit null field'
      );
    }
    result.lastError = null;
    delete extra.lastError;
  }
  if (row.failed_at_ms !== null) {
    result.failedAt = assertTimestampMs(
      row.failed_at_ms,
      context,
      'failed_at_ms'
    );
  } else if (isPresent(extra, 'failedAt')) {
    if (extra.failedAt !== null) {
      codecError(
        context,
        'extra_json.failedAt',
        'expected null for an explicit null field'
      );
    }
    result.failedAt = null;
    delete extra.failedAt;
  }
  if (row.data_json !== null) {
    result.data = decodeJSONSnapshot(row.data_json, context, 'data_json');
  }
  return result as PendingOperationStorageSnapshot;
}

const reportKnownKeys = new Set([
  'id',
  'year',
  'username',
  'content',
  'createdAt',
]);

export function encodeHistoricalYearlyReport(
  value: unknown
): HistoricalYearlyReportRow {
  const { record: report, context: initialContext } = canonicalRecord(
    value,
    'historical_yearly_reports',
    'id'
  );
  const id = assertStringId(report.id, initialContext);
  const context = { table: 'historical_yearly_reports', recordId: id };
  const year = assertSafeInteger(report.year, context, 'year');
  const username = assertString(report.username, context, 'username');
  const content = assertString(report.content, context, 'content');
  const createdAt = assertTimestampMs(report.createdAt, context, 'createdAt');
  const extra = ownKeysExcept(report, reportKnownKeys);
  return {
    id,
    year,
    username,
    content,
    created_at_ms: createdAt,
    extra_json: encodeJSONSnapshot(extra, context, 'extra_json'),
  };
}

export function decodeHistoricalYearlyReport(
  row: HistoricalYearlyReportRow
): Record<string, unknown> {
  const context = { table: 'historical_yearly_reports', recordId: row.id };
  const id = assertStringId(row.id, context);
  const year = assertSafeInteger(row.year, context, 'year');
  const username = assertString(row.username, context, 'username');
  const content = assertString(row.content, context, 'content');
  const createdAt = assertTimestampMs(
    row.created_at_ms,
    context,
    'created_at_ms'
  );
  const extra = decodeJSONSnapshot<Record<string, unknown>>(
    row.extra_json,
    context,
    'extra_json'
  );
  assertPlainRecord(extra, context, 'extra_json');
  for (const key of reportKnownKeys) {
    if (isPresent(extra, key)) {
      codecError(
        context,
        `extra_json.${key}`,
        'extra field collides with known field'
      );
    }
  }
  return { ...extra, id, year, username, content, createdAt };
}

export type ActiveSQLiteDTOs = {
  coffeeBean: CoffeeBean;
  brewingNote: BrewingNote;
  customEquipment: CustomEquipment;
  customMethods: CustomMethodsSnapshot;
  grinder: Grinder;
};
