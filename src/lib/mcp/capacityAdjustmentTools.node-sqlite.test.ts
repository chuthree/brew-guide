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
  saveBrewingNote,
} from '@/lib/data/sqlite/repositories/brewingNote';
import { buildCapacityAdjustmentRecord } from '@/lib/coffee-beans/inventoryRecords';
import { recordVersion, validate } from './validation';
import {
  capacityAdjustmentDefinitions,
  mutateCapacityAdjustmentTool,
} from './capacityAdjustmentTools';

describe('Capacity adjustment corrections (real SQLite)', () => {
  let db: NodeSqliteTestDatabase;
  let id: string;
  const edit = 'update_brew_note_capacity_adjustment';
  const convert = 'convert_capacity_adjustment_to_brew_note';
  beforeEach(async () => {
    db = await createNodeSqliteTestDatabase();
    const bean = {
      id: 'a',
      name: 'A',
      timestamp: 1,
      beanState: 'roasted' as const,
      capacity: '100',
      remaining: '60',
    };
    await saveCoffeeBean(db.driver, bean);
    await saveCoffeeBean(db.driver, {
      ...bean,
      id: 'b',
      name: 'B',
      remaining: '50',
    });
    const note = buildCapacityAdjustmentRecord(bean, 80, 60, 1);
    id = 'adjustment';
    await saveBrewingNote(db.driver, { ...note, id });
    await db.driver.execute(
      "INSERT INTO brewing_note_images(image_id,note_id,position,variant,source_kind,external_url) VALUES ('photo',?,0,'original','external','https://example.test/photo')",
      [id]
    );
  });
  afterEach(async () => {
    await db.close();
  });
  const balance = async (beanId = 'a') =>
    Number((await getCoffeeBean(db.driver, beanId))?.remaining);
  async function mutate(name: string, extra: Record<string, unknown> = {}) {
    const target = extra.beanId === undefined ? 'a' : extra.beanId;
    const args = {
      requestId: 'capacity-edit-request',
      id,
      expectedVersion: await recordVersion(await getBrewingNote(db.driver, id)),
      ...(target
        ? {
            targetExpectedVersion: await recordVersion(
              await getCoffeeBean(db.driver, String(target))
            ),
          }
        : {}),
      ...extra,
    };
    validate(
      args,
      capacityAdjustmentDefinitions.find(t => t.name === name)!.schema
    );
    return db.driver.transaction(tx =>
      mutateCapacityAdjustmentTool(tx, name, args)
    );
  }
  it('corrects signed effect on current inventory without overwriting later consumption', async () => {
    const bean = (await getCoffeeBean(db.driver, 'a'))!;
    await saveCoffeeBean(db.driver, { ...bean, remaining: '45' });
    await mutate(edit, { changeGrams: -10 });
    expect(await balance()).toBe(55);
    expect(await getBrewingNote(db.driver, id)).toMatchObject({
      id,
      source: 'capacity-adjustment',
      notes: '容量调整(不计入统计)',
      params: { coffee: '10g' },
      changeRecord: {
        capacityAdjustment: {
          originalAmount: 80,
          newAmount: 70,
          changeAmount: -10,
          changeType: 'decrease',
        },
      },
    });
  });
  it('reverses an increase adjustment against current stock rather than restoring its old balance', async () => {
    const bean = (await getCoffeeBean(db.driver, 'a'))!;
    await saveCoffeeBean(db.driver, { ...bean, remaining: '45' });
    await saveBrewingNote(db.driver, {
      ...buildCapacityAdjustmentRecord(bean, 40, 60, 1),
      id,
    });
    await mutate(convert, { coffeeGrams: 12 });
    expect(await balance()).toBe(13); // current45 - priorincrease20 - brew12
  });
  it('relinks by restoring old signed effect and applying new signed effect once', async () => {
    await mutate(edit, { beanId: 'b', changeGrams: 15 });
    expect(await balance()).toBe(80);
    expect(await balance('b')).toBe(65);
    expect(await getBrewingNote(db.driver, id)).toMatchObject({
      beanId: 'b',
      coffeeBeanInfo: { name: 'B' },
      changeRecord: { capacityAdjustment: { changeType: 'increase' } },
    });
  });
  it('converts with inverse adjustment plus brew debit, retaining ID and photos', async () => {
    const before = (await getBrewingNote(db.driver, id))!;
    await mutate(convert, { coffeeGrams: 12, notes: '手冲' });
    expect(await balance()).toBe(68);
    const after = (await getBrewingNote(db.driver, id))!;
    expect(after.id).toBe(id);
    expect(after.source).toBeUndefined();
    expect(after.changeRecord).toBeUndefined();
    expect(after.params?.coffee).toBe('12g');
    expect(after.notes).toBe('手冲');
    expect(after.images).toEqual(before.images);
    expect(
      await db.driver.query(
        'SELECT image_id FROM brewing_note_images WHERE note_id=?',
        [id]
      )
    ).toEqual([{ image_id: 'photo' }]);
  });
  it('converts and relinks to another bean', async () => {
    await mutate(convert, { beanId: 'b', coffeeGrams: 12 });
    expect(await balance()).toBe(80);
    expect(await balance('b')).toBe(38);
  });
  it('explicit unlink restores old stock without consuming an unrelated bean', async () => {
    await mutate(convert, { beanId: '', coffeeGrams: 12 });
    expect(await balance()).toBe(80);
    expect(await balance('b')).toBe(50);
    expect((await getBrewingNote(db.driver, id))?.beanId).toBeUndefined();
  });
  it('rejects conversion whose intermediate reversal would clip even if net stock fits', async () => {
    const bean = (await getCoffeeBean(db.driver, 'a'))!;
    await saveCoffeeBean(db.driver, { ...bean, remaining: '90' });
    await expect(mutate(convert, { coffeeGrams: 15 })).rejects.toThrow();
    expect(await balance()).toBe(90);
    expect((await getBrewingNote(db.driver, id))?.source).toBe(
      'capacity-adjustment'
    );
  });
  it('does not coerce malformed existing inventory to zero', async () => {
    const bean = (await getCoffeeBean(db.driver, 'a'))!;
    await saveCoffeeBean(db.driver, { ...bean, remaining: 'unknown' });
    const before = await getBrewingNote(db.driver, id);
    await expect(mutate(edit, { changeGrams: -5 })).rejects.toThrow();
    expect((await getCoffeeBean(db.driver, 'a'))?.remaining).toBe('unknown');
    expect(await getBrewingNote(db.driver, id)).toEqual(before);
  });
  it('rejects stale note and target stock versions without changing anything', async () => {
    const before = await getBrewingNote(db.driver, id);
    await expect(
      mutate(edit, { changeGrams: -5, expectedVersion: 'f'.repeat(64) })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      mutate(edit, { changeGrams: -5, targetExpectedVersion: 'f'.repeat(64) })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await balance()).toBe(60);
    expect(await getBrewingNote(db.driver, id)).toEqual(before);
  });
  it('validates all stocks before mutation and rolls back failed cross-bean edits', async () => {
    const before = await getBrewingNote(db.driver, id);
    await expect(
      mutate(edit, { beanId: 'b', changeGrams: -70 })
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_INVENTORY' });
    await expect(
      mutate(edit, { beanId: 'b', changeGrams: 60 })
    ).rejects.toThrow();
    expect(await balance()).toBe(60);
    expect(await balance('b')).toBe(50);
    expect(await getBrewingNote(db.driver, id)).toEqual(before);
  });
  it('rejects wrong record types and green bean brew conversion', async () => {
    const bean = (await getCoffeeBean(db.driver, 'b'))!;
    await saveCoffeeBean(db.driver, { ...bean, beanState: 'green' });
    await expect(
      mutate(convert, { beanId: 'b', coffeeGrams: 10 })
    ).rejects.toThrow();
    expect(await balance()).toBe(60);
    const note = (await getBrewingNote(db.driver, id))!;
    await saveBrewingNote(db.driver, { ...note, source: 'quick-decrement' });
    await expect(mutate(edit, { changeGrams: 1 })).rejects.toThrow();
    expect(await balance()).toBe(60);
  });
  it('rejects submilligram edits, supports zero correction and updates date', async () => {
    await expect(mutate(edit, { changeGrams: 0.0001 })).rejects.toThrow();
    await mutate(edit, {
      changeGrams: 0,
      brewedAt: '2026-10-22T00:30:00+08:00',
    });
    expect(await balance()).toBe(80);
    expect(await getBrewingNote(db.driver, id)).toMatchObject({
      timestamp: Date.parse('2026-10-22T00:30:00+08:00'),
      changeRecord: { capacityAdjustment: { changeType: 'set' } },
    });
  });
});
