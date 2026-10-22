import { DATA_DOMAINS, type DataDomain } from '@/lib/permissions/access';
import { mutationChangeDomain, requiredMcpDomains } from './permissions';
import type { SqliteDriver, SqliteExecutor } from '@/lib/data/sqlite/driver';
import { openTauriSqliteDriver } from '@/lib/data/sqlite/tauriSqliteDriver';
import { canonicalJson, McpToolError, recordVersion } from './validation';
import { authorizeMutationChanges } from './runtimeHost';

const initialized = new WeakMap<SqliteDriver, Promise<void>>();
export let localHistoryGeneration = 0;

export async function getMcpDriver(): Promise<SqliteDriver> {
  const driver = await openTauriSqliteDriver();
  let initialization = initialized.get(driver);
  if (!initialization) {
    initialization = driver.transaction(async tx => {
      await tx.execute(`CREATE TABLE IF NOT EXISTS mcp_operations (
        request_id TEXT NOT NULL PRIMARY KEY,
        tool TEXT NOT NULL,
        args_hash TEXT NOT NULL,
        result_json TEXT NOT NULL,
        result_domains_json TEXT,
        created_at_ms INTEGER NOT NULL
      )`);
      const columns = await tx.query('PRAGMA table_info(mcp_operations)');
      if (!columns.some(column => column.name === 'result_domains_json'))
        await tx.execute(
          'ALTER TABLE mcp_operations ADD COLUMN result_domains_json TEXT'
        );
      await tx.execute(`CREATE TABLE IF NOT EXISTS mcp_publications (
        request_id TEXT NOT NULL PRIMARY KEY,
        changes_json TEXT NOT NULL,
        created_at_ms INTEGER NOT NULL
      )`);
      await tx.execute(`CREATE TABLE IF NOT EXISTS mcp_activity (
        request_id TEXT NOT NULL PRIMARY KEY,
        tool TEXT NOT NULL,
        timestamp_ms INTEGER NOT NULL,
        summary TEXT NOT NULL,
        snapshots_json TEXT NOT NULL
      )`);
    });
    initialized.set(driver, initialization);
    void initialization.catch(() => initialized.delete(driver));
  }
  await initialization;
  return driver;
}

export interface MutationChange {
  entity:
    | 'bean'
    | 'brew_note'
    | 'equipment'
    | 'method'
    | 'grinder'
    | 'settings'
    | 'historical_report';
  id: string;
  before: unknown | null;
  after: unknown | null;
}

export interface MutationWork<T> {
  result: T;
  changes: MutationChange[];
  summary: string;
  cleanupPaths?: string[];
}

