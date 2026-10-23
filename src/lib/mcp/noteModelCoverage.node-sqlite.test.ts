import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  getCoffeeBean,
  saveCoffeeBean,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import {
  getBrewingNote,
  listBrewingNotes,
} from '@/lib/data/sqlite/repositories/brewingNote';
import type { McpPermissions } from './types';
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
import {
  listGrinders,
  saveGrinder,
} from '@/lib/data/sqlite/repositories/grinder';
import type { AppSettings } from '@/lib/data/models';
const full: McpPermissions = {
  scopes: { beans: 'edit', notes: 'edit', brewing: 'edit', settings: 'edit' },
};
const limited: McpPermissions = {
  scopes: { beans: 'edit', notes: 'edit', brewing: 'edit' },
};
type View = {
  id: string;
  version: string;
  taste: Record<string, number>;
  beanSnapshot: unknown;
  stages: unknown;
};
type Result = {
  note: View;
  replayed?: boolean;
  items: Array<{ requestId: string; changes: Array<{ entity: string }> }>;
};
let seq = 0;
let db: NodeSqliteTestDatabase;
const requestId = () => `note-model-${++seq}`;
const call = async (
  name: string,
  args: Record<string, unknown>,
  permissions = full
) => (await executeMcpTool(name, args, permissions)) as Result;
const create = (
  note: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
  permissions = full
) =>
  call(
    'create_brew_note',
    {
      requestId: requestId(),
      note: {
        recordType: 'brew',
        beanId: 'bean',
        coffeeGrams: 10,
        equipment: 'V60',
        method: '三段式',
        ...note,
      },
      ...extra,
    },
    permissions
  );
const update = (
  view: View,
  changes: Record<string, unknown>,
  extra: Record<string, unknown> = {}
) =>
  call('update_brew_note', {
    requestId: requestId(),
    id: view.id,
    expectedVersion: view.version,
    changes,
    ...extra,
  });
const stored = async (result: Result) =>
  (await getBrewingNote(db.driver, result.note.id))!;
const balance = async () =>
  Number((await getCoffeeBean(db.driver, 'bean'))!.remaining);
