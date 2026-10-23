import { describe, expect, it } from 'vitest';
import { DATA_DOMAINS, hasDataAccess, parseAccessScopes } from './access';

describe('shared read/edit permission contract', () => {
  for (const domain of DATA_DOMAINS)
    for (const level of [undefined, 'read', 'edit'] as const)
      for (const operation of ['read', 'write', 'delete'] as const)
        it(`${domain} ${level ?? 'absent'} ${operation}`, () => {
          const scopes = level ? { [domain]: level } : {};
          expect(hasDataAccess(scopes, domain, operation)).toBe(
            level === 'edit' || (level === 'read' && operation === 'read')
          );
        });
  it.each([
    null,
    [],
    true,
    { beans: 'write' },
    { beans: 'none' },
    { beans: null },
    { beans: { read: true } },
    { secrets: 'edit' },
    { allowWrite: true },
  ])('rejects invalid map %j', value => {
    expect(() => parseAccessScopes(value)).toThrow();
  });
  it('copies exact canonical scopes without implicit grants', () => {
    const input = { beans: 'read', notes: 'edit' };
    expect(parseAccessScopes(input)).toEqual(input);
    expect(parseAccessScopes(input)).not.toBe(input);
    expect(parseAccessScopes({})).toEqual({});
  });
});
