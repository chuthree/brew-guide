import type { AccessScopes, DataDomain } from '@/lib/permissions/access';
export type McpDomain = DataDomain;

/** Public tool metadata shared with the native MCP transport. */
export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  _meta: {
    'brewGuide/access': 'read' | 'write' | 'delete';
    'brewGuide/domain': McpDomain | 'core';
  };
  annotations: {
    readOnlyHint: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
}

/** Device-local configuration; never put credentials in synced app settings. */
export interface McpConfig {
  enabled: boolean;
  port: number;
  scopes: AccessScopes;
}

export interface McpStatus extends McpConfig {
  running: boolean;
  token: string;
  lastError?: string | null;
}

export interface McpPermissions {
  scopes: AccessScopes;
}

export interface McpBridgeRequest {
  requestId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpCallResult {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
    | {
        type: 'resource';
        resource: { uri: string; mimeType: string; blob: string };
      }
  >;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}
