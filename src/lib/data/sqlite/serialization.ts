export interface CodecContext {
  table: string;
  recordId?: string;
}

export class SQLiteCodecError extends Error {
  readonly table: string;
  readonly recordId?: string;
  readonly fieldPath: string;
  readonly reason: string;

  constructor(context: CodecContext, fieldPath: string, reason: string) {
    const record = context.recordId ? ` record ${context.recordId}` : '';
    const path = fieldPath || '<root>';
    super(`${context.table}${record} at ${path}: ${reason}`);
    this.name = 'SQLiteCodecError';
    this.table = context.table;
    this.recordId = context.recordId;
    this.fieldPath = path;
    this.reason = reason;
  }
}

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | { [key: string]: JSONValue };

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const fieldPath = (base: string, key: string | number): string =>
  typeof key === 'number' ? `${base}[${key}]` : base ? `${base}.${key}` : key;

const epochFieldNames = new Set([
  'timestamp',
  'updatedAt',
  'createdAt',
  'modifiedAt',
  'failedAt',
  'lastSyncTime',
  'timestamp_ms',
  'updated_at_ms',
  'created_at_ms',
  'failed_at_ms',
]);

const reject = (context: CodecContext, path: string, reason: string): never => {
  throw new SQLiteCodecError(context, path, reason);
};

function canonicalizeValue(
  value: unknown,
  context: CodecContext,
  path: string,
  ancestors: Set<object>,
  arrayItem = false
): JSONValue | typeof OMIT {
  if (value === undefined) {
    if (arrayItem)
      reject(context, path, 'undefined array items are not JSON-safe');
    return OMIT;
  }
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) reject(context, path, 'number must be finite');
    return value;
  }
  if (typeof value === 'bigint')
    reject(context, path, 'BigInt is not JSON-safe');
  if (typeof value === 'function')
    reject(context, path, 'function is not JSON-safe');
  if (typeof value === 'symbol')
    reject(context, path, 'symbol is not JSON-safe');
  if (typeof value !== 'object') reject(context, path, 'unsupported value');

  if (value instanceof Date)
    reject(context, path, 'Date is not a persisted snapshot value');
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    reject(context, path, 'Blob is not JSON-safe');
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    reject(context, path, 'ArrayBuffer and typed arrays are not JSON-safe');
  }
  if (value instanceof Map) reject(context, path, 'Map is not JSON-safe');
  if (value instanceof Set) reject(context, path, 'Set is not JSON-safe');
  if (ancestors.has(value)) reject(context, path, 'cyclic reference');

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      const copy: JSONValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
          value,
          String(index)
        );
        if (!descriptor) {
          return reject(context, fieldPath(path, index), 'sparse array hole');
        }
        if (!('value' in descriptor) || !descriptor.enumerable) {
          return reject(
            context,
            fieldPath(path, index),
            'array accessor/non-enumerable items are not canonical snapshots'
          );
        }
        const item = canonicalizeValue(
          descriptor.value,
          context,
          fieldPath(path, index),
          ancestors,
          true
        );
        if (item === OMIT) {
          return reject(
            context,
            fieldPath(path, index),
            'undefined array items are not JSON-safe'
          );
        }
        copy.push(item);
      }

      const extraKeys = Reflect.ownKeys(value).filter(
        key =>
          key !== 'length' &&
          !(
            typeof key === 'string' &&
            /^(0|[1-9]\d*)$/.test(key) &&
            Number(key) < value.length
          )
      );
      if (extraKeys.length > 0) {
        reject(
          context,
          path,
          'arrays with custom properties are not canonical snapshots'
        );
      }
      return copy;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      reject(context, path, 'only plain objects are JSON-safe');
    }

    const ownKeys = Reflect.ownKeys(value);
    const symbols = ownKeys.filter(key => typeof key === 'symbol');
    if (symbols.length > 0)
      reject(context, path, 'symbol-keyed properties are not JSON-safe');

    const copy = Object.create(null) as { [key: string]: JSONValue };
    for (const key of ownKeys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !('value' in descriptor)) {
        return reject(
          context,
          fieldPath(path, key),
          'accessor properties are not canonical snapshots'
        );
      }
      if (!descriptor.enumerable) {
        return reject(
          context,
          fieldPath(path, key),
          'non-enumerable properties are not canonical snapshots'
        );
      }
      const child = canonicalizeValue(
        descriptor.value,
        context,
        fieldPath(path, key),
        ancestors
      );
      if (child !== OMIT) copy[key] = child;
    }
    return copy;
  } finally {
    ancestors.delete(value);
  }
}

