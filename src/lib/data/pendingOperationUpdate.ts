import type { PendingOperationUpdate } from '@/lib/data/contracts';

const ALLOWED_UPDATE_FIELDS = new Set([
  'type',
  'data',
  'timestamp',
  'retryCount',
  'lastError',
  'failedAt',
]);

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

function reject(path: string, reason: string): never {
  throw new TypeError(`Invalid pending operation update at ${path}: ${reason}`);
}

/** Validate a queue patch before any persistence backend applies it. */
export function assertValidPendingOperationUpdate(
  changes: unknown
): asserts changes is PendingOperationUpdate {
  if (
    typeof changes !== 'object' ||
    changes === null ||
    Array.isArray(changes)
  ) {
    reject('changes', 'expected an object');
  }

  const patch = changes as Record<string, unknown>;
  for (const key of Reflect.ownKeys(patch)) {
    if (typeof key !== 'string' || !ALLOWED_UPDATE_FIELDS.has(key)) {
      reject(String(key), 'field cannot be patched');
    }
  }

  if (hasOwn(patch, 'type')) {
    if (patch.type !== 'upsert' && patch.type !== 'delete') {
      reject('type', 'expected "upsert" or "delete"');
    }
  }

  if (hasOwn(patch, 'timestamp')) {
    if (
      typeof patch.timestamp !== 'number' ||
      !Number.isSafeInteger(patch.timestamp)
    ) {
      reject('timestamp', 'expected a safe integer');
    }
  }

  if (hasOwn(patch, 'retryCount')) {
    if (
      typeof patch.retryCount !== 'number' ||
      !Number.isSafeInteger(patch.retryCount) ||
      patch.retryCount < 0
    ) {
      reject('retryCount', 'expected a non-negative safe integer');
    }
  }

  if (
    hasOwn(patch, 'lastError') &&
    patch.lastError !== undefined &&
    typeof patch.lastError !== 'string'
  ) {
    reject('lastError', 'expected a string or undefined');
  }

  if (
    hasOwn(patch, 'failedAt') &&
    patch.failedAt !== undefined &&
    (typeof patch.failedAt !== 'number' ||
      !Number.isSafeInteger(patch.failedAt))
  ) {
    reject('failedAt', 'expected a safe integer or undefined');
  }
}
