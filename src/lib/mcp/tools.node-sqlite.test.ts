import type { McpPermissions } from './types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { BrewingNote } from '@/lib/core/config';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';
import type { CoffeeBean } from '@/types/app';
import {
  createNodeSqliteTestDatabase,
  type NodeSqliteTestDatabase,
} from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  getCoffeeBean,
  listCoffeeBeans,
  saveCoffeeBean,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import {
  getBrewingNote,
  listBrewingNotes,
  saveBrewingNote,
} from '@/lib/data/sqlite/repositories/brewingNote';

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

type View = { id: string; version: string; source?: string; notes?: string };
type Result = {
  bean: View;
  note: View;
  adjustmentNote: View;
  replayed: boolean;
  confirmationToken: string;
  version: string;
  impact: Record<string, unknown>;
};
const permissions: McpPermissions = {
  allowWrite: true,
  allowDelete: true,
  grantedDomains: ['beans', 'notes'],
};
let sequence = 0;
const requestId = () => `mcp-test-operation-${++sequence}`;
const call = async (name: string, args: Record<string, unknown>) =>
  (await executeMcpTool(name, args, permissions)) as Result;
const bean = (id = 'bean-a', remaining = '100'): CoffeeBean => ({
  id,
  timestamp: 1000,
  name: `Fixture ${id}`,
  capacity: '100',
  remaining,
  beanState: 'roasted',
  roastLevel: '中度烘焙',
});

