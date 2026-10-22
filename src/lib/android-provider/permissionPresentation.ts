import type { MainNavigationTab } from '@/lib/navigation/navigationSettings';
import type { McpDomain } from '@/lib/mcp/types';
import type {
  ProviderScopes,
  ProviderScope,
  PendingProviderAuthorization,
} from './client';

export const providerScopeOptions: {
  id: McpDomain;
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
  grants: ProviderScopes = {}
) {
  return providerScopeOptions.filter(
    scope =>
      !scope.module || visibleTabs[scope.module] || grants[scope.id]?.read
  );
}

export function updateProviderScope(
  grants: ProviderScopes,
  domain: McpDomain,
  patch: Partial<ProviderScope>
): ProviderScopes {
  const next = { ...grants };
  const value = {
    read: false,
    write: false,
    delete: false,
    ...next[domain],
    ...patch,
  };
  if (!value.read) delete next[domain];
  else next[domain] = value;
  return next;
}

/** Describes exactly the requested grant bits, never expands to implied domains. */
export function describeRequestedProviderScopes(scopes: ProviderScopes) {
  return providerScopeOptions.flatMap(scope => {
    const permissions = scopes[scope.id];
    if (!permissions) return [];
    const actions = [
      permissions.read && '读取',
      permissions.write && '新增与修改',
      permissions.delete && '删除',
    ].filter(Boolean);
    return actions.length
      ? [{ id: scope.id, label: scope.label, description: actions.join('、') }]
      : [];
  });
}

export function hasValidRequestedProviderScopes(
  scopes: ProviderScopes
): boolean {
  if (!scopes || typeof scopes !== 'object' || Array.isArray(scopes))
    return false;
  const entries = Object.entries(scopes);
  return (
    entries.length > 0 &&
    entries.every(
      ([domain, permissions]) =>
        providerScopeOptions.some(scope => scope.id === domain) &&
        permissions &&
        permissions.read === true &&
        typeof permissions.write === 'boolean' &&
        typeof permissions.delete === 'boolean' &&
        Object.keys(permissions).every(key =>
          ['read', 'write', 'delete'].includes(key)
        )
    )
  );
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