const dimensions = async (label: string | null) =>
  saveAppSettings(db.driver, {
    flavorDimensions: label
      ? [{ id: 'berry', label, order: 0, isDefault: false }]
      : [],
  } as AppSettings);
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  native.driver = db.driver;
  await saveCoffeeBean(db.driver, {
    id: 'bean',
    timestamp: 1,
    name: 'Original bean',
    roaster: 'Original roaster',
    roastDate: '2026-10-01',
    roastLevel: '浅度烘焙',
    beanState: 'roasted',
    capacity: '100',
    remaining: '100',
  });
  await saveGrinder(db.driver, {
    id: 'grinder',
    name: 'TestMill',
    currentGrindSize: 'old',
    grindSizeHistory: [],
  });
});
afterEach(async () => {
  native.driver = undefined;
  await db.close();
});
describe('MCP full note model and grinder integration (real SQLite)', () => {
  it('accepts current custom flavor IDs and preserves scores through rename/deletion and unrelated edits', async () => {
    await dimensions('Berry');
    let result = await create({ taste: { berry: 4.5 } });
    expect(result.note.taste).toEqual({ berry: 4.5 });
    expect((await stored(result)).taste).toEqual({ berry: 4.5 });
    await dimensions('Fruit');
    result = await update(result.note, { notes: 'Renamed dimension' });
    expect(result.note.taste).toEqual({ berry: 4.5 });
    await dimensions(null);
    result = await update(result.note, { rating: 3 });
    expect(result.note.taste).toEqual({ berry: 4.5 });
    const before = await stored(result);
    await expect(
      update(result.note, { taste: { berry: 2 } })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await stored(result)).toEqual(before);
    expect(await balance()).toBe(90);
  });
  it('rejects unknown/prototype flavor IDs and malformed stages before stock, note or grinder writes', async () => {
    await dimensions('Berry');
    for (const fields of [
      { taste: { missing: 2 } },
      { taste: { berry: 6 } },
      { taste: JSON.parse('{"__proto__":3}') },
      { stages: [{ label: 'Pour', detail: '', duration: -1 }] },
      { stages: [{ label: 'Pour', detail: '', unknown: 'x' }] },
    ]) {
      await expect(
        create({ ...fields, grindSize: 'TestMill · 20' })
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    }
    expect(await balance()).toBe(100);
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
    expect((await listGrinders(db.driver))[0].currentGrindSize).toBe('old');
  });
  it('roundtrips explicit stages including legacy timings without importing recipe defaults', async () => {
    const stages = [
      {
        label: 'Bloom',
        detail: 'Measured bloom',
        water: '30',
        duration: 20,
        time: 20,
        pourTime: 10,
        pourType: 'circle',
      },
    ];
    let result = await create({ stages });
    expect(result.note.stages).toEqual(stages);
    expect((await stored(result)).stages).toEqual(stages);
    expect((await stored(result)).params?.water ?? '').toBe('');
    result = await update(result.note, { rating: 4 });
    expect(result.note.stages).toEqual(stages);
    result = await update(result.note, { stages: [] });
    expect(result.note.stages).toEqual([]);
  });
  it('keeps unlinked snapshots through unrelated edits and explicitly clears them', async () => {
    const snapshot = {
      name: 'Historical bean',
      roastLevel: '浅烘',
      roastDate: '2025-01-03',
      roaster: 'Old roaster',
    };
    let result = await create({ beanId: '', beanSnapshot: snapshot });
    expect(result.note.beanSnapshot).toEqual(snapshot);
    result = await update(result.note, { rating: 4 });
    expect((await stored(result)).coffeeBeanInfo).toEqual(snapshot);
    expect(result.note.beanSnapshot).toEqual(snapshot);
    result = await update(result.note, { beanSnapshot: null });
    expect(result.note.beanSnapshot).toBeNull();
    expect((await stored(result)).coffeeBeanInfo).toBeUndefined();
    expect(await balance()).toBe(100);
  });
  it('preserves linked historical bean snapshot after catalog rename and rejects supplied snapshot override', async () => {
    let result = await create();
    const snapshot = (await stored(result)).coffeeBeanInfo;
    const bean = (await getCoffeeBean(db.driver, 'bean'))!;
    await saveCoffeeBean(db.driver, {
      ...bean,
      name: 'Renamed bean',
      roastDate: '2026-10-20',
      roaster: 'New roaster',
    });
    result = await update(result.note, { notes: 'Later tasting' });
    expect((await stored(result)).coffeeBeanInfo).toEqual(snapshot);
    expect(result.note.beanSnapshot).toMatchObject(snapshot!);
    const before = await stored(result);
    await expect(
      update(result.note, { beanSnapshot: { name: 'Spoof' } })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await stored(result)).toEqual(before);
    expect(await balance()).toBe(90);
  });
  it('syncs named grinder measurements with latest3 deduplicated canonical contexts and idempotency', async () => {
    let result = await create({ grindSize: 'TestMill · 20' });
    let grinder = (await listGrinders(db.driver))[0];
    expect(grinder.currentGrindSize).toBe('20');
    expect(grinder.grindSizeHistory?.[0]).toMatchObject({
      grindSize: '20',
      equipment: 'V60',
      method: '三段式',
      coffeeBeanName: 'Original bean',
      coffeeBeanRoaster: 'Original roaster',
    });
    for (const scale of ['21', '22', '23', '22'])
      result = await update(result.note, { grindSize: `TestMill · ${scale}` });
    grinder = (await listGrinders(db.driver))[0];
    expect(grinder.grindSizeHistory?.map(h => h.grindSize)).toEqual([
      '22',
      '23',
      '21',
    ]);
    const args = {
      requestId: requestId(),
      id: result.note.id,
      expectedVersion: result.note.version,
      changes: { grindSize: 'TestMill · 24' },
    };
    const first = await call('update_brew_note', args);
    const after = await listGrinders(db.driver);
    const replay = await call('update_brew_note', args);
    expect(replay.replayed).toBe(true);
    expect(replay.note.id).toBe(first.note.id);
    expect(await listGrinders(db.driver)).toEqual(after);
    expect(await balance()).toBe(90);
  });
  it('metadata-only edits, explicit optout and missing grinder grant never change grinder history', async () => {
    let result = await create({ grindSize: 'TestMill · 20' });
    const before = await listGrinders(db.driver);
    result = await update(result.note, { rating: 4 });
    expect(await listGrinders(db.driver)).toEqual(before);
    await update(
      result.note,
      { grindSize: 'TestMill · 25' },
      { syncGrinder: false }
    );
    expect(await listGrinders(db.driver)).toEqual(before);
    await create({ grindSize: 'TestMill · 26' }, {}, limited);
    expect(await listGrinders(db.driver)).toEqual(before);
  });
  it('rolls back note, inventory and grinder when settings are read-only', async () => {
    const before = await listGrinders(db.driver);
    await expect(
      create(
        { grindSize: 'TestMill · 24' },
        {},
        {
          scopes: { beans: 'edit', notes: 'edit', settings: 'read' },
        }
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(await balance()).toBe(100);
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
    expect(await listGrinders(db.driver)).toEqual(before);
    expect(await db.driver.query('SELECT * FROM mcp_operations')).toHaveLength(
      0
    );
  });
  it('requires bean read access before revealing linked inventory in a deletion preview', async () => {
    const result = await create();
    await expect(
      call(
        'preview_delete',
        { entity: 'brew_note', id: result.note.id },
        {
          scopes: { notes: 'read' },
        }
      )
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(
      call(
        'preview_delete',
        { entity: 'brew_note', id: result.note.id },
        {
          scopes: { notes: 'read', beans: 'read' },
        }
      )
    ).resolves.toHaveProperty('impact.inventoryRestoration');
  });
  it('revalidates durable response scopes on replay without repeating stock or grinder changes', async () => {
    const id = requestId();
    const note = { grindSize: 'TestMill · 24' };
    const original = await create(note, { requestId: id });
    await db.driver.execute('DELETE FROM mcp_activity');
    await expect(
      create(note, { requestId: id }, limited)
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    const replay = await create(
      note,
      { requestId: id },
      {
        scopes: {
          beans: 'edit',
          notes: 'edit',
          brewing: 'edit',
          settings: 'read',
        },
      }
    );
    expect(replay.replayed).toBe(true);
    expect(replay.note.id).toBe(original.note.id);
    expect(await balance()).toBe(90);
    expect(await listBrewingNotes(db.driver)).toHaveLength(1);
    await db.driver.execute(
      'UPDATE mcp_operations SET result_domains_json = NULL WHERE request_id = ?',
      [id]
    );
    await expect(create(note, { requestId: id })).rejects.toMatchObject({
      code: 'PERMISSION_DENIED',
    });
    expect(await balance()).toBe(90);
  });
  it('does not populate a new live bean snapshot without bean read access even at zero dose', async () => {
    await expect(
      create({ coffeeGrams: 0 }, {}, { scopes: { notes: 'edit' } })
    ).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
    expect(await balance()).toBe(100);
  });
  it('filters grinder activity snapshots after grinder grant revocation while retaining note changes', async () => {
    const id = requestId();
    await create({ grindSize: 'TestMill · 20' }, { requestId: id });
    const all = await call('list_mcp_activity', {});
    expect(
      all.items
        .find(row => row.requestId === id)
        ?.changes.some(change => change.entity === 'grinder')
    ).toBe(true);
    const filtered = await call('list_mcp_activity', {}, limited);
    const changes = filtered.items.find(row => row.requestId === id)!.changes;
    expect(changes.some(change => change.entity === 'grinder')).toBe(false);
    expect(changes.some(change => change.entity === 'brew_note')).toBe(true);
  });
  it('refreshes grinder context for explicit method-reference changes without resubmitting grind or changing inventory', async () => {
    let result = await create({ grindSize: 'TestMill · 20' });
    result = await update(result.note, { methodId: 'preset:V60:single-pour' });
    const grinder = (await listGrinders(db.driver))[0];
    expect(grinder.grindSizeHistory).toHaveLength(1);
    expect(grinder.grindSizeHistory?.[0]).toMatchObject({
      grindSize: '20',
      equipment: 'V60',
      method: '一刀流',
      coffeeBeanName: 'Original bean',
    });
    expect((await stored(result)).params?.grindSize).toBe('TestMill 20');
    expect(await balance()).toBe(90);
  });
});
