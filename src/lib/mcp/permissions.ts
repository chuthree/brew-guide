import type { McpDomain } from './types';

export const MCP_DOMAIN_LABELS: Record<McpDomain, string> = {
  brewing: '冲煮',
  beans: '咖啡豆',
  notes: '笔记',
  settings: '设置',
};

/** Keep this classification aligned with native mcp.rs; unknown names fail closed. */
export function mcpToolDomain(name: string): McpDomain | null | undefined {
  if (name === 'get_capabilities' || name === 'list_mcp_activity') return null;
  if (name.includes('catalog_preferences')) return 'brewing';
  if (
    name.includes('roasting') ||
    name === 'convert_roasted_to_green' ||
    name === 'preview_convert_roasted_to_green'
  )
    return 'beans';
  if (name.includes('equipment')) return 'brewing';
  if (name.includes('method')) return 'brewing';
  if (name.includes('grinder')) return 'settings';
  if (name.includes('group')) return 'settings';
  if (name.includes('statistics') || name.includes('report')) return 'beans';
  if (
    name.includes('settings') ||
    name.includes('preferences') ||
    name.includes('roaster') ||
    name.includes('flavor_dimension')
  )
    return 'settings';
  if (name.includes('brew_note')) return 'notes';
  if (
    [
      'list_beans',
      'get_bean',
      'get_bean_image',
      'create_bean',
      'update_bean',
      'delete_bean',
      'set_bean_image',
      'delete_bean_image',
      'adjust_bean_inventory',
      'get_inventory_summary',
    ].includes(name)
  )
    return 'beans';
  // The shared deletion preview is checked against its requested entity.
  if (name === 'preview_delete') return null;
  return undefined;
}

export function requiredMcpDomains(name: string): McpDomain[] {
  if (
    name === 'convert_roasted_to_green' ||
    name === 'preview_convert_roasted_to_green'
  )
    return ['beans', 'notes', 'settings'];
  if (name === 'rename_roaster' || name === 'preview_roaster_rename')
    return ['settings', 'beans', 'notes'];
  const domain = mcpToolDomain(name);
  return domain ? [domain] : [];
}

export function hasMcpDomainAccess(name: string, grants: McpDomain[]): boolean {
  if (name === 'preview_delete')
    return grants.includes('beans') || grants.includes('notes');
  return (
    mcpToolDomain(name) !== undefined &&
    requiredMcpDomains(name).every(domain => grants.includes(domain))
  );
}
