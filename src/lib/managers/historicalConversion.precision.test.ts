import 'fake-indexeddb/auto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/lib/core/db';
import { bindDexieRepositories } from '@/lib/data/dexieRuntime';
import { brewingNotePersistence } from '@/lib/data/repositories';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { RoastingManager } from './roastingManager';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';

vi.mock('@/lib/app/dataIntegrity', () => ({
  clearExpectedCoreDataDeletion: vi.fn(async () => {}),
  markExpectedCoreDataDeletionIfEmpty: vi.fn(async () => {}),
}));

const bean: CoffeeBean = {
  id: 'synthetic',
  timestamp: 1,
  name: 'Synthetic',
  beanState: 'roasted',
  capacity: '100',
  remaining: '100',
};
const note: BrewingNote = {
  id: 'synthetic-note',
  timestamp: 2,
  beanId: bean.id,
  params: { coffee: '15.01g' },
  rating: 0,
  taste: {},
  notes: 'Synthetic tasting',
};
beforeEach(async () => {
  await db.delete();
  await db.open();
  bindDexieRepositories();
  vi.stubGlobal('window', new EventTarget());
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(async () => {
  await db.delete();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function seed(original: CoffeeBean, brew: BrewingNote) {
  await db.coffeeBeans.put(original);
  await db.brewingNotes.put(brew);
  useCoffeeBeanStore.getState().setBeans([original]);
  useBrewingNoteStore.getState().setNotes([brew]);
}
async function snapshot() {
  return {
    beans: await db.coffeeBeans.toArray(),
    notes: await db.brewingNotes.toArray(),
  };
}

it.each(['15.01g', '15.001g', '0.001g'])(
  'preserves %s from note saving through conversion',
  async coffee => {
    await db.coffeeBeans.put(bean);
    const saved = await brewingNotePersistence.saveWithInventory({
      ...note,
      params: { coffee },
    });
    const original = (await db.coffeeBeans.get(bean.id))!;
    useCoffeeBeanStore.getState().setBeans([original]);
    useBrewingNoteStore.getState().setNotes([saved.note!]);
    const preview = await RoastingManager.previewConvertRoastedToGreen(bean.id);
    const result = await RoastingManager.convertRoastedToGreen(bean.id);
    expect(preview.success).toBe(true);
    expect(result.success).toBe(true);
    expect(result.newRoastedBean?.capacity).toBe(String(parseFloat(coffee)));
    expect(result.newRoastedBean?.remaining).toBe('0');
    expect(
      Number(result.greenBean?.remaining) +
        Number(result.newRoastedBean?.capacity)
    ).toBe(100);
    expect(await db.brewingNotes.get(note.id)).toMatchObject({
      beanId: result.newRoastedBean!.id,
      params: { coffee },
      notes: note.notes,
    });
  }
);

it.each([
  {
    capacity: '100.123',
    remaining: '85',
    coffee: '15.001g',
    output: '15.123',
    stock: '0.122',
  },
  {
    capacity: '0.3',
    remaining: '0.1',
    coffee: '0.2g',
    output: '0.2',
    stock: '0',
  },
])(
  'matches preview and persisted three-decimal output for $capacity g',
  async data => {
    const original = {
      ...bean,
      capacity: data.capacity,
      remaining: data.remaining,
    };
    await seed(original, { ...note, params: { coffee: data.coffee } });
    const preview = await RoastingManager.previewConvertRoastedToGreen(bean.id);
    const result = await RoastingManager.convertRoastedToGreen(bean.id);
    expect(result.success).toBe(true);
    expect(preview.preview?.newRoastedBean).toEqual({
      capacity: Number(data.output),
      remaining: Number(data.stock),
    });
    expect(result.newRoastedBean).toMatchObject({
      capacity: data.output,
      remaining: data.stock,
    });
    expect(
      Math.round(
        (Number(result.greenBean?.remaining) +
          Number(result.newRoastedBean?.capacity)) *
          1000
      )
    ).toBe(Math.round(Number(data.capacity) * 1000));
  }
);

it.each([
  { remaining: '85', coffee: '15.001g' },
  { remaining: '85', coffee: '15.01g' },
  { remaining: '85', coffee: '20g' },
  { remaining: '0', coffee: '101g' },
  { remaining: '100', coffee: '0g' },
  { remaining: '100', coffee: '' },
])(
  'keeps unresolved history unchanged: remaining $remaining, dose $coffee',
  async data => {
    await seed(
      { ...bean, remaining: data.remaining },
      { ...note, params: { coffee: data.coffee } }
    );
    const before = await snapshot();
    const preview = await RoastingManager.previewConvertRoastedToGreen(bean.id);
    const result = await RoastingManager.convertRoastedToGreen(bean.id);
    expect(preview.success).toBe(false);
    expect(result.success).toBe(false);
    expect(preview.error).toMatch(/请先核对/);
    expect(preview.error).not.toMatch(/Existing|Error|stack|contradicts/);
    expect(result.error).toBe(preview.error);
    expect(await snapshot()).toEqual(before);
  }
);
