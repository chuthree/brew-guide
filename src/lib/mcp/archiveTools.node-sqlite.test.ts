import { beforeEach, afterEach, it, expect, describe } from 'vitest';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  listHistoricalYearlyReports,
  saveHistoricalYearlyReport,
} from '@/lib/data/sqlite/repositories/historicalYearlyReport';
import { readArchiveTool, mutateArchiveTool } from './archiveTools';
import { clearMcpLocalHistory } from './storage';
let db: NodeSqliteTestDatabase;
const read = (name: string, args: Record<string, unknown> = {}) =>
  readArchiveTool(db.driver, name, args);
const mutate = (name: string, args: Record<string, unknown>) =>
  db.driver.transaction(tx =>
    mutateArchiveTool(tx, name, {
      requestId: 'isolated-archive-request',
      ...args,
    })
  );
describe('local archive tools real SQLite', () => {
  beforeEach(async () => {
    db = await createNodeSqliteTestDatabase();
  });
  afterEach(async () => {
    await db.close();
  });
  it('creates, lists, reads, updates, previews and deletes one archive without touching source data', async () => {
    const initial = await read('list_historical_reports');
    const created = await mutate('upsert_historical_report', {
      expectedVersion: initial.version,
      year: 2025,
      username: 'Local',
      content: 'Report text',
      extraJson: JSON.stringify({ format: 'markdown', details: { cups: 10 } }),
    });
    const item = created.result.item as Record<string, unknown>;
    expect(await read('get_historical_report', { id: item.id })).toMatchObject({
      item: { year: 2025, format: 'markdown', details: { cups: 10 } },
    });
    const updated = await mutate('upsert_historical_report', {
      id: item.id,
      expectedVersion: created.result.version,
      year: 2026,
      username: 'Local',
      content: 'Revised',
    });
    expect(updated.result.item).toMatchObject({
      format: 'markdown',
      createdAt: item.createdAt,
      details: { cups: 10 },
    });
    expect(await read('list_historical_reports', { year: 2025 })).toMatchObject(
      { total: 0 }
    );
    expect(
      await read('list_historical_reports', { year: 2026, offset: 0, limit: 1 })
    ).toMatchObject({ total: 1, items: [{ id: item.id }] });
    const preview = await read('preview_delete_historical_report', {
      id: item.id,
    });
    expect(preview.impact).toEqual({
      reportsDeleted: 1,
      sourceRecordsChanged: 0,
    });
    await mutate('delete_historical_report', {
      id: item.id,
      expectedVersion: preview.version,
      confirmationToken: preview.confirmationToken,
    });
    expect(await listHistoricalYearlyReports(db.driver)).toEqual([]);
  });
  it('preserves unknown canonical extensions on update and supports explicit clear', async () => {
    await saveHistoricalYearlyReport(db.driver, {
      id: 'old',
      year: 2020,
      username: 'U',
      content: 'C',
      createdAt: 1,
      legacyExtension: { anything: [1, true, null] },
    });
    const old = await read('get_historical_report', { id: 'old' });
    let result = await mutate('upsert_historical_report', {
      id: 'old',
      expectedVersion: old.version,
      year: 2021,
      username: 'U',
      content: 'D',
    });
    expect(result.result.item).toHaveProperty('legacyExtension');
    result = await mutate('upsert_historical_report', {
      id: 'old',
      expectedVersion: result.result.version,
      year: 2021,
      username: 'U',
      content: 'D',
      extraJson: '{}',
    });
    expect(result.result.item).not.toHaveProperty('legacyExtension');
    expect(result.result.item).toHaveProperty('createdAt', 1);
  });
  it('rejects reserved and prototype keys, nonfinite or excessive-depth JSON and invalid ranges', async () => {
    const { version } = await read('list_historical_reports');
    for (const extraJson of [
      '[]',
      '{',
      '{"id":"overwrite"}',
      '{"__proto__":{}}',
      '{"a":{"constructor":1}}',
      '{"x":1e999}',
      JSON.stringify({ a: JSON.parse('['.repeat(22) + '1' + ']'.repeat(22)) }),
    ])
      await expect(
        mutate('upsert_historical_report', {
          expectedVersion: version,
          year: 2025,
          username: 'U',
          content: 'C',
          extraJson,
        })
      ).rejects.toThrow();
    await expect(
      mutate('upsert_historical_report', {
        expectedVersion: version,
        year: 0,
        username: 'U',
        content: 'C',
      })
    ).rejects.toThrow();
    expect(await listHistoricalYearlyReports(db.driver)).toEqual([]);
  });
  it('rejects stale versions and reset-surviving confirmations', async () => {
    await saveHistoricalYearlyReport(db.driver, {
      id: 'a',
      year: 2020,
      username: 'U',
      content: 'C',
      createdAt: 1,
    });
    let preview = await read('preview_delete_historical_report', { id: 'a' });
    await saveHistoricalYearlyReport(db.driver, {
      id: 'a',
      year: 2020,
      username: 'U',
      content: 'D',
      createdAt: 1,
    });
    await expect(
      mutate('delete_historical_report', {
        id: 'a',
        expectedVersion: preview.version,
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toThrow('changed');
    preview = await read('preview_delete_historical_report', { id: 'a' });
    await clearMcpLocalHistory(db.driver);
    await expect(
      mutate('delete_historical_report', {
        id: 'a',
        expectedVersion: preview.version,
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toThrow('preview');
    expect(await listHistoricalYearlyReports(db.driver)).toHaveLength(1);
  });
  it('rolls back archive writes within transaction and does not create unknown supplied ids', async () => {
    const { version } = await read('list_historical_reports');
    await expect(
      db.driver.transaction(async tx => {
        await mutateArchiveTool(tx, 'upsert_historical_report', {
          requestId: 'archive-rollback',
          expectedVersion: version,
          year: 2025,
          username: 'U',
          content: 'C',
        });
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    expect(await listHistoricalYearlyReports(db.driver)).toEqual([]);
    await expect(
      mutate('upsert_historical_report', {
        id: 'missing',
        expectedVersion: version,
        year: 2025,
        username: 'U',
        content: 'C',
      })
    ).rejects.toThrow('not found');
  });
});
