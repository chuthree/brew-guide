import { resultFor } from './results';
import { configureMcp, getMcpStatus, isDesktopMcpAvailable } from './client';
import type { McpBridgeRequest, McpCallResult, McpPermissions } from './types';

let initialization: Promise<void> | null = null;
let requestTail = Promise.resolve();

/** Revoke access and drain already-authorized writes before a full data reset. */
export async function stopDesktopMcpForDataReset(): Promise<void> {
  if (!isDesktopMcpAvailable()) return;
  const status = await getMcpStatus();
  await configureMcp(
    {
      enabled: false,
      port: status.port,
      allowWrite: false,
      allowDelete: false,
      grantedDomains: [],
    },
    true
  );
  await requestTail;
}

/** Register only after SQLite migration and the app stores have initialized. */
export function initializeDesktopMcpBridge(): Promise<void> {
  if (!isDesktopMcpAvailable()) return Promise.resolve();
  if (initialization) return initialization;

  const opening = (async () => {
    const [
      { invoke },
      { listen },
      { MCP_TOOLS, executeMcpTool, McpToolError, recoverMcpPublications },
    ] = await Promise.all([
      import('@tauri-apps/api/core'),
      import('@tauri-apps/api/event'),
      import('./tools'),
    ]);

    // Recover durable notification work, never repeat the committed domain mutation.
    await recoverMcpPublications().catch(() => undefined);

    // Calls share the app's SQLite connection. Queue them and authorize at the
    // head of the queue so expired or revoked requests never execute later.
    let queued = 0;
    const unlisten = await listen<McpBridgeRequest>('mcp:request', event => {
      const request = event.payload;
      if (queued >= 16) {
        void (async () => {
          try {
            await invoke('mcp_authorize_request', {
              requestId: request.requestId,
            });
            await invoke('mcp_respond', {
              requestId: request.requestId,
              result: {
                ...resultFor({
                  error: { code: 'BUSY', message: '请求过多，请稍后重试' },
                }),
                isError: true,
              },
            });
          } catch {
            // Expired or revoked requests have no remaining recipient.
          }
        })();
        return;
      }
      queued += 1;
      requestTail = requestTail
        .catch(() => undefined)
        .then(async () => {
          let result: McpCallResult;
          try {
            result = resultFor(
              await executeMcpTool(request.name, request.arguments, () =>
                invoke<McpPermissions>('mcp_authorize_request', {
                  requestId: request.requestId,
                })
              ),
              request.name
            );
            const tool = MCP_TOOLS.find(tool => tool.name === request.name);
            if (
              tool &&
              !tool.annotations.readOnlyHint &&
              !result.structuredContent?.replayed
            ) {
              void import('@/components/common/feedback/LightToast')
                .then(({ showToast }) => {
                  showToast({
                    type: 'success',
                    title: 'MCP 已更新数据',
                  });
                })
                .catch(() => undefined);
            }
          } catch (error) {
            // Internal SQLite/filesystem errors can contain local paths. Return
            // only intentional domain errors across the external boundary.
            const detail =
              error instanceof McpToolError
                ? { code: error.code, message: error.message }
                : {
                    code: 'INTERNAL_ERROR',
                    message:
                      '操作失败，请在 Brew Guide 中检查数据后重试；写入重试请沿用原 requestId。',
                  };
            result = { ...resultFor({ error: detail }), isError: true };
          }

          try {
            await invoke('mcp_respond', {
              requestId: request.requestId,
              result,
            });
          } catch {
            // A committed write is persisted with its idempotency key. If the
            // connection disappeared, retrying that key returns the same result.
          }
        })
        .finally(() => {
          queued -= 1;
        });
    });

    try {
      await invoke('mcp_bridge_ready', { tools: MCP_TOOLS });
    } catch (error) {
      unlisten();
      throw error;
    }
  })();
  initialization = opening;
  void opening.catch(() => {
    if (initialization === opening) initialization = null;
  });
  return opening;
}
