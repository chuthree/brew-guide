import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import type { BrewingNote } from '@/lib/core/config';
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
const notesOnly: McpPermissions = {
  allowWrite: true,
  allowDelete: true,
  grantedDomains: ['beans', 'notes'],
};
type View = { id: string; version: string; name: string; referenceId?: string };
type Result = {
  note: View;
  equipment: View;
  method: View;
  items: View[];
  version: string;
  confirmationToken: string;
};
let seq = 0;
const requestId = () => `note-reference-${++seq}`;
const call = async (
  name: string,
  args: Record<string, unknown>,
  permissions = full
) => (await executeMcpTool(name, args, permissions)) as Result;
let db: NodeSqliteTestDatabase;
const create = (note: Record<string, unknown>, permissions = full) =>
  call(
    'create_brew_note',
    {
      requestId: requestId(),
      note: { recordType: 'brew', beanId: 'bean', coffeeGrams: 10, ...note },
    },
    permissions
  );
const stored = async (result: Result) =>
  (await getBrewingNote(db.driver, result.note.id))!;
const balance = async () =>
  Number((await getCoffeeBean(db.driver, 'bean'))!.remaining);
const noDefaults = (note: BrewingNote) => {
  expect(note.params?.coffee).toBe('10g');
  for (const key of ['water', 'temp', 'ratio', 'grindSize'] as const)
    expect(note.params?.[key] ?? '').toBe('');
  expect(note.totalTime ?? 0).toBe(0);
};
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  native.driver = db.driver;
  await saveCoffeeBean(db.driver, {
    id: 'bean',
    timestamp: 1000,
    name: 'Synthetic bean',
    capacity: '100',
    remaining: '100',
    beanState: 'roasted',
    roastLevel: '中度烘焙',
  });
});
afterEach(async () => {
  native.driver = undefined;
  await db.close();
});

