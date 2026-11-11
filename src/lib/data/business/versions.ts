import Dexie from 'dexie';
import { McpToolError, recordVersion } from '@/lib/mcp/validation';

/** One canonical hash format shared by local transactions and MCP commands. */
export function businessRecordVersion(record: unknown): Promise<string> {
  const digest = recordVersion(record);
  return Dexie.currentTransaction ? Dexie.waitFor(digest) : digest;
}

export async function assertBusinessVersion(
  record: unknown,
  expectedVersion: unknown
): Promise<void> {
  if (
    typeof expectedVersion !== 'string' ||
    !/^[a-f0-9]{64}$/.test(expectedVersion)
  )
    throw new McpToolError(
      'INVALID_ARGUMENT',
      'An exact current record version is required.'
    );
  if (record === undefined || record === null)
    throw new McpToolError(
      'NOT_FOUND',
      'Record no longer exists. Refresh before retrying.'
    );
  if ((await businessRecordVersion(record)) !== expectedVersion)
    throw new McpToolError(
      'CONFLICT',
      'Record changed. Read the current record and ask again before retrying.'
    );
}
