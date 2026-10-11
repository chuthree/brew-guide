import { describe, expect, it } from 'vitest';
import {
  canonicalizePersistedSnapshot,
  decodeJSONSnapshot,
  encodeJSONSnapshot,
  SQLiteCodecError,
} from './serialization';

const context = { table: 'brewing_notes', recordId: 'note-7' };

describe('SQLite persisted JSON safety contract', () => {
  it('omits undefined object properties and preserves null', () => {
    expect(
      encodeJSONSnapshot({ omitted: undefined, kept: null }, context)
    ).toBe('{"kept":null}');
    expect(decodeJSONSnapshot('{"kept":null}', context, 'record_json')).toEqual(
      {
        kept: null,
      }
    );
  });

  it('preserves ordinary JSON values and array order', () => {
    const value = {
      text: '咖啡',
      number: 1.25,
      enabled: false,
      nullable: null,
      ordered: [{ id: 'z' }, { id: 'a' }],
    };
    expect(
      decodeJSONSnapshot(
        encodeJSONSnapshot(value, context),
        context,
        'record_json'
      )
    ).toEqual(value);
  });

  it('preserves special JSON property names as data', () => {
    const value = JSON.parse(
      '{"__proto__":{"keep":true},"constructor":"value"}'
    ) as Record<string, unknown>;
    const roundTrip = decodeJSONSnapshot(
      encodeJSONSnapshot(value, context),
      context,
      'record_json'
    ) as Record<string, unknown>;
    expect(Object.hasOwn(roundTrip, '__proto__')).toBe(true);
    expect(roundTrip.__proto__).toEqual({ keep: true });
    expect(roundTrip.constructor).toBe('value');
  });

  it.each([
    ['NaN', Number.NaN],
    ['positive infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
    ['BigInt', BigInt(1)],
    ['Date', new Date(0)],
    ['Map', new Map([['x', 1]])],
    ['Set', new Set([1])],
    ['Blob', new Blob(['x'])],
    ['ArrayBuffer', new ArrayBuffer(2)],
    ['typed array', new Uint8Array([1, 2])],
    ['function', () => undefined],
    ['symbol', Symbol('value')],
  ])('rejects %s with field context', (label, value) => {
    expect(() =>
      encodeJSONSnapshot({ nested: { field: value } }, context)
    ).toThrow(
      expect.objectContaining({
        table: 'brewing_notes',
        recordId: 'note-7',
        fieldPath: 'nested.field',
      })
    );
  });

  it('rejects undefined array items and sparse arrays rather than JSON-coercing them', () => {
    expect(() =>
      encodeJSONSnapshot({ params: { stages: [1, undefined, 3] } }, context)
    ).toThrow(/brewing_notes record note-7 at params\.stages\[1\]/);
    const sparse: unknown[] = [];
    sparse[2] = 'x';
    expect(() =>
      encodeJSONSnapshot({ params: { stages: sparse } }, context)
    ).toThrow(/params\.stages\[0\].*sparse array hole/);
  });

  it('rejects cycles and reports the field path', () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => encodeJSONSnapshot({ custom: cycle }, context)).toThrow(
      /brewing_notes record note-7 at custom\.self: cyclic reference/
    );
  });

  it('reports malformed JSON with table, record and column', () => {
    expect(() => decodeJSONSnapshot('{', context, 'record_json')).toThrow(
      /brewing_notes record note-7 at record_json: JSON parse failed/
    );
  });

  it('uses a missing property after canonicalizing object undefined', () => {
    const canonical = canonicalizePersistedSnapshot(
      { a: undefined, b: null },
      context
    ) as Record<string, unknown>;
    expect(Object.hasOwn(canonical, 'a')).toBe(false);
    expect(Object.hasOwn(canonical, 'b')).toBe(true);
    expect(canonical.b).toBeNull();
  });

  it('requires safe integers for epoch-named fields at every snapshot depth', () => {
    expect(() =>
      encodeJSONSnapshot(
        { roasterConfigs: [{ roasterName: 'Roaster', updatedAt: 1.5 }] },
        { table: 'app_settings', recordId: 'main' },
        'data_json'
      )
    ).toThrow(
      /app_settings record main at data_json\.roasterConfigs\[0\]\.updatedAt: expected an integer/
    );
    expect(
      decodeJSONSnapshot('{"updatedAt":null}', context, 'record_json')
    ).toEqual({ updatedAt: null });
  });

  it('uses a simple diagnostic error type', () => {
    const error = new SQLiteCodecError(context, 'params.water', 'bad value');
    expect(error.message).toContain('brewing_notes record note-7');
    expect(error.fieldPath).toBe('params.water');
    expect(error.reason).toBe('bad value');
  });
});
