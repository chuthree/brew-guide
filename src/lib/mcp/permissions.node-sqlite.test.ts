import { bootstrapSqliteSchema } from '@/lib/data/sqlite/schemaBootstrap';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
const native = vi.hoisted(() => ({
  driver: undefined as SqliteDriver | undefined,
}));
vi.mock('@/lib/data/sqlite/tauriSqliteDriver', () => ({
  openTauriSqliteDriver: async () => native.driver!,
}));
import { executeMcpTool, MCP_TOOLS } from './tools';
import {
  commitMcpMutation,
  pendingMcpPublications,
  flushMcpPublications,
} from './storage';
import { mcpToolDomain } from './permissions';

describe('MCP explicit scopes and durable publication', () => {
  let db: NodeSqliteTestDatabase;
  beforeEach(async () => {
    db = await createNodeSqliteTestDatabase();
    native.driver = db.driver;
  });
  afterEach(async () => {
    await db.close();
    native.driver = undefined;
  });
  it('requires explicit scopes and stays within native tool budget', async () => {
    expect(MCP_TOOLS.length).toBeLessThanOrEqual(128);
    for (const t of MCP_TOOLS)
      expect(mcpToolDomain(t.name)).not.toBeUndefined();
    const view = (await executeMcpTool(
      'get_capabilities',
      {},
      { allowWrite: true, allowDelete: true, grantedDomains: [] }
    )) as {
      permissions: { grantedDomains: string[] };
      tools: Array<{ name: string }>;
    };
    expect(view.permissions.grantedDomains).toEqual([]);
    expect(view.tools.some(t => t.name === 'get_bean')).toBe(false);
    for (const t of MCP_TOOLS.filter(t => mcpToolDomain(t.name) !== null)) {
      await expect(
        executeMcpTool(
          t.name,
          {},
          { allowWrite: true, allowDelete: true, grantedDomains: [] }
        )
      ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    }
  });
  it('reopens the app schema after optional publication ledgers exist', async () => {
    await pendingMcpPublications();
    await expect(bootstrapSqliteSchema(db.driver)).resolves.toBeDefined();
  });
  it('rejects writes/deletes and revoked reads before argument processing or data mutation', async () => {
    await expect(
      executeMcpTool(
        'create_bean',
        {},
        {
          allowWrite: false,
          allowDelete: false,
          grantedDomains: ['beans', 'notes'],
        }
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      executeMcpTool(
        'delete_bean',
        {},
        {
          allowWrite: true,
          allowDelete: false,
          grantedDomains: ['beans', 'notes'],
        }
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      executeMcpTool(
        'list_beans',
        {},
        { allowWrite: true, allowDelete: true, grantedDomains: [] }
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      executeMcpTool(
        'preview_delete',
        { entity: 'bean', id: 'x' },
        { allowWrite: true, allowDelete: true, grantedDomains: ['notes'] }
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
  });
  it('hides cross-domain audit snapshots when any required grant is revoked', async () => {
    await commitMcpMutation(
      'rename_roaster',
      { requestId: 'audit-rename-test' },
      async () => ({
        result: { renamed: true },
        changes: [
          {
            entity: 'bean',
            id: 'private-bean',
            before: null,
            after: { name: 'private' },
          },
        ],
        summary: 'rename',
      })
    );
    const restricted = (await executeMcpTool(
      'list_mcp_activity',
      {},
      { allowWrite: false, allowDelete: false, grantedDomains: ['settings'] }
    )) as { items: unknown[] };
    expect(restricted.items).toEqual([]);
    const permitted = (await executeMcpTool(
      'list_mcp_activity',
      {},
      {
        allowWrite: false,
        allowDelete: false,
        grantedDomains: ['settings', 'beans', 'notes'],
      }
    )) as { items: unknown[] };
    expect(permitted.items).toHaveLength(1);
  });
  it('retains a postcommit publication after partial failure, replays without business writes, then acknowledges', async () => {
    let mutations = 0;
    const work = async () => {
      mutations++;
      return {
        result: { saved: true },
        changes: [
          {
            entity: 'bean' as const,
            id: 'a',
            before: null,
            after: { id: 'a' },
          },
          {
            entity: 'brew_note' as const,
            id: 'b',
            before: null,
            after: { id: 'b' },
          },
        ],
        summary: 'test',
      };
    };
    const args = { requestId: 'durable-publication-001' };
    await commitMcpMutation('create_bean', args, work);
    const delivered: string[] = [];
    await expect(
      flushMcpPublications(async changes => {
        delivered.push(changes[0].id);
        throw new Error('projection interrupted');
      })
    ).rejects.toThrow('projection interrupted');
    expect((await pendingMcpPublications()).length).toBe(1);
    const replay = await commitMcpMutation('create_bean', args, work);
    expect(replay.result.replayed).toBe(true);
    expect(replay.changes).toHaveLength(2);
    expect(mutations).toBe(1);
    await flushMcpPublications(async changes => {
      for (const change of changes)
        if (!delivered.includes(change.id)) delivered.push(change.id);
    });
    expect(delivered).toEqual(['a', 'b']);
    expect(await pendingMcpPublications()).toEqual([]);
    expect(
      (await commitMcpMutation('create_bean', args, work)).changes
    ).toEqual([]);
    expect(mutations).toBe(1);
  });
});
