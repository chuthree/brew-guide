import { describe, expect, it } from 'vitest';
import {
  describeRequestedProviderScopes,
  hasValidRequestedProviderScopes,
  isValidProviderAuthorization,
  verifiedProviderIcon,
  providerAuthorizationOutcomeMessage,
} from './permissionPresentation';
import type { PendingProviderAuthorization, ProviderScopes } from './client';

const request: PendingProviderAuthorization = {
  requestId: 'native-ticket',
  caller: {
    label: '调用应用',
    packageName: 'test.caller',
    identityCurrent: true,
  },
  brewGuide: { label: 'Brew Guide' },
  scopes: { notes: { read: true, write: true, delete: false } },
  expiresAt: 2000,
  status: 'pending',
};

describe('Provider consent presentation', () => {
  it('never presents cancelled or stale approval as success', () => {
    expect(
      providerAuthorizationOutcomeMessage('approve', 'approved')
    ).toBeNull();
    expect(providerAuthorizationOutcomeMessage('approve', 'cancelled')).toBe(
      '授权已取消。'
    );
    expect(providerAuthorizationOutcomeMessage('approve', 'expired')).toContain(
      '已失效'
    );
    expect(providerAuthorizationOutcomeMessage('approve', 'stale')).toContain(
      '已失效'
    );
    expect(
      providerAuthorizationOutcomeMessage('cancel', 'cancelled')
    ).toBeNull();
  });
  it('describes only requested domains and exact permission bits', () => {
    expect(describeRequestedProviderScopes(request.scopes)).toEqual([
      { id: 'notes', label: '笔记', description: '读取、新增与修改' },
    ]);
    expect(
      describeRequestedProviderScopes({
        beans: { read: true, write: false, delete: true },
      })
    ).toEqual([{ id: 'beans', label: '咖啡豆', description: '读取、删除' }]);
    // Showing note write must not silently imply beans/settings write.
    expect(Object.keys(request.scopes)).toEqual(['notes']);
  });
  it('enables a current valid request and rejects missing, expired or mismatched callers', () => {
    expect(isValidProviderAuthorization(request, 1000)).toBe(true);
    expect(isValidProviderAuthorization(null, 1000)).toBe(false);
    expect(isValidProviderAuthorization(request, 2000)).toBe(false);
    expect(
      isValidProviderAuthorization({ ...request, expiresAt: NaN }, 1000)
    ).toBe(false);
    expect(
      isValidProviderAuthorization(
        { ...request, caller: { ...request.caller, identityCurrent: false } },
        1000
      )
    ).toBe(false);
    expect(isValidProviderAuthorization({ ...request, scopes: {} }, 1000)).toBe(
      false
    );
  });
  it('fails closed on incomplete, unknown or inconsistent scope fields', () => {
    expect(
      hasValidRequestedProviderScopes({
        notes: { read: false, write: true, delete: false },
      })
    ).toBe(false);
    expect(
      hasValidRequestedProviderScopes({
        unknown: { read: true, write: false, delete: false },
      } as ProviderScopes)
    ).toBe(false);
    expect(
      hasValidRequestedProviderScopes({
        notes: { read: true, write: true },
      } as ProviderScopes)
    ).toBe(false);
    expect(
      hasValidRequestedProviderScopes({
        notes: { read: true, write: false, delete: false, extra: true },
      } as ProviderScopes)
    ).toBe(false);
  });
  it('renders only bounded native PNG icons, never URLs or SVG', () => {
    expect(verifiedProviderIcon('data:image/png;base64,aGVsbG8=')).toBe(
      'data:image/png;base64,aGVsbG8='
    );
    expect(
      verifiedProviderIcon('https://example.com/icon.png')
    ).toBeUndefined();
    expect(
      verifiedProviderIcon('data:image/svg+xml;base64,aGVsbG8=')
    ).toBeUndefined();
    expect(
      verifiedProviderIcon('data:image/png;base64,' + 'A'.repeat(600_000))
    ).toBeUndefined();
  });
});
