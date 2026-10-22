import {
  getNoteEspressoParamParts,
  getNoteEspressoMeasurements,
} from '@/lib/notes/noteDisplay';
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
const full: McpPermissions = {
  allowWrite: true,
  allowDelete: true,
  grantedDomains: ['beans', 'notes', 'brewing'],
};
type View = {
  id: string;
  version: string;
  extractionTimeSeconds: number | null;
  liquidWeightGrams: number | null;
};
type Result = { note: View; replayed?: boolean };
let db: NodeSqliteTestDatabase;
let seq = 0;
const requestId = () => `espresso-params-${++seq}`;
const call = async (name: string, args: Record<string, unknown>) =>
  (await executeMcpTool(name, args, full)) as Result;
const fields = {
  recordType: 'brew',
  beanId: 'bean',
  coffeeGrams: 18,
  equipmentId: 'Espresso',
  method: '意式',
  extractionTimeSeconds: 25,
  liquidWeightGrams: 36,
};
const create = (extra: Record<string, unknown> = {}) =>
  call('create_brew_note', {
    requestId: requestId(),
    note: { ...fields, ...extra },
  });
const edit = (view: View, changes: Record<string, unknown>) =>
  call('update_brew_note', {
    requestId: requestId(),
    id: view.id,
    expectedVersion: view.version,
    changes,
  });
const stored = async (result: Result) =>
  (await getBrewingNote(db.driver, result.note.id))!;
const balance = async () =>
  Number((await getCoffeeBean(db.driver, 'bean'))!.remaining);
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  native.driver = db.driver;
  await saveCoffeeBean(db.driver, {
    id: 'bean',
    timestamp: 1000,
    name: 'Synthetic espresso bean',
    capacity: '100',
    remaining: '100',
    beanState: 'roasted',
    roastLevel: '深度烘焙',
  });
});
afterEach(async () => {
  native.driver = undefined;
  await db.close();
});

