import { detectAppRuntime } from '@/lib/app/runtime';
import type { McpConfig, McpStatus } from './types';

export function isDesktopMcpAvailable(): boolean {
  const runtime = detectAppRuntime();
  return runtime.runtime === 'tauri' && runtime.tauriBundled !== false;
}

async function nativeInvoke<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  if (!isDesktopMcpAvailable()) {
    throw new Error('MCP 连接仅适用于使用本地 SQLite 的桌面版');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

export function getMcpStatus(): Promise<McpStatus> {
  return nativeInvoke('mcp_status');
}

export function configureMcp(
  config: McpConfig,
  rotateToken = false
): Promise<McpStatus> {
  if (
    !Number.isInteger(config.port) ||
    config.port < 1024 ||
    config.port > 65535
  ) {
    return Promise.reject(new Error('端口应为 1024 至 65535 之间的整数'));
  }
  return nativeInvoke('mcp_configure', {
    config,
    rotateToken,
  });
}

/** Generic Streamable HTTP configuration for clients supporting URL + headers. */
export function getMcpConnectionConfig(status: McpStatus): string {
  return JSON.stringify(
    {
      mcpServers: {
        'brew-guide': {
          url: `http://127.0.0.1:${status.port}/mcp`,
          headers: { Authorization: `Bearer ${status.token}` },
        },
      },
    },
    null,
    2
  );
}
