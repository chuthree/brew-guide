/** Device-local authorization contract shared by MCP and Android IPC. */
export const DATA_DOMAINS = ['brewing', 'beans', 'notes', 'settings'] as const;
export type DataDomain = (typeof DATA_DOMAINS)[number];
export type AccessLevel = 'read' | 'edit';
export type AccessScopes = Partial<Record<DataDomain, AccessLevel>>;
export type DataOperation = 'read' | 'write' | 'delete';

/** Reject unknown domains, old grant objects and ambiguous permission values. */
export function parseAccessScopes(value: unknown): AccessScopes {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(
      'Permission scopes must be a domain-to-access-level object.'
    );
  const scopes: AccessScopes = {};
  for (const [domain, level] of Object.entries(value)) {
    if (
      !DATA_DOMAINS.includes(domain as DataDomain) ||
      (level !== 'read' && level !== 'edit')
    )
      throw new Error('Unknown data domain or access level.');
    scopes[domain as DataDomain] = level;
  }
  return scopes;
}

export function hasDataAccess(
  scopes: AccessScopes,
  domain: DataDomain,
  operation: DataOperation = 'read'
): boolean {
  return (
    scopes[domain] === 'edit' ||
    (operation === 'read' && scopes[domain] === 'read')
  );
}
