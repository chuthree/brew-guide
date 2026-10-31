import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
  saveBrewingNote,
} from '@/lib/data/sqlite/repositories/brewingNote';
import type { CoffeeBean } from '@/types/app';
import { recordVersion, validate } from './validation';
import {
  mutateRoastingTool,
  readRoastingTool,
  roastingDefinitions,
} from './roastingTools';

type Args = Record<string, unknown>;
type View = { id: string; version: string };
describe('MCP roasting canonical lifecycle (real SQLite)', () => {
  let db: NodeSqliteTestDatabase;
  const green = (id = 'green-a'): CoffeeBean => ({
    id,
    name: id,
    timestamp: 1,
    beanState: 'green',
    capacity: '500',
    remaining: '500',
  });
  beforeEach(async () => {
    db = await createNodeSqliteTestDatabase();
    await saveCoffeeBean(db.driver, green());
    await saveCoffeeBean(db.driver, green('green-b'));
  });
  afterEach(async () => {
    await db.close();
  });
  const version = async (id: string) =>
    recordVersion(await getCoffeeBean(db.driver, id));
  const balance = async (id: string) =>
    Number((await getCoffeeBean(db.driver, id))?.remaining);
  async function mutate(name: string, args: Args) {
    const input = Object.fromEntries(
      Object.entries({ requestId: 'roasting-test-request', ...args }).filter(
        ([, value]) => value !== undefined
      )
    );
    validate(input, roastingDefinitions.find(d => d.name === name)!.schema);
    return db.driver.transaction(tx => mutateRoastingTool(tx, name, input));
  }
  async function roast(extra: Args = {}) {
    const result = await mutate('create_roasting_record', {
      greenBeanId: 'green-a',
      greenExpectedVersion: await version('green-a'),
      roastedAmountGrams: 100,
      roastedBean: { capacityGrams: 80 },
      ...extra,
    });
    return result.result as {
      note: View;
      roastedBean: View;
      usedNote: View | null;
    };
  }
  async function remove(id: string) {
    const p = await readRoastingTool(
      db.driver,
      'preview_delete_roasting_record',
      { id }
    );
    return mutate('delete_roasting_record', {
      id,
      expectedVersion: p.version,
      confirmationToken: p.confirmationToken,
    });
  }
  it('rejects cancelling roasting after output consumption without changing inventory', async () => {
    const { note, roastedBean } = await roast();
    expect(await balance('green-a')).toBe(400);
    const output = await getCoffeeBean(db.driver, roastedBean.id);
    expect(output).toMatchObject({
      capacity: '80',
      remaining: '80',
      sourceGreenBeanId: 'green-a',
      beanState: 'roasted',
    });
    expect(await getBrewingNote(db.driver, note.id)).toMatchObject({
      source: 'roasting',
      notes: '烘焙了 100g 生豆 → green-a',
      changeRecord: {
        roastingRecord: { roastedAmount: 100, roastedBeanId: roastedBean.id },
      },
    });
    await saveCoffeeBean(db.driver, { ...output!, remaining: '65' });
    await expect(remove(note.id)).rejects.toThrow('暂时无法撤销');
    expect(await balance('green-a')).toBe(400);
    expect(await getCoffeeBean(db.driver, roastedBean.id)).toMatchObject({
      remaining: '65',
    });
    expect(
      (await getCoffeeBean(db.driver, roastedBean.id))?.sourceGreenBeanId
    ).toBe('green-a');
    expect(await getBrewingNote(db.driver, note.id)).toBeDefined();
  });
  it('records initial output use with app prose and does not debit twice', async () => {
    const r = await roast({
      roastedBean: { capacityGrams: 80, remainingGrams: 60 },
    });
    expect(await balance(r.roastedBean.id)).toBe(60);
    expect(await getBrewingNote(db.driver, r.usedNote!.id)).toMatchObject({
      source: 'quick-decrement',
      quickDecrementAmount: 20,
      notes: '烘焙时已使用',
    });
    await expect(remove(r.note.id)).rejects.toThrow('已有冲煮或用量记录');
    expect(await getBrewingNote(db.driver, r.usedNote!.id)).toBeDefined();
  });
  it('edits amount and switches green source without resetting roasted stock', async () => {
    const r = await roast();
    const edited = await mutate('update_roasting_record', {
      id: r.note.id,
      expectedVersion: r.note.version,
      greenExpectedVersion: await version('green-a'),
      roastedAmountGrams: 120,
    });
    expect(await balance('green-a')).toBe(380);
    await mutate('update_roasting_record', {
      id: r.note.id,
      expectedVersion: (edited.result.note as View).version,
      greenBeanId: 'green-b',
      greenExpectedVersion: await version('green-b'),
      roastedAmountGrams: 110,
    });
    expect(await balance('green-a')).toBe(500);
    expect(await balance('green-b')).toBe(390);
    expect(await getCoffeeBean(db.driver, r.roastedBean.id)).toMatchObject({
      capacity: '80',
      remaining: '80',
      sourceGreenBeanId: 'green-b',
    });
    await remove(r.note.id);
    expect(await balance('green-b')).toBe(500);
  });
  it('rejects changed linked inventory after delete preview', async () => {
    const r = await roast();
    const p = await readRoastingTool(
      db.driver,
      'preview_delete_roasting_record',
      { id: r.note.id }
    );
    const output = await getCoffeeBean(db.driver, r.roastedBean.id);
    await saveCoffeeBean(db.driver, { ...output!, remaining: '79' });
    await expect(
      mutate('delete_roasting_record', {
        id: r.note.id,
        expectedVersion: p.version,
        confirmationToken: p.confirmationToken,
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await balance('green-a')).toBe(400);
  });
  it('validates yield/stock before any mutation and rejects stale source versions', async () => {
    await expect(
      roast({ roastedBean: { capacityGrams: 101 } })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await expect(roast({ roastedAmountGrams: 501 })).rejects.toMatchObject({
      code: 'INSUFFICIENT_INVENTORY',
    });
    await expect(
      roast({ greenExpectedVersion: '0'.repeat(64) })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await balance('green-a')).toBe(500);
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
  });
  it('rejects an over-capacity refund and refunds source-only roasting exactly', async () => {
    const r = await roast({ createRoastedBean: false, roastedBean: undefined });
    expect(r.roastedBean).toBeNull();
    await saveCoffeeBean(db.driver, { ...green(), remaining: '470' });
    await expect(remove(r.note.id)).rejects.toThrow('超过生豆总量');
    expect(await balance('green-a')).toBe(470);
    await saveCoffeeBean(db.driver, { ...green(), remaining: '400' });
    await remove(r.note.id);
    expect(await balance('green-a')).toBe(500);
  });
  it('rolls all inventory writes back if the enclosing transaction fails', async () => {
    const expected = await version('green-a');
    await expect(
      db.driver.transaction(async tx => {
        await mutateRoastingTool(tx, 'create_roasting_record', {
          greenBeanId: 'green-a',
          greenExpectedVersion: expected,
          roastedAmountGrams: 100,
        });
        throw new Error('simulated commit boundary failure');
      })
    ).rejects.toThrow('simulated commit boundary failure');
    expect(await balance('green-a')).toBe(500);
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
  });
  it('rejects subprecision amounts instead of introducing inverse drift', async () => {
    await expect(roast({ roastedAmountGrams: 100.0001 })).rejects.toMatchObject(
      { code: 'INVALID_ARGUMENT' }
    );
    await expect(
      roast({ roastedBean: { capacityGrams: 80, remainingGrams: 79.9999 } })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await balance('green-a')).toBe(500);
  });
  it('keeps an explicitly offset roasting date in its supplied calendar day', async () => {
    const r = await roast({ timestamp: '2026-10-22T00:30:00+08:00' });
    expect((await getCoffeeBean(db.driver, r.roastedBean.id))?.roastDate).toBe(
      '2026-10-22'
    );
  });
  it('does not overwrite externally changed derived provenance during a source switch', async () => {
    const r = await roast();
    const output = await getCoffeeBean(db.driver, r.roastedBean.id);
    await saveCoffeeBean(db.driver, {
      ...output!,
      sourceGreenBeanId: undefined,
    });
    await expect(
      mutate('update_roasting_record', {
        id: r.note.id,
        expectedVersion: r.note.version,
        greenExpectedVersion: await version('green-b'),
        greenBeanId: 'green-b',
      })
    ).rejects.toThrow('来源已变化');
    expect(await balance('green-a')).toBe(400);
    expect(await balance('green-b')).toBe(500);
  });
  it('lists paginated records and rejects ordinary notes', async () => {
    await roast();
    await roast();
    const page = await readRoastingTool(db.driver, 'list_roasting_records', {
      greenBeanId: 'green-a',
      offset: 1,
      limit: 1,
    });
    expect(page.total).toBe(2);
    expect(page.items).toHaveLength(1);
    await saveBrewingNote(db.driver, {
      id: 'ordinary',
      timestamp: 1,
      notes: '',
      rating: 0,
      taste: {},
    });
    await expect(
      readRoastingTool(db.driver, 'get_roasting_record', { id: 'ordinary' })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