// Uses the actual SQLite schema, repositories and transaction/idempotency layer.
// Only the native driver-opening boundary is replaced; no user data is modified.
describe('MCP inventory lifecycle (real SQLite)', () => {
  let database: NodeSqliteTestDatabase;
  beforeEach(async () => {
    database = await createNodeSqliteTestDatabase();
    native.driver = database.driver;
    await saveCoffeeBean(database.driver, bean());
  });
  afterEach(async () => {
    native.driver = undefined;
    await database.close();
  });
  const currentBean = () => call('get_bean', { id: 'bean-a' });
  const remaining = async (id = 'bean-a') =>
    Number((await getCoffeeBean(native.driver!, id))?.remaining);
  const remove = async (id: string, entity = 'brew_note') => {
    const preview = await call('preview_delete', { entity, id });
    const args = {
      requestId: requestId(),
      id,
      expectedVersion: preview.version,
      confirmationToken: preview.confirmationToken,
    };
    return { result: await call(`delete_${entity}`, args), args, preview };
  };

  it('uses a change record for consumption-only input without appending MCP prose', async () => {
    const result = await call('create_brew_note', {
      requestId: requestId(),
      note: { beanId: 'bean-a', coffeeGrams: 15 },
    });
    expect(await getBrewingNote(database.driver, result.note.id)).toMatchObject(
      {
        source: 'quick-decrement',
        quickDecrementAmount: 15,
        notes: '',
        params: { coffee: '15g' },
      }
    );
    expect(await remaining()).toBe(85);
    await remove(result.note.id);
    expect(await remaining()).toBe(100);
  });

  it('supports explicit ordinary and quick record types and retains user prose verbatim', async () => {
    const ordinary = await call('create_brew_note', {
      requestId: requestId(),
      note: {
        beanId: 'bean-a',
        coffeeGrams: 10,
        recordType: 'brew',
        notes: '手冲记录',
      },
    });
    expect(
      (await getBrewingNote(database.driver, ordinary.note.id))?.source
    ).toBeUndefined();
    const quick = await call('create_brew_note', {
      requestId: requestId(),
      note: {
        beanId: 'bean-a',
        coffeeGrams: 5,
        recordType: 'quick-decrement',
        notes: '赠送朋友',
      },
    });
    expect(await getBrewingNote(database.driver, quick.note.id)).toMatchObject({
      source: 'quick-decrement',
      notes: '赠送朋友',
    });
    expect(await remaining()).toBe(85);
  });

  it('keeps ordinary create, dose edit, bean reassignment and delete inventory closed', async () => {
    await saveCoffeeBean(database.driver, bean('bean-b'));
    const created = await call('create_brew_note', {
      requestId: requestId(),
      note: { beanId: 'bean-a', coffeeGrams: 15, waterGrams: 225 },
    });
    expect(await remaining()).toBe(85);
    const edited = await call('update_brew_note', {
      requestId: requestId(),
      id: created.note.id,
      expectedVersion: created.note.version,
      changes: { coffeeGrams: 20 },
    });
    expect(await remaining()).toBe(80);
    await call('update_brew_note', {
      requestId: requestId(),
      id: edited.note.id,
      expectedVersion: edited.note.version,
      changes: { beanId: 'bean-b', coffeeGrams: 12 },
    });
    expect(await remaining()).toBe(100);
    expect(await remaining('bean-b')).toBe(88);
    await remove(created.note.id);
    expect(await remaining('bean-b')).toBe(100);
    expect(await listBrewingNotes(database.driver)).toEqual([]);
  });

  it('keeps quick-record editing and conversion to a brew note inventory-neutral except for dose changes', async () => {
    const created = await call('create_brew_note', {
      requestId: requestId(),
      note: { beanId: 'bean-a', coffeeGrams: 15 },
    });
    const edited = await call('update_brew_note', {
      requestId: requestId(),
      id: created.note.id,
      expectedVersion: created.note.version,
      changes: { coffeeGrams: 10 },
    });
    expect(await remaining()).toBe(90);
    expect(
      await getBrewingNote(database.driver, created.note.id)
    ).toMatchObject({ source: 'quick-decrement', quickDecrementAmount: 10 });
    const converted = await call('update_brew_note', {
      requestId: requestId(),
      id: edited.note.id,
      expectedVersion: edited.note.version,
      changes: { waterGrams: 150 },
    });
    const stored = await getBrewingNote(database.driver, converted.note.id);
    expect(stored?.source).toBeUndefined();
    expect(stored?.quickDecrementAmount).toBeUndefined();
    expect(await remaining()).toBe(90);
    await remove(converted.note.id);
    expect(await remaining()).toBe(100);
  });

  it('rejects contradictory quick-record brewing parameters before writing', async () => {
    await expect(
      call('create_brew_note', {
        requestId: requestId(),
        note: {
          beanId: 'bean-a',
          coffeeGrams: 10,
          recordType: 'quick-decrement',
          waterGrams: 150,
        },
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await remaining()).toBe(100);
    expect(await listBrewingNotes(database.driver)).toEqual([]);
  });

  it('does not deduct or restore twice when create and delete requests are retried', async () => {
    const args = {
      requestId: requestId(),
      note: { beanId: 'bean-a', coffeeGrams: 15, waterGrams: 225 },
    };
    const created = await call('create_brew_note', args);
    expect((await call('create_brew_note', args)).replayed).toBe(true);
    expect(await remaining()).toBe(85);
    const deleted = await remove(created.note.id);
    expect((await call('delete_brew_note', deleted.args)).replayed).toBe(true);
    expect(await remaining()).toBe(100);
    expect(
      await database.driver.query('SELECT * FROM mcp_activity')
    ).toHaveLength(2);
  });

  it('creates canonical initial capacity history and reverses its signed delta on deletion', async () => {
    const created = await call('create_bean', {
      requestId: requestId(),
      bean: { name: 'Partial bag', capacityGrams: 100, remainingGrams: 75 },
    });
    const notes = await listBrewingNotes(database.driver);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      source: 'capacity-adjustment',
      beanId: created.bean.id,
      notes: '容量调整(不计入统计)',
      changeRecord: {
        capacityAdjustment: {
          originalAmount: 100,
          newAmount: 75,
          changeAmount: -25,
        },
      },
    });
    await remove(notes[0].id);
    expect(await remaining(created.bean.id)).toBe(100);
  });

  it.each([-20, 20])(
    'reverses a capacity adjustment of %ig without attributing it to MCP',
    async delta => {
      await saveCoffeeBean(database.driver, bean('bean-a', '50'));
      const before = await currentBean();
      const changed = await call('adjust_bean_inventory', {
        requestId: requestId(),
        id: 'bean-a',
        expectedVersion: before.bean.version,
        deltaGrams: delta,
        recordType: 'capacity-adjustment',
        reason: 'MCP request reason must not be injected into app note',
      });
      const note = await getBrewingNote(
        database.driver,
        changed.adjustmentNote.id
      );
      expect(note?.notes).toBe('容量调整(不计入统计)');
      expect(await remaining()).toBe(50 + delta);
      const deleted = await remove(changed.adjustmentNote.id);
      expect(deleted.preview.impact.inventoryRestoration).toMatchObject({
        deltaGrams: -delta,
        resultingRemainingGrams: 50,
      });
      expect(await remaining()).toBe(50);
    }
  );

  it('uses quick-decrement for a negative inventory delta and reverses it once', async () => {
    const before = await currentBean();
    const changed = await call('adjust_bean_inventory', {
      requestId: requestId(),
      id: 'bean-a',
      expectedVersion: before.bean.version,
      deltaGrams: -12,
    });
    const notes = await listBrewingNotes(database.driver);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      source: 'quick-decrement',
      quickDecrementAmount: 12,
      notes: '',
    });
    expect(await remaining()).toBe(88);
    const deleted = await remove(notes[0].id);
    await call('delete_brew_note', deleted.args);
    expect(await remaining()).toBe(100);
    expect(changed.bean.id).toBe('bean-a');
  });

  it('matches app clamping when deleting an increase after the added inventory was consumed', async () => {
    await saveCoffeeBean(database.driver, bean('bean-a', '50'));
    const before = await currentBean();
    const changed = await call('adjust_bean_inventory', {
      requestId: requestId(),
      id: 'bean-a',
      expectedVersion: before.bean.version,
      deltaGrams: 20,
    });
    await call('create_brew_note', {
      requestId: requestId(),
      note: { beanId: 'bean-a', coffeeGrams: 65, waterGrams: 500 },
    });
    expect(await remaining()).toBe(5);
    const deleted = await remove(changed.adjustmentNote.id);
    expect(deleted.preview.impact.inventoryRestoration).toMatchObject({
      deltaGrams: -20,
      resultingRemainingGrams: 0,
    });
    expect(await remaining()).toBe(0);
  });

  it('rejects green-bean quick deduction atomically but accepts explicit inventory correction', async () => {
    await saveCoffeeBean(database.driver, {
      ...bean('bean-a'),
      beanState: 'green',
    });
    const before = await currentBean();
    await expect(
      call('adjust_bean_inventory', {
        requestId: requestId(),
        id: 'bean-a',
        expectedVersion: before.bean.version,
        deltaGrams: -10,
      })
    ).rejects.toMatchObject({ code: 'USE_APP' });
    expect(await remaining()).toBe(100);
    expect(await listBrewingNotes(database.driver)).toEqual([]);
    expect(await database.driver.query('SELECT * FROM mcp_operations')).toEqual(
      []
    );
    const corrected = await call('adjust_bean_inventory', {
      requestId: requestId(),
      id: 'bean-a',
      expectedVersion: before.bean.version,
      deltaGrams: -10,
      recordType: 'capacity-adjustment',
    });
    expect(await remaining()).toBe(90);
    await remove(corrected.adjustmentNote.id);
    expect(await remaining()).toBe(100);
  });

  it('records the persisted rounded adjustment delta so fractional correction deletion closes stock', async () => {
    const before = await currentBean();
    const corrected = await call('adjust_bean_inventory', {
      requestId: requestId(),
      id: 'bean-a',
      expectedVersion: before.bean.version,
      deltaGrams: -12.3456,
      recordType: 'capacity-adjustment',
    });
    const note = await getBrewingNote(
      database.driver,
      corrected.adjustmentNote.id
    );
    expect(await remaining()).toBe(87.654);
    expect(note?.changeRecord?.capacityAdjustment?.changeAmount).toBeCloseTo(
      -12.346,
      6
    );
    await remove(corrected.adjustmentNote.id);
    expect(await remaining()).toBe(100);
  });

  it('keeps fractional quick edits consistent with the persisted displayed dose', async () => {
    const created = await call('create_brew_note', {
      requestId: requestId(),
      note: { beanId: 'bean-a', coffeeGrams: 15 },
    });
    const edited = await call('update_brew_note', {
      requestId: requestId(),
      id: created.note.id,
      expectedVersion: created.note.version,
      changes: { coffeeGrams: 12.3456 },
    });
    const note = await getBrewingNote(database.driver, edited.note.id);
    expect(note?.quickDecrementAmount).toBe(12.346);
    expect(note?.params?.coffee).toBe('12.346g');
    expect(await remaining()).toBe(87.654);
    await remove(edited.note.id);
    expect(await remaining()).toBe(100);
  });

  it('rolls back the record and operation log if stock is insufficient', async () => {
    await expect(
      call('create_brew_note', {
        requestId: requestId(),
        note: { beanId: 'bean-a', coffeeGrams: 101, waterGrams: 500 },
      })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_INVENTORY' });
    expect(await remaining()).toBe(100);
    expect(await listBrewingNotes(database.driver)).toEqual([]);
    expect(await database.driver.query('SELECT * FROM mcp_operations')).toEqual(
      []
    );
    expect(await database.driver.query('SELECT * FROM mcp_activity')).toEqual(
      []
    );
  });

  it('rejects an outdated delete preview after linked inventory changes', async () => {
    const created = await call('create_brew_note', {
      requestId: requestId(),
      note: { beanId: 'bean-a', coffeeGrams: 15, waterGrams: 225 },
    });
    const preview = await call('preview_delete', {
      entity: 'brew_note',
      id: created.note.id,
    });
    await call('create_brew_note', {
      requestId: requestId(),
      note: { beanId: 'bean-a', coffeeGrams: 5, waterGrams: 75 },
    });
    await expect(
      call('delete_brew_note', {
        requestId: requestId(),
        id: created.note.id,
        expectedVersion: preview.version,
        confirmationToken: preview.confirmationToken,
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await remaining()).toBe(80);
    expect(await listBrewingNotes(database.driver)).toHaveLength(2);
  });

  it('rejects reused operation IDs with altered arguments without partial writes', async () => {
    const id = requestId();
    await call('create_brew_note', {
      requestId: id,
      note: { beanId: 'bean-a', coffeeGrams: 10, waterGrams: 150 },
    });
    await expect(
      call('create_brew_note', {
        requestId: id,
        note: { beanId: 'bean-a', coffeeGrams: 20, waterGrams: 150 },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect(await remaining()).toBe(90);
    expect(await listBrewingNotes(database.driver)).toHaveLength(1);
    expect(await listCoffeeBeans(database.driver)).toHaveLength(1);
  });
  it.runIf(Boolean(process.env.MCP_TEST_DATA_PATH))(
    'runs a closed create/edit/delete cycle on an isolated copy of the provided export',
    async () => {
      const path = process.env.MCP_TEST_DATA_PATH!;
      const original = await readFile(path);
      const hash = createHash('sha256').update(original).digest('hex');
      const data = JSON.parse(original.toString('utf8')).data as {
        coffeeBeans: CoffeeBean[];
        brewingNotes: BrewingNote[];
      };
      for (const record of data.coffeeBeans)
        await saveCoffeeBean(
          database.driver,
          stripCoffeeBeanImages(structuredClone(record))
        );
      for (const record of data.brewingNotes)
        await saveBrewingNote(
          database.driver,
          stripBrewingNoteImages(structuredClone(record))
        );
      const candidate = data.coffeeBeans.find(
        record =>
          record.beanState !== 'green' &&
          Number.parseFloat(record.remaining ?? '') >= 2
      );
      expect(candidate).toBeDefined();
      const id = candidate!.id;
      const baseline = Number.parseFloat(candidate!.remaining!);
      const count = (await listBrewingNotes(database.driver)).length;
      const created = await call('create_brew_note', {
        requestId: requestId(),
        note: { beanId: id, coffeeGrams: 1 },
      });
      expect(await remaining(id)).toBeCloseTo(baseline - 1, 3);
      const edited = await call('update_brew_note', {
        requestId: requestId(),
        id: created.note.id,
        expectedVersion: created.note.version,
        changes: { coffeeGrams: 2 },
      });
      expect(await remaining(id)).toBeCloseTo(baseline - 2, 3);
      await remove(edited.note.id);
      expect(await remaining(id)).toBeCloseTo(baseline, 3);
      expect(await listBrewingNotes(database.driver)).toHaveLength(count);
      expect(
        createHash('sha256')
          .update(await readFile(path))
          .digest('hex')
      ).toBe(hash);
    }
  );
});