describe('MCP measured espresso parameters (real SQLite)', () => {
  it('creates18g/25s/36g without confusing output yield with input water or total brew time', async () => {
    const result = await create();
    const note = await stored(result);
    expect(note.params).toMatchObject({
      coffee: '18g',
      extractionTime: 25,
      liquidWeight: '36g',
    });
    for (const key of ['water', 'temp', 'ratio', 'grindSize'] as const)
      expect(note.params?.[key] ?? '').toBe('');
    expect(note.totalTime ?? 0).toBe(0);
    expect(note).toMatchObject({
      equipmentId: 'Espresso',
      method: '意式',
      methodName: '意式',
      methodId: null,
      notes: '',
    });
    expect(await call('get_brew_note', { id: note.id })).toMatchObject({
      note: { extractionTimeSeconds: 25, liquidWeightGrams: 36 },
    });
    expect(await balance()).toBe(82);
  });
  it('preserves omitted measurements on metadata edit and edits yield/time without debiting coffee again', async () => {
    let result = await create();
    result = await edit(result.note, { notes: 'Balanced cup' });
    expect((await stored(result)).params).toMatchObject({
      extractionTime: 25,
      liquidWeight: '36g',
    });
    result = await edit(result.note, {
      extractionTimeSeconds: 27.5,
      liquidWeightGrams: 37.25,
    });
    expect((await stored(result)).params).toMatchObject({
      coffee: '18g',
      extractionTime: 27.5,
      liquidWeight: '37.25g',
    });
    expect(result.note).toMatchObject({
      extractionTimeSeconds: 27.5,
      liquidWeightGrams: 37.25,
    });
    expect(await balance()).toBe(82);
  });
  it('explicit null removes each parameter and missing values read as null', async () => {
    let result = await create();
    result = await edit(result.note, { extractionTimeSeconds: null });
    let note = await stored(result);
    expect(Object.hasOwn(note.params!, 'extractionTime')).toBe(false);
    expect(note.params?.liquidWeight).toBe('36g');
    result = await edit(result.note, { liquidWeightGrams: null });
    note = await stored(result);
    expect(Object.hasOwn(note.params!, 'liquidWeight')).toBe(false);
    expect(await call('get_brew_note', { id: note.id })).toMatchObject({
      note: { extractionTimeSeconds: null, liquidWeightGrams: null },
    });
    expect(await balance()).toBe(82);
  });
  it.each([-1, Infinity, -Infinity, NaN, '25'])(
    'rejects invalid measurement %s atomically on create and edit',
    async value => {
      for (const key of ['extractionTimeSeconds', 'liquidWeightGrams'])
        await expect(create({ [key]: value })).rejects.toMatchObject({
          code: 'INVALID_ARGUMENT',
        });
      expect(await balance()).toBe(100);
      expect(await listBrewingNotes(db.driver)).toHaveLength(0);
      const initial = await create();
      const before = await stored(initial);
      for (const key of ['extractionTimeSeconds', 'liquidWeightGrams'])
        await expect(
          edit(initial.note, { [key]: value })
        ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
      expect(await stored(initial)).toEqual(before);
      expect(await balance()).toBe(82);
    }
  );
  it('replays the same request without creating a second note or debit', async () => {
    const args = { requestId: requestId(), note: fields };
    const first = await call('create_brew_note', args);
    const replay = await call('create_brew_note', args);
    expect(replay.note.id).toBe(first.note.id);
    expect(replay.replayed).toBe(true);
    expect(await listBrewingNotes(db.driver)).toHaveLength(1);
    expect(await balance()).toBe(82);
  });
  it('rejects explicit inventory-only measurements but clears previous measurements on conversion', async () => {
    for (const measurement of [
      { extractionTimeSeconds: 25 },
      { liquidWeightGrams: 36 },
    ])
      await expect(
        call('create_brew_note', {
          requestId: requestId(),
          note: {
            beanId: 'bean',
            coffeeGrams: 18,
            recordType: 'quick-decrement',
            ...measurement,
          },
        })
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await balance()).toBe(100);
    const initial = await create();
    const converted = await edit(initial.note, {
      recordType: 'quick-decrement',
    });
    await edit(converted.note, {
      extractionTimeSeconds: null,
      liquidWeightGrams: null,
    });
    const note = await stored(converted);
    expect(note.source).toBe('quick-decrement');
    expect(Object.hasOwn(note.params!, 'extractionTime')).toBe(false);
    expect(Object.hasOwn(note.params!, 'liquidWeight')).toBe(false);
    expect(await balance()).toBe(82);
  });
  it('measured extraction details alone distinguish a brew from automatic inventory-only deduction', async () => {
    const result = await call('create_brew_note', {
      requestId: requestId(),
      note: {
        beanId: 'bean',
        coffeeGrams: 18,
        extractionTimeSeconds: 25,
        liquidWeightGrams: 36,
      },
    });
    expect((await stored(result)).source).not.toBe('quick-decrement');
    expect(result.note).toMatchObject({
      extractionTimeSeconds: 25,
      liquidWeightGrams: 36,
    });
    expect(await balance()).toBe(82);
  });
  it('corrects the stable recipe reference while preserving MCP-to-SQLite-to-display measurements', async () => {
    const initial = await create();
    expect((await stored(initial)).methodId).toBeNull();
    const corrected = await edit(initial.note, {
      methodId: 'preset:Espresso:espresso',
    });
    expect(corrected.note.id).toBe(initial.note.id);
    expect(await listBrewingNotes(db.driver)).toHaveLength(1);
    expect(await balance()).toBe(82);
    const persisted = await stored(corrected);
    expect(persisted).toMatchObject({
      equipmentId: 'Espresso',
      methodId: 'preset:Espresso:espresso',
      methodName: '浓缩',
    });
    expect(persisted.params).toMatchObject({
      coffee: '18g',
      extractionTime: 25,
      liquidWeight: '36g',
    });
    for (const key of ['water', 'temp', 'ratio', 'grindSize'] as const)
      expect(persisted.params?.[key] ?? '').toBe('');
    expect(persisted.totalTime ?? 0).toBe(0);
    expect(getNoteEspressoMeasurements(persisted)).toEqual({
      extractionTime: 25,
      liquidWeight: '36g',
    });
    expect(getNoteEspressoParamParts(persisted)).toEqual(['18g', '25s', '36g']);
  });
});