describe('MCP note catalog identities and historical snapshots (real SQLite)', () => {
  it('infers only scoped unambiguous identities without filling a recipe', async () => {
    const note = await stored(
      await create({ equipment: 'v60', method: '三段式' })
    );
    expect(note).toMatchObject({
      equipment: 'V60',
      equipmentId: 'V60',
      equipmentName: 'V60',
      method: '三段式',
      methodId: 'preset:V60:three-stage',
      methodName: '三段式',
      notes: '',
    });
    noDefaults(note);
    expect(await balance()).toBe(90);
  });
  it('keeps unsupported OREA method text clean and unlinked without creating catalog entries', async () => {
    const before = await call('list_method', { equipmentId: 'Orea' });
    const note = await stored(
      await create({ equipment: 'orea', method: '三段式' })
    );
    expect(note).toMatchObject({
      equipment: 'Orea',
      equipmentId: 'Orea',
      equipmentName: 'OREA',
      method: '三段式',
      methodId: null,
      methodName: '三段式',
    });
    noDefaults(note);
    expect(await call('list_method', { equipmentId: 'Orea' })).toEqual(before);
  });
  it('exposes permanent preset references and accepts them without recipe defaults', async () => {
    const methods = await call('list_method', { equipmentId: 'V60' });
    expect(methods.items.find(m => m.name === '三段式')?.referenceId).toBe(
      'preset:V60:three-stage'
    );
    const note = await stored(
      await create({ equipmentId: 'V60', methodId: 'preset:V60:three-stage' })
    );
    expect(note.methodName).toBe('三段式');
    noDefaults(note);
  });
  it('preserves snapshots on unrelated edits after custom catalog rename and deletion', async () => {
    const eq = (
      await call('create_equipment', {
        requestId: requestId(),
        equipment: { name: 'Original cone', animationType: 'v60' },
      })
    ).equipment;
    const method = (
      await call('create_method', {
        requestId: requestId(),
        equipmentId: eq.id,
        method: {
          name: 'Original pours',
          params: {
            coffee: '20g',
            water: '300g',
            ratio: '1:15',
            temp: '93°C',
            grindSize: 'fine',
            stages: [],
          },
        },
      })
    ).method;
    let result = await create({ equipmentId: eq.id, methodId: method.id });
    const original = await stored(result);
    await call('update_equipment', {
      requestId: requestId(),
      id: eq.id,
      expectedVersion: eq.version,
      changes: { name: 'Renamed cone' },
    });
    await call('update_method', {
      requestId: requestId(),
      equipmentId: eq.id,
      id: method.id,
      expectedVersion: method.version,
      changes: { name: 'Renamed pours' },
    });
    result = await call('update_brew_note', {
      requestId: requestId(),
      id: result.note.id,
      expectedVersion: result.note.version,
      changes: { notes: 'Actual tasting note' },
    });
    expect(await stored(result)).toMatchObject({
      equipmentName: original.equipmentName,
      methodName: original.methodName,
      equipmentId: eq.id,
      methodId: method.id,
      params: original.params,
    });
    const preview = await call('preview_delete_equipment', { id: eq.id });
    await call('delete_equipment', {
      requestId: requestId(),
      id: eq.id,
      expectedVersion: preview.version,
      confirmationToken: preview.confirmationToken,
    });
    result = await call('update_brew_note', {
      requestId: requestId(),
      id: result.note.id,
      expectedVersion: result.note.version,
      changes: { notes: 'Later tasting note' },
    });
    expect(await stored(result)).toMatchObject({
      equipmentName: 'Original cone',
      methodName: 'Original pours',
      equipmentId: eq.id,
      methodId: method.id,
      params: original.params,
    });
    expect(await balance()).toBe(90);
  });
  it('rejects a method belonging to another equipment atomically', async () => {
    await expect(
      create({ equipmentId: 'Orea', methodId: 'preset:V60:three-stage' })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await balance()).toBe(100);
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
  });
  it('clears identity snapshots when an existing brew becomes an inventory-only record', async () => {
    const initial = await create({ equipment: 'V60', method: '三段式' });
    const result = await call('update_brew_note', {
      requestId: requestId(),
      id: initial.note.id,
      expectedVersion: initial.note.version,
      changes: { recordType: 'quick-decrement' },
    });
    const note = await stored(result);
    expect(note.source).toBe('quick-decrement');
    for (const key of [
      'equipmentId',
      'methodId',
      'equipmentName',
      'methodName',
    ])
      expect(Object.hasOwn(note, key)).toBe(false);
    expect(note.equipment).toBe('');
    expect(note.method).toBe('');
    expect(await balance()).toBe(90);
  });
  it('legacy scope preserves only supplied labels and never leaks catalog names', async () => {
    const note = await stored(
      await create({ equipment: 'orea', method: '三段式' }, notesOnly)
    );
    expect(note).toMatchObject({
      equipment: 'orea',
      equipmentName: 'orea',
      equipmentId: null,
      method: '三段式',
      methodName: '三段式',
      methodId: null,
    });
  });
  it('requires matching catalog scopes for explicit IDs before stock changes', async () => {
    for (const fields of [
      { equipmentId: 'V60' },
      { methodId: 'preset:V60:three-stage' },
    ])
      await expect(create(fields, notesOnly)).rejects.toMatchObject({
        code: 'PERMISSION_DENIED',
      });
    expect(await balance()).toBe(100);
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
  });
  it('explicit null opts out of matching and numeric references are rejected', async () => {
    const note = await stored(
      await create({
        equipment: 'V60',
        method: '三段式',
        equipmentId: null,
        methodId: null,
      })
    );
    expect(note).toMatchObject({
      equipmentName: 'V60',
      methodName: '三段式',
      equipmentId: null,
      methodId: null,
    });
    for (const fields of [{ equipmentId: 42 }, { methodId: 42 }])
      await expect(create(fields)).rejects.toMatchObject({
        code: 'INVALID_ARGUMENT',
      });
    expect(await balance()).toBe(90);
  });
});