/** Idempotency and the business writes share one SQLite commit. */
export async function commitMcpMutation<T extends Record<string, unknown>>(
  tool: string,
  args: Record<string, unknown>,
  work: (tx: SqliteExecutor) => Promise<MutationWork<T>>,
  authorize?: (changes: MutationChange[]) => void | Promise<void>,
  authorizeReplay?: (domains: DataDomain[]) => void | Promise<void>
): Promise<{
  result: T & { requestId: string; replayed: boolean };
  changes: MutationChange[];
  cleanupPaths: string[];
}> {
  const driver = await getMcpDriver();
  const requestId = args.requestId as string;
  const argsHash = await recordVersion(args);
  return driver.transaction(async tx => {
    const existing = await tx.query(
      'SELECT tool, args_hash, result_json, result_domains_json FROM mcp_operations WHERE request_id = ?',
      [requestId]
    );
    if (existing.length > 0) {
      if (existing[0].tool !== tool || existing[0].args_hash !== argsHash) {
        throw new McpToolError(
          'IDEMPOTENCY_CONFLICT',
          'This requestId was already used with different arguments. Use a new requestId for a different operation.'
        );
      }
      if (authorizeReplay) {
        let domains: DataDomain[];
        try {
          const value = JSON.parse(String(existing[0].result_domains_json));
          if (
            !Array.isArray(value) ||
            value.some(domain => !DATA_DOMAINS.includes(domain))
          )
            throw new Error('Invalid result scope metadata');
          domains = value;
        } catch {
          throw new McpToolError(
            'PERMISSION_DENIED',
            'Cannot verify the scopes of this stored response.'
          );
        }
        await authorizeReplay(domains);
      }
      const pending = await tx.query(
        'SELECT changes_json FROM mcp_publications WHERE request_id = ?',
        [requestId]
      );
      return {
        result: {
          ...JSON.parse(String(existing[0].result_json)),
          requestId,
          replayed: true,
        },
        changes: pending.length
          ? (JSON.parse(String(pending[0].changes_json)) as MutationChange[])
          : [],
        cleanupPaths: [],
      };
    }
    const { result, changes, summary, cleanupPaths = [] } = await work(tx);
    // This runs inside the same transaction: denial must roll back inventory,
    // history and any other cross-domain side effects before recording success.
    await authorize?.(changes);
    await authorizeMutationChanges(changes);
    const resultDomains = new Set<DataDomain>(requiredMcpDomains(tool));
    for (const change of changes) {
      const domain = mutationChangeDomain(tool, change);
      if (!domain)
        throw new McpToolError(
          'PERMISSION_DENIED',
          'Unknown changed data scope.'
        );
      resultDomains.add(domain);
    }
    const timestamp = Date.now();
    await tx.execute(
      'INSERT INTO mcp_operations (request_id, tool, args_hash, result_json, created_at_ms, result_domains_json) VALUES (?, ?, ?, ?, ?, ?)',
      [
        requestId,
        tool,
        argsHash,
        canonicalJson(result),
        timestamp,
        canonicalJson([...resultDomains].sort()),
      ]
    );
    await tx.execute(
      'INSERT INTO mcp_activity (request_id, tool, timestamp_ms, summary, snapshots_json) VALUES (?, ?, ?, ?, ?)',
      [requestId, tool, timestamp, summary, canonicalJson(changes)]
    );
    if (changes.length)
      await tx.execute(
        'INSERT INTO mcp_publications (request_id, changes_json, created_at_ms) VALUES (?, ?, ?)',
        [requestId, canonicalJson(changes), timestamp]
      );
    await tx.execute(`DELETE FROM mcp_activity WHERE request_id IN (
      SELECT request_id FROM mcp_activity ORDER BY timestamp_ms DESC, request_id DESC LIMIT -1 OFFSET 500
    )`);
    return {
      result: { ...result, requestId, replayed: false },
      changes,
      cleanupPaths,
    };
  });
}

/** Called only after shutting down MCP requests at the full-data-reset boundary. */
export async function clearMcpLocalHistory(
  driver?: SqliteDriver
): Promise<void> {
  const activeDriver = driver ?? (await openTauriSqliteDriver());
  await activeDriver.transaction(async tx => {
    const tables = await tx.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('mcp_operations', 'mcp_activity', 'mcp_publications')"
    );
    for (const table of tables) {
      if (table.name === 'mcp_operations')
        await tx.execute('DELETE FROM mcp_operations');
      if (table.name === 'mcp_publications')
        await tx.execute('DELETE FROM mcp_publications');
      if (table.name === 'mcp_activity')
        await tx.execute('DELETE FROM mcp_activity');
    }
  });
  localHistoryGeneration += 1;
}

/** Acknowledge only after all app projections and local sync notifications succeed. */
export async function acknowledgeMcpPublication(
  requestId: string
): Promise<void> {
  const driver = await getMcpDriver();
  await driver.execute('DELETE FROM mcp_publications WHERE request_id = ?', [
    requestId,
  ]);
}

export async function pendingMcpPublications(): Promise<
  Array<{ requestId: string; changes: MutationChange[] }>
> {
  const driver = await getMcpDriver();
  const rows = await driver.query(
    'SELECT request_id, changes_json FROM mcp_publications ORDER BY created_at_ms, request_id'
  );
  return rows.map(row => ({
    requestId: String(row.request_id),
    changes: JSON.parse(String(row.changes_json)) as MutationChange[],
  }));
}

export async function flushMcpPublications(
  publish: (changes: MutationChange[]) => Promise<void>
): Promise<void> {
  for (const pending of await pendingMcpPublications()) {
    await publish(pending.changes);
    await acknowledgeMcpPublication(pending.requestId);
  }
}
