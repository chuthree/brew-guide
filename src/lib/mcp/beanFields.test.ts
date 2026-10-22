import type { McpPermissions } from './types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import { getCoffeeBean } from '@/lib/data/sqlite/repositories/coffeeBean';
import { listBrewingNotes } from '@/lib/data/sqlite/repositories/brewingNote';
const native = vi.hoisted(() => ({
  driver: undefined as SqliteDriver | undefined,
}));
vi.mock('@/lib/data/sqlite/tauriSqliteDriver', () => ({
  openTauriSqliteDriver: async () => {
    if (!native.driver) throw new Error('Test database not initialized');
    return native.driver;
  },
}));
import { executeMcpTool } from './tools';
import { saveAppSettings } from '@/lib/data/sqlite/repositories/appSettings';
import type { AppSettings } from '@/lib/data/models';
import type { CoffeeBean } from '@/types/app';
import type { BeanFieldId } from '@/lib/coffee-beans/beanFields';
type BeanView = {
  id: string;
  version: string;
  blendComponents?: CoffeeBean['blendComponents'];
  notes?: string;
};
type Result = { bean: BeanView; items: BeanView[] };
const permissions: McpPermissions = {
  allowWrite: true,
  allowDelete: true,
  grantedDomains: ['beans', 'notes'],
};
let seq = 0;
let db: NodeSqliteTestDatabase;
const call = async (name: string, args: Record<string, unknown>) =>
  (await executeMcpTool(name, args, permissions)) as Result;
const create = (bean: Record<string, unknown>) =>
  call('create_bean', {
    requestId: `bean-fields-${++seq}`,
    bean: { name: 'Synthetic bean', capacityGrams: 100, ...bean },
  });
const update = (bean: BeanView, changes: Record<string, unknown>) =>
  call('update_bean', {
    requestId: `bean-fields-${++seq}`,
    id: bean.id,
    expectedVersion: bean.version,
    changes,
  });
const saved = async (result: Result) =>
  (await getCoffeeBean(db.driver, result.bean.id))!;
