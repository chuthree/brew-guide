import { describe, expect, it } from 'vitest';
import { assertValidPendingOperationUpdate } from './pendingOperationUpdate';

describe('assertValidPendingOperationUpdate', () => {
  it.each([
    ['type undefined', { type: undefined }, /type/],
    ['type null', { type: null }, /type/],
    ['unknown type', { type: 'merge' }, /type/],
    ['empty type', { type: '' }, /type/],
    ['timestamp undefined', { timestamp: undefined }, /timestamp/],
    ['timestamp null', { timestamp: null }, /timestamp/],
    ['timestamp NaN', { timestamp: Number.NaN }, /timestamp/],
    ['timestamp Infinity', { timestamp: Infinity }, /timestamp/],
    ['timestamp string', { timestamp: '1' }, /timestamp/],
    [
      'timestamp unsafe integer',
      { timestamp: Number.MAX_SAFE_INTEGER + 1 },
      /timestamp/,
    ],
    ['retryCount undefined', { retryCount: undefined }, /retryCount/],
    ['retryCount null', { retryCount: null }, /retryCount/],
    ['retryCount negative', { retryCount: -1 }, /retryCount/],
    ['retryCount NaN', { retryCount: Number.NaN }, /retryCount/],
    ['retryCount Infinity', { retryCount: Infinity }, /retryCount/],
    ['retryCount string', { retryCount: '1' }, /retryCount/],
    [
      'retryCount unsafe integer',
      { retryCount: Number.MAX_SAFE_INTEGER + 1 },
      /retryCount/,
    ],
    ['lastError null', { lastError: null }, /lastError/],
    ['lastError number', { lastError: 1 }, /lastError/],
    ['failedAt null', { failedAt: null }, /failedAt/],
    ['failedAt NaN', { failedAt: Number.NaN }, /failedAt/],
    ['failedAt string', { failedAt: '1' }, /failedAt/],
    ['unsupported field', { table: 'other' }, /table/],
  ])('rejects %s without mutating the patch', (_label, patch, message) => {
    const before = { ...patch };

    expect(() => assertValidPendingOperationUpdate(patch)).toThrow(message);
    expect(patch).toEqual(before);
  });

  it.each([
    ['empty patch', {}],
    ['valid type', { type: 'delete' }],
    ['zero timestamp', { timestamp: 0 }],
    ['negative safe timestamp', { timestamp: -1 }],
    ['zero retry count', { retryCount: 0 }],
    ['positive retry count', { retryCount: 4 }],
    ['explicit data null', { data: null }],
    ['explicit optional undefined', { data: undefined }],
    ['lastError removal', { lastError: undefined }],
    ['lastError string', { lastError: '' }],
    ['failedAt removal', { failedAt: undefined }],
    ['failedAt timestamp', { failedAt: 123 }],
    [
      'all supported fields',
      {
        type: 'upsert',
        data: { future: ['kept', null] },
        timestamp: 123,
        retryCount: 2,
        lastError: 'offline',
        failedAt: 456,
      },
    ],
  ])('accepts %s', (_label, patch) => {
    expect(() => assertValidPendingOperationUpdate(patch)).not.toThrow();
  });

  it('validates only own patch properties', () => {
    const inherited = Object.create({ type: undefined }) as {
      retryCount: number;
    };
    inherited.retryCount = 1;

    expect(() => assertValidPendingOperationUpdate(inherited)).not.toThrow();
  });
});
