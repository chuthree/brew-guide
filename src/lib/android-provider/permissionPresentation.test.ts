import { describe, expect, it } from 'vitest';
import { visibleProviderScopes } from './permissionPresentation';
import { updateScopeAccess } from '@/lib/permissions/presentation';
import type { AccessScopes } from '@/lib/permissions/access';

describe('Provider permission presentation', () => {
  const hidden = { brewing: false, coffeeBean: false, notes: false };
  it('retains authorized hidden modules at either access level', () => {
    expect(visibleProviderScopes(hidden).map(scope => scope.id)).toEqual([
      'settings',
    ]);
    expect(
      visibleProviderScopes(hidden, { beans: 'read', notes: 'edit' }).map(
        scope => scope.id
      )
    ).toEqual(['beans', 'notes', 'settings']);
  });
  it('hides disabled modules after revocation without changing other grants', () => {
    const grants: AccessScopes = { beans: 'edit', notes: 'read' };
    const next = updateScopeAccess(grants, 'beans', 'none');
    expect(visibleProviderScopes(hidden, next).map(scope => scope.id)).toEqual([
      'notes',
      'settings',
    ]);
    expect(grants.beans).toBe('edit');
    expect(next).toEqual({ notes: 'read' });
  });
  it('applies only the selected level to the selected domain', () => {
    expect(updateScopeAccess({}, 'notes', 'read')).toEqual({ notes: 'read' });
    expect(updateScopeAccess({ beans: 'read' }, 'notes', 'edit')).toEqual({
      beans: 'read',
      notes: 'edit',
    });
    expect(updateScopeAccess({ notes: 'edit' }, 'notes', 'read')).toEqual({
      notes: 'read',
    });
  });
});
