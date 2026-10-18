import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/core/db';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import { bindDexieRepositories } from '@/lib/data/dexieRuntime';
import {
  coffeeBeanRepository,
  brewingNoteRepository,
} from '@/lib/data/repositories';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { RoastingManager } from './roastingManager';

vi.mock('@/lib/app/dataIntegrity', () => ({
  clearExpectedCoreDataDeletion: vi.fn(async () => {}),
  markExpectedCoreDataDeletionIfEmpty: vi.fn(async () => {}),
}));

const greenBean = (
  id: string,
  name: string,
  remaining: string
): CoffeeBean => ({
  id,
  timestamp: 100,
  name,
  beanState: 'green',
  capacity: '100',
  remaining,
});

const baseBeans: CoffeeBean[] = [
  greenBean('green-a', 'QA green A', '80'),
  greenBean('green-b', 'QA green B', '50'),
  {
    id: 'roasted',
    timestamp: 101,
    name: 'QA roasted #2',
    beanState: 'roasted',
    capacity: '20',
    remaining: '17',
    sourceGreenBeanId: 'green-a',
    flavor: ['果香'],
    price: '33',
    notes: '熟豆原始备注',
  },
];

const baseNote: BrewingNote = {
  id: 'roasting-note',
  timestamp: 200,
  source: 'roasting',
  beanId: 'green-a',
  coffeeBeanInfo: {
    name: 'QA green A',
    roastLevel: '中度烘焙',
  },
  rating: 0,
  taste: {},
  notes: '烘焙了 20g 生豆 → QA roasted #2',
  changeRecord: {
    roastingRecord: {
      greenBeanId: 'green-a',
      greenBeanName: 'QA green A',
      roastedAmount: 20,
      roastedBeanId: 'roasted',
      roastedBeanName: 'QA roasted #2',
    },
  },
};
const baseRoastingRecord = baseNote.changeRecord!.roastingRecord!;

const editedNote = (overrides: Partial<BrewingNote> = {}): BrewingNote => ({
  ...baseNote,
  ...overrides,
  timestamp: overrides.timestamp ?? 300,
  changeRecord: {
    ...baseNote.changeRecord,
    ...overrides.changeRecord,
    roastingRecord: {
      ...baseRoastingRecord,
      ...overrides.changeRecord?.roastingRecord,
    },
  },
});

