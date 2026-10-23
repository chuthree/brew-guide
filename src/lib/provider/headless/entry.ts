import './polyfills';
import {
  executeMcpTool,
  MCP_TOOLS,
  recoverMcpPublications,
  McpToolError,
} from '@/lib/mcp/tools';
import { requiredMcpDomains } from '@/lib/mcp/permissions';
import {
  setBusinessPublicationHost,
  setBusinessActivityScope,
  setBusinessMutationAuthorizationHost,
} from '@/lib/mcp/runtimeHost';
import { initializeProviderStorage } from '../storageBootstrap';
import { createTauriImageFileStore } from './images';
import { driver } from './sqlite';
import { host } from './host';
import type { McpPermissions } from '@/lib/mcp/types';
declare const __brewDrain: () => boolean;
setBusinessActivityScope(requestId =>
  requestId.startsWith(
    host<{ namespace: string }>('context.identity').namespace + ':'
  )
);
setBusinessPublicationHost(async changes => {
  host('events.publish', { changes });
});
setBusinessMutationAuthorizationHost(async changes => {
  try {
    host('permissions.checkChanges', { changes });
  } catch {
    throw new McpToolError(
      'PERMISSION_DENIED',
      'The caller lacks permission for one or more affected data scopes.'
    );
  }
});
function synchronous(work: () => Promise<unknown>): string {
  let finished = false;
  let response: unknown;
  try {
    work().then(
      result => {
        response = { ok: true, result };
        finished = true;
      },
      error => {
        response = {
          ok: false,
          error: {
            code: error instanceof McpToolError ? error.code : 'INTERNAL_ERROR',
            message:
              error instanceof McpToolError
                ? String(error.message)
                : 'The operation could not be completed.',
          },
        };
        finished = true;
      }
    );
    let cycles = 0;
    while (!finished && cycles++ < 100000) {
      if (!__brewDrain()) break;
    }
    if (!finished)
      return JSON.stringify({
        ok: false,
        error: {
          code: 'RUNTIME_INCOMPLETE',
          message: 'Business runtime did not settle synchronously.',
        },
      });
    return JSON.stringify(response);
  } catch (_error) {
    return JSON.stringify({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: 'Business runtime failure.' },
    });
  }
}
export function initialize(): string {
  return synchronous(async () => {
    await initializeProviderStorage(
      driver,
      await createTauriImageFileStore(),
      host<boolean>('migration.canAdoptFresh')
    );
    await recoverMcpPublications();
    return { schemaVersion: 1 };
  });
}
export function catalog(): string {
  return JSON.stringify(
    MCP_TOOLS.map(tool => ({
      ...tool,
      requiredDomains: requiredMcpDomains(tool.name),
    }))
  );
}
export function execute(
  name: string,
  argsJson: string,
  permissionsJson: string
): string {
  return synchronous(async () => {
    const result = await executeMcpTool(
      name,
      JSON.parse(argsJson),
      JSON.parse(permissionsJson) as McpPermissions
    );
    if (name === 'get_capabilities')
      return {
        ...(result as object),
        transport: 'Android ContentProvider',
        desktopOnly: false,
      };
    return result;
  });
}
