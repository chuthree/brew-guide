import type { AccessLevel, AccessScopes, DataDomain } from './access';

export const accessLevelOptions = [
  { value: 'none', label: '未授权' },
  { value: 'read', label: '仅查看' },
  { value: 'edit', label: '查看与编辑' },
] as const;
export type AccessSelection = AccessLevel | 'none';
export const EDIT_ACCESS_DESCRIPTION = '查看与编辑包含新增、修改和删除。';
export function updateScopeAccess(
  scopes: AccessScopes,
  domain: DataDomain,
  level: AccessSelection
): AccessScopes {
  const next = { ...scopes };
  if (level === 'none') delete next[domain];
  else next[domain] = level;
  return next;
}
