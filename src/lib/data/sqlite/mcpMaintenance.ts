import type { SqliteExecutor } from './driver';

/** Older databases and mobile databases may never have enabled desktop MCP. */
export async function clearOptionalMcpTables(
  tx: SqliteExecutor
): Promise<void> {
  const tables = await tx.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('mcp_operations', 'mcp_activity', 'mcp_publications')"
  );
  for (const { name } of tables) {
    if (
      name === 'mcp_operations' ||
      name === 'mcp_activity' ||
      name === 'mcp_publications'
    ) {
      await tx.execute(`DELETE FROM ${name}`);
    }
  }
}
