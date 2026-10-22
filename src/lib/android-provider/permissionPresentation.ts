import type { MainNavigationTab } from '@/lib/navigation/navigationSettings';
import {
  parseAccessScopes,
  type AccessScopes,
  type DataDomain,
} from '@/lib/permissions/access';
import type { PendingProviderAuthorization } from './client';
export const providerScopeOptions: {
  id: DataDomain;
  label: string;
  module?: MainNavigationTab;
}[] = [
  { id: 'brewing', label: '冲煮', module: 'brewing' },
  { id: 'beans', label: '咖啡豆', module: 'coffeeBean' },
  { id: 'notes', label: '笔记', module: 'notes' },
  { id: 'settings', label: '设置' },
];

export function visibleProviderScopes(
  visibleTabs: Record<MainNavigationTab, boolean>,
  grants: AccessScopes = {}
) {
  return providerScopeOptions.filter(
    scope => !scope.module || visibleTabs[scope.module] || grants[scope.id]
  );
}

/** Only requested groups are shown; edit truthfully includes deletion. */
export function describeRequestedProviderScopes(scopes: AccessScopes) {
  return providerScopeOptions.flatMap(scope => {
    const level = scopes[scope.id];
    return level === 'read' || level === 'edit'
      ? [
          {
            id: scope.id,
            label: scope.label,
            description:
              level === 'read' ? '仅查看' : '查看与编辑（含新增、修改和删除）',
          },
        ]
      : [];
  });
}

export function hasValidRequestedProviderScopes(scopes: unknown): boolean {
  try {
    return Object.keys(parseAccessScopes(scopes)).length > 0;
  } catch {
    return false;
  }
}

// Native PackageManager rasterizes icons to PNG; never render external URLs or SVGs.
export function verifiedProviderIcon(iconDataUrl?: string): string | undefined {
  return iconDataUrl &&
    iconDataUrl.length <= 600_000 &&
    /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(iconDataUrl)
    ? iconDataUrl
    : undefined;
}

export function isValidProviderAuthorization(
  request: PendingProviderAuthorization | null,
  now = Date.now()
): boolean {
  return (
    !!request &&
    request.status === 'pending' &&
    request.caller.identityCurrent === true &&
    !!request.requestId &&
    !!request.caller.packageName &&
    Number.isFinite(request.expiresAt) &&
    request.expiresAt > now &&
    hasValidRequestedProviderScopes(request.scopes)
  );
}

export function providerAuthorizationOutcomeMessage(
  decision: 'approve' | 'cancel',
  status: 'approved' | 'cancelled' | 'expired' | 'stale'
): string | null {
  if (decision !== 'approve' || status === 'approved') return null;
  return status === 'cancelled'
    ? '授权已取消。'
    : '申请已失效，请返回调用应用重新申请。';
}