describe('RoastingManager.updateRoastingRecord', () => {
  beforeEach(async () => {
    bindDexieRepositories();
    vi.stubGlobal('window', new EventTarget());
    await Promise.all([
      db.coffeeBeans.clear(),
      db.coffeeBeanImages.clear(),
      db.coffeeBeanImageThumbnails.clear(),
      db.brewingNotes.clear(),
      db.brewingNoteImages.clear(),
      db.brewingNoteImageThumbnails.clear(),
    ]);
    await Promise.all([
      coffeeBeanRepository.upsertMany(baseBeans),
      brewingNoteRepository.upsertMany([baseNote]),
    ]);
    useCoffeeBeanStore.getState().setBeans(baseBeans);
    useBrewingNoteStore.getState().setNotes([baseNote]);
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await Promise.all([
      db.coffeeBeans.clear(),
      db.coffeeBeanImages.clear(),
      db.coffeeBeanImageThumbnails.clear(),
      db.brewingNotes.clear(),
      db.brewingNoteImages.clear(),
      db.brewingNoteImageThumbnails.clear(),
    ]);
  });

  it('uses the stored note amount across repeated saves and a stale store snapshot', async () => {
    const firstEdit = editedNote({
      changeRecord: {
        roastingRecord: {
          ...baseNote.changeRecord!.roastingRecord!,
          roastedAmount: 23,
        },
      },
    });

    const firstSave = await RoastingManager.updateRoastingRecord(firstEdit);
    const repeatedSave = await RoastingManager.updateRoastingRecord(firstEdit);

    // Simulate another editor having refreshed persistence but not this store.
    useBrewingNoteStore.getState().setNotes([baseNote]);
    const staleStoreSave = await RoastingManager.updateRoastingRecord(
      editedNote({
        timestamp: 400,
        changeRecord: {
          roastingRecord: {
            ...baseNote.changeRecord!.roastingRecord!,
            roastedAmount: 24,
          },
        },
      })
    );

    expect(firstSave.success).toBe(true);
    expect(repeatedSave.success).toBe(true);
    expect(staleStoreSave.success).toBe(true);
    expect(
      useCoffeeBeanStore.getState().getBeanById('green-a')?.remaining
    ).toBe('76');
    expect(useBrewingNoteStore.getState().notes).toHaveLength(1);
    expect(
      useBrewingNoteStore.getState().getNoteById('roasting-note')
    ).toMatchObject({
      timestamp: 400,
      source: 'roasting',
      beanId: 'green-a',
      changeRecord: {
        roastingRecord: { roastedAmount: 24, greenBeanId: 'green-a' },
      },
    });
    expect(useCoffeeBeanStore.getState().getBeanById('roasted')).toEqual(
      baseBeans[2]
    );
  });

  it('moves the inventory delta and updates only the roasted bean source link when changing green beans', async () => {
    const edit = editedNote({
      beanId: 'green-b',
      coffeeBeanInfo: { name: 'QA green B', roastLevel: '浅度烘焙' },
      changeRecord: {
        roastingRecord: {
          ...baseNote.changeRecord!.roastingRecord!,
          greenBeanId: 'green-b',
          roastedAmount: 17,
        },
      },
    });

    const result = await RoastingManager.updateRoastingRecord(edit);

    expect(result.success).toBe(true);
    expect(
      useCoffeeBeanStore.getState().getBeanById('green-a')?.remaining
    ).toBe('100');
    expect(
      useCoffeeBeanStore.getState().getBeanById('green-b')?.remaining
    ).toBe('33');
    expect(useCoffeeBeanStore.getState().getBeanById('roasted')).toMatchObject({
      id: 'roasted',
      name: 'QA roasted #2',
      capacity: '20',
      remaining: '17',
      flavor: ['果香'],
      price: '33',
      notes: '熟豆原始备注',
      sourceGreenBeanId: 'green-b',
    });
    expect(
      useBrewingNoteStore.getState().getNoteById('roasting-note')
    ).toMatchObject({
      source: 'roasting',
      beanId: 'green-b',
      coffeeBeanInfo: { name: 'QA green B' },
      changeRecord: {
        roastingRecord: {
          greenBeanId: 'green-b',
          greenBeanName: 'QA green B',
          roastedAmount: 17,
          roastedBeanId: 'roasted',
        },
      },
    });
  });

  it('restores both bean balances when the second bean write fails after persistence', async () => {
    const beanStore = useCoffeeBeanStore.getState();
    const originalUpdateBean = beanStore.updateBean;
    let updateCount = 0;
    vi.spyOn(beanStore, 'updateBean').mockImplementation(
      async (id, updates) => {
        const updatedBean = await originalUpdateBean(id, updates);
        updateCount += 1;
        if (updateCount === 2) {
          throw new Error('模拟第二次库存写入回调失败');
        }
        return updatedBean;
      }
    );

    const result = await RoastingManager.updateRoastingRecord(
      editedNote({
        beanId: 'green-b',
        coffeeBeanInfo: { name: 'QA green B', roastLevel: '浅度烘焙' },
        changeRecord: {
          roastingRecord: {
            ...baseNote.changeRecord!.roastingRecord!,
            greenBeanId: 'green-b',
          },
        },
      })
    );

    expect(result).toMatchObject({
      success: false,
      error: '模拟第二次库存写入回调失败',
    });
    expect(
      useCoffeeBeanStore.getState().getBeanById('green-a')?.remaining
    ).toBe('80');
    expect(
      useCoffeeBeanStore.getState().getBeanById('green-b')?.remaining
    ).toBe('50');
    expect(useBrewingNoteStore.getState().getNoteById('roasting-note')).toEqual(
      baseNote
    );
    expect(useCoffeeBeanStore.getState().getBeanById('roasted')).toEqual(
      baseBeans[2]
    );
  });

  it('rejects an amount that exceeds available green bean stock without changing the record or inventory', async () => {
    const edit = editedNote({
      changeRecord: {
        roastingRecord: {
          ...baseNote.changeRecord!.roastingRecord!,
          roastedAmount: 101,
        },
      },
    });

    const result = await RoastingManager.updateRoastingRecord(edit);

    expect(result).toMatchObject({ success: false, error: '生豆剩余量不足' });
    expect(
      useCoffeeBeanStore.getState().getBeanById('green-a')?.remaining
    ).toBe('80');
    expect(useBrewingNoteStore.getState().getNoteById('roasting-note')).toEqual(
      baseNote
    );
  });

  it('restores inventory and the original note when the note write fails after persistence', async () => {
    const noteStore = useBrewingNoteStore.getState();
    const originalUpdateNote = noteStore.updateNote;
    vi.spyOn(noteStore, 'updateNote').mockImplementationOnce(
      async (id, updates) => {
        await originalUpdateNote(id, updates);
        throw new Error('模拟笔记写入后续步骤失败');
      }
    );

    const result = await RoastingManager.updateRoastingRecord(
      editedNote({
        changeRecord: {
          roastingRecord: {
            ...baseNote.changeRecord!.roastingRecord!,
            roastedAmount: 23,
          },
        },
      })
    );

    expect(result).toMatchObject({
      success: false,
      error: '模拟笔记写入后续步骤失败',
    });
    expect(
      useCoffeeBeanStore.getState().getBeanById('green-a')?.remaining
    ).toBe('80');
    expect(useBrewingNoteStore.getState().getNoteById('roasting-note')).toEqual(
      baseNote
    );
    expect(await brewingNoteRepository.get('roasting-note')).toEqual(baseNote);
    expect(useCoffeeBeanStore.getState().getBeanById('roasted')).toEqual(
      baseBeans[2]
    );
  });

  it('reports when inventory rollback fails instead of implying data stayed unchanged', async () => {
    const beanStore = useCoffeeBeanStore.getState();
    const originalUpdateBean = beanStore.updateBean;
    let updateCount = 0;
    vi.spyOn(beanStore, 'updateBean').mockImplementation(
      async (id, updates) => {
        updateCount += 1;
        if (updateCount === 1) return originalUpdateBean(id, updates);
        throw new Error('模拟库存回滚失败');
      }
    );
    vi.spyOn(
      useBrewingNoteStore.getState(),
      'updateNote'
    ).mockRejectedValueOnce(new Error('模拟笔记写入失败'));

    const result = await RoastingManager.updateRoastingRecord(
      editedNote({
        changeRecord: {
          roastingRecord: {
            ...baseNote.changeRecord!.roastingRecord!,
            roastedAmount: 23,
          },
        },
      })
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('库存回滚失败');
    expect(result.error).toContain('请检查咖啡豆库存');
    expect(updateCount).toBe(2);
    expect(
      useCoffeeBeanStore.getState().getBeanById('green-a')?.remaining
    ).toBe('77');
    expect(useBrewingNoteStore.getState().getNoteById('roasting-note')).toEqual(
      baseNote
    );
    expect(useCoffeeBeanStore.getState().getBeanById('roasted')).toEqual(
      baseBeans[2]
    );
  });
});
