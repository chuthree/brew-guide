import { describe, expect, it } from 'vitest';
import {
  visibleProviderScopes,
  updateProviderScope,
} from './permissionPresentation';

describe('Provider permission presentation', () => {
  const hidden = { brewing: false, coffeeBean: false, notes: false };
  it('follows visible modules without hiding still-authorized scopes', () => {
    expect(visibleProviderScopes(hidden).map(scope => scope.id)).toEqual([
      'settings',
    ]);
    expect(
      visibleProviderScopes(hidden, {
        beans: { read: true, write: false, delete: false },
      }).map(scope => scope.id)
    ).toEqual(['beans', 'settings']);
  });
  it('hides a disabled module only after its permission is removed', () => {
    const grants = { beans: { read: true, write: true, delete: true } };
    const next = updateProviderScope(grants, 'beans', { read: false });
    expect(visibleProviderScopes(hidden, next).map(scope => scope.id)).toEqual([
      'settings',
    ]);
    expect(grants.beans.write).toBe(true);
  });
  it('does not silently grant mutation or deletion access with read access', () => {
    expect(updateProviderScope({}, 'notes', { read: true })).toEqual({
      notes: { read: true, write: false, delete: false },
    });
  });
  it('retains other domains when changing one permission', () => {
    const grants = {
      notes: { read: true, write: false, delete: false },
      beans: { read: true, write: true, delete: false },
    };
    expect(updateProviderScope(grants, 'notes', { delete: true })).toEqual({
      ...grants,
      notes: { ...grants.notes, delete: true },
    });
  });
});