const configure = async (ids: BeanFieldId[]) =>
  saveAppSettings(db.driver, {
    beanFieldConfig: {
      version: 1,
      fields: ids.map((id, order) => ({ id, enabled: true, order })),
    },
  } as AppSettings);
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  native.driver = db.driver;
});
afterEach(async () => {
  native.driver = undefined;
  await db.close();
});
describe('MCP generic bean field configuration (real SQLite)', () => {
  it('uses default enabled fields and canonical disabled-field notes without attribution prose', async () => {
    const result = await create({
      notes: 'Personal remark',
      blendComponents: [
        {
          origin: 'Kenya',
          country: 'Kenya',
          region: 'Nyeri',
          estate: 'Estate X',
          process: 'Washed',
          variety: ['SL28/34', 'Ruiru 11', 'Batian'],
        },
      ],
    });
    const bean = await saved(result);
    expect(bean.blendComponents).toEqual([
      {
        origin: 'Kenya',
        process: 'Washed',
        variety: ['SL28/34', 'Ruiru 11', 'Batian'],
      },
    ]);
    expect(bean.notes).toBe(
      'Personal remark / 产国：Kenya / 产区：Nyeri / 庄园：Estate X'
    );
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
  });
  it('preserves explicit variety array boundaries through create/get/list readonly projections', async () => {
    const result = await create({
      blendComponents: [{ variety: ['SL28/34', 'Ruiru 11', 'Batian'] }],
    });
    const before = await saved(result);
    expect(before.blendComponents?.[0].variety).toEqual([
      'SL28/34',
      'Ruiru 11',
      'Batian',
    ]);
    expect(
      (await call('get_bean', { id: result.bean.id })).bean.blendComponents?.[0]
        .variety
    ).toEqual(['SL28/34', 'Ruiru 11', 'Batian']);
    expect(
      (await call('list_beans', {})).items[0].blendComponents?.[0].variety
    ).toEqual(['SL28/34', 'Ruiru 11', 'Batian']);
    expect(await saved(result)).toEqual(before);
  });
  it('routes disabled variety arrays into a lossless managed JSON note and restores when enabled', async () => {
    await configure(['origin', 'process']);
    let result = await create({
      notes: 'Personal remark',
      blendComponents: [
        { origin: 'Kenya', variety: ['SL28/34', 'Ruiru 11', 'Batian'] },
      ],
    });
    const disabled = await saved(result);
    expect(disabled.blendComponents).toEqual([{ origin: 'Kenya' }]);
    expect(disabled.notes).toBe(
      'Personal remark / 品种：["SL28/34","Ruiru 11","Batian"]'
    );
    await configure(['origin', 'process', 'variety']);
    result = await update(result.bean, {
      blendComponents: disabled.blendComponents,
    });
    expect((await saved(result)).blendComponents).toEqual([
      { origin: 'Kenya', variety: ['SL28/34', 'Ruiru 11', 'Batian'] },
    ]);
    expect((await saved(result)).notes).toBe('Personal remark');
  });
  it('replaces an old managed variety note while preserving unrelated free remarks', async () => {
    await configure(['origin', 'process']);
    let result = await create({
      notes: 'Personal remark',
      blendComponents: [
        { origin: 'Kenya', country: 'Kenya', variety: ['Old A', 'Old B'] },
      ],
    });
    result = await update(result.bean, {
      blendComponents: [
        { origin: 'Kenya', variety: ['SL28/34', 'Ruiru 11', 'Batian'] },
      ],
    });
    const bean = await saved(result);
    expect(bean.notes).toBe(
      'Personal remark / 产国：Kenya / 品种：["SL28/34","Ruiru 11","Batian"]'
    );
    expect(bean.notes).not.toContain('Old');
    expect(bean.blendComponents).toEqual([{ origin: 'Kenya' }]);
  });
  it('unrelated name edits preserve historical structured fields and remarks despite changed config', async () => {
    const initial = await create({
      notes: 'Personal remark',
      blendComponents: [{ origin: 'Kenya', variety: ['SL28/34', 'Batian'] }],
    });
    const before = await saved(initial);
    await configure(['origin']);
    const after = await saved(await update(initial.bean, { name: 'New name' }));
    expect(after.blendComponents).toEqual(before.blendComponents);
    expect(after.notes).toEqual(before.notes);
    expect(after.name).toBe('New name');
  });
  it('keeps legacy string variety compatible without slash-based splitting', async () => {
    let result = await create({ blendComponents: [{ variety: 'SL28/34' }] });
    expect((await saved(result)).blendComponents?.[0].variety).toBe('SL28/34');
    result = await update(result.bean, {
      blendComponents: [{ variety: 'Bourbon / Caturra' }],
    });
    expect((await saved(result)).blendComponents?.[0].variety).toBe(
      'Bourbon / Caturra'
    );
  });
  it('rejects non-string array values atomically', async () => {
    await expect(
      create({ blendComponents: [{ variety: ['SL28', 42] }] })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect((await call('list_beans', {})).items).toHaveLength(0);
  });
  it('rejects ambiguous component reorder atomically and accepts explicit scoped-note remapping', async () => {
    await configure(['origin']);
    const initial = await create({
      notes: 'Personal remark',
      blendComponents: [
        { origin: 'A', variety: ['SL28/34', 'Ruiru 11'] },
        { origin: 'B', variety: ['Batian'] },
      ],
    });
    const before = await saved(initial);
    expect(before.blendComponents).toEqual([{ origin: 'A' }, { origin: 'B' }]);
    expect(before.notes).toBe(
      'Personal remark / 成分1 品种：["SL28/34","Ruiru 11"] / 成分2 品种：["Batian"]'
    );
    const reordered = [{ origin: 'B' }, { origin: 'A' }];
    await expect(
      update(initial.bean, { blendComponents: reordered })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await saved(initial)).toEqual(before);
    expect((await call('get_bean', { id: initial.bean.id })).bean.version).toBe(
      initial.bean.version
    );
    const notes =
      'Personal remark / 成分1 品种：["Batian"] / 成分2 品种：["SL28/34","Ruiru 11"]';
    const corrected = await update(initial.bean, {
      blendComponents: reordered,
      notes,
    });
    expect((await saved(corrected)).blendComponents).toEqual(reordered);
    expect((await saved(corrected)).notes).toBe(notes);
    expect((await saved(corrected)).remaining).toBe(before.remaining);
    expect((await call('list_beans', {})).items).toHaveLength(1);
  });
});