const OMIT = Symbol('omit-undefined-object-property');

function validateEpochFields(
  value: JSONValue,
  context: CodecContext,
  path: string
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      validateEpochFields(item, context, fieldPath(path, index))
    );
    return;
  }
  if (value === null || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = fieldPath(path, key);
    if (epochFieldNames.has(key) && child !== null) {
      assertTimestampMs(child, context, childPath);
    } else {
      validateEpochFields(child, context, childPath);
    }
  }
}

/** Canonicalize a complete persisted snapshot. Object undefined values omit. */
export function canonicalizePersistedSnapshot<T = unknown>(
  value: T,
  context: CodecContext,
  path = ''
): T {
  const canonical = canonicalizeValue(value, context, path, new Set());
  if (canonical === OMIT)
    return reject(context, path, 'snapshot root cannot be undefined');
  validateEpochFields(canonical, context, path);
  return canonical as T;
}

export function encodeJSONSnapshot(
  value: unknown,
  context: CodecContext,
  path = ''
): string {
  const canonical = canonicalizePersistedSnapshot(value, context, path);
  const encoded = JSON.stringify(canonical);
  if (typeof encoded !== 'string') {
    reject(context, path, 'snapshot did not produce JSON text');
  }
  return encoded;
}

export function decodeJSONSnapshot<T = unknown>(
  encoded: string,
  context: CodecContext,
  column: string
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(encoded);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid JSON';
    reject(context, column, `JSON parse failed: ${message}`);
  }
  return canonicalizePersistedSnapshot(parsed, context, column) as T;
}

export function assertPlainRecord(
  value: unknown,
  context: CodecContext,
  path = ''
): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    return reject(context, path, 'expected a plain object');
  }
  return value as Record<string, unknown>;
}

export function assertString(
  value: unknown,
  context: CodecContext,
  path: string
): string {
  return typeof value === 'string'
    ? value
    : reject(context, path, 'expected a string');
}

export function assertFiniteNumber(
  value: unknown,
  context: CodecContext,
  path: string
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : reject(context, path, 'expected a finite number');
}

export function assertInteger(
  value: unknown,
  context: CodecContext,
  path: string
): number {
  const number = assertFiniteNumber(value, context, path);
  if (!Number.isInteger(number)) reject(context, path, 'expected an integer');
  return number;
}

export function assertSafeInteger(
  value: unknown,
  context: CodecContext,
  path: string
): number {
  const number = assertInteger(value, context, path);
  if (!Number.isSafeInteger(number))
    reject(context, path, 'expected a safe integer');
  return number;
}

export function assertTimestampMs(
  value: unknown,
  context: CodecContext,
  path: string
): number {
  return assertSafeInteger(value, context, path);
}

export function assertStringId(
  value: unknown,
  context: CodecContext,
  path = 'id'
): string {
  const id = assertString(value, context, path);
  if (id.length === 0) reject(context, path, 'id must not be empty');
  return id;
}

export function assertProjectionEqual(
  actual: unknown,
  expected: unknown,
  context: CodecContext,
  path: string
): void {
  if (!Object.is(actual, expected)) {
    reject(
      context,
      path,
      `projection mismatch (row=${String(actual)}, snapshot=${String(expected)})`
    );
  }
}

export function isPresent(value: object, key: string): boolean {
  return hasOwn(value, key);
}

export function codecError(
  context: CodecContext,
  path: string,
  reason: string
): never {
  return reject(context, path, reason);
}
