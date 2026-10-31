import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/core/db';
import { roastingPersistence } from '@/lib/data/adapters/dexie/roastingPersistence';
import { createSqliteRoastingPersistence } from '@/lib/data/sqlite/persistence/roastingPersistence';
import { createNodeSqliteTestDatabase } from '@/lib/data/sqlite/repositories/testing/nodeSqliteTestDriver';
import {
  listCoffeeBeans,
  upsertManyCoffeeBeans,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import { listBrewingNotes } from '@/lib/data/sqlite/repositories/brewingNote';
import type { CoffeeBean } from '@/types/app';
import type { RoastingChanges, RoastingCommand } from './roastingBatch';
import type { BrewingNote } from '@/lib/core/config';

const seed: CoffeeBean[] = ['a', 'b'].map(id => ({
  id,
  name: id,
  timestamp: 1,
  beanState: 'green',
  capacity: '500',
  remaining: '500',
  price: '100',
  blendComponents: [{ origin: id, percentage: 100 }],
}));
const command = (
  overrides: Partial<RoastingCommand> = {}
): RoastingCommand => ({
  noteId: 'note',
  beanId: 'output',
  now: 10,
  draft: {
    inputs: [
      { greenBeanId: 'a', amount: 100 },
      { greenBeanId: 'b', amount: 50 },
    ],
    name: 'QA blend',
    roaster: 'QA',
    outputAmount: 120,
    roastDate: '2026-10-31',
    roastLevel: '中度烘焙',
    notes: 'QA',
  },
  ...overrides,
});

for (const backend of ['Dexie', 'SQLite'] as const) {
  describe(`batch QA: ${backend}`, () => {
    let save: (command: RoastingCommand) => Promise<RoastingChanges>;
    let beans: () => Promise<CoffeeBean[]>;
    let notes: () => Promise<BrewingNote[]>;
    let put: (beans: CoffeeBean[]) => Promise<unknown>;
    let close: () => Promise<void>;
    let failNoteWrite: () => Promise<() => void>;
    beforeEach(async () => {
      if (backend === 'Dexie') {
        await db.delete();
        await db.open();
        save = roastingPersistence.save;
        beans = () => db.coffeeBeans.toArray();
        notes = () => db.brewingNotes.toArray();
        put = values => db.coffeeBeans.bulkPut(values);
        close = () => db.delete();
        failNoteWrite = async () => {
          const fail = () => {
            throw new Error('QA injected note failure');
          };
          db.brewingNotes.hook('creating', fail);
          return () => db.brewingNotes.hook('creating').unsubscribe(fail);
        };
      } else {
        const sqlite = await createNodeSqliteTestDatabase();
        const fileStore = {
          write: vi.fn(),
          read: vi.fn(),
          delete: vi.fn(),
          exists: vi.fn(),
          listObjectKeys: vi.fn(async () => []),
        };
        save = createSqliteRoastingPersistence(sqlite.driver, fileStore).save;
        beans = () => listCoffeeBeans(sqlite.driver);
        notes = () => listBrewingNotes(sqlite.driver);
        put = values => upsertManyCoffeeBeans(sqlite.driver, values);
        close = () => sqlite.close();
        failNoteWrite = async () => {
          const transact = sqlite.driver.transaction.bind(sqlite.driver);
          const spy = vi
            .spyOn(sqlite.driver, 'transaction')
            .mockImplementation(operation =>
              transact(tx =>
                operation({
                  ...tx,
                  execute: async (sql, params) => {
                    if (sql.includes('INSERT INTO brewing_notes'))
                      throw new Error('QA injected note failure');
                    return tx.execute(sql, params);
                  },
                })
              )
            );
          return () => spy.mockRestore();
        };
      }
      await put(structuredClone(seed));
    });
    afterEach(async () => {
      vi.restoreAllMocks();
      await close();
    });
    const balance = async (id: string) =>
      (await beans()).find(bean => bean.id === id)!;
    it('cancels roasting atomically and refunds each input only once', async () => {
      const first = await save(command());
      await save(
        command({ draft: undefined, expectedUpdatedAt: first.note!.updatedAt })
      );
      expect(await notes()).toEqual([]);
      expect((await balance('a')).remaining).toBe('500');
      expect((await balance('b')).remaining).toBe('500');
      expect(await balance('output')).toBeUndefined();
      await expect(save(command({ draft: undefined }))).rejects.toThrow();
      expect((await balance('a')).remaining).toBe('500');
    });
    it('rolls back bean writes when the subsequent note write fails', async () => {
      const restore = await failNoteWrite();
      try {
        await expect(save(command())).rejects.toThrow(
          'QA injected note failure'
        );
        expect(await beans()).toEqual(seed);
        expect(await notes()).toEqual([]);
      } finally {
        restore();
      }
    });
    it('creates stock, lineage, composition and cost without assigning blend percentages', async () => {
      const result = await save(command());
      expect((await balance('a')).remaining).toBe('400');
      expect((await balance('b')).remaining).toBe('450');
      expect(await balance('output')).toMatchObject({
        remaining: '120',
        capacity: '120',
        price: '30.00',
        sourceGreenBeanIds: ['a', 'b'],
      });
      expect((await balance('output')).blendComponents).toEqual([
        { origin: 'a' },
        { origin: 'b' },
      ]);
      expect(await notes()).toHaveLength(1);
      expect(result.note?.changeRecord?.roastingRecord?.roastedAmount).toBe(
        150
      );
    });
    it('edits deltas while preserving consumed roasted stock and rejects stale edits', async () => {
      const first = await save(command());
      await put([{ ...(await balance('output')), remaining: '100' }]);
      const edit = command({
        expectedUpdatedAt: first.note!.updatedAt,
        draft: {
          ...command().draft!,
          inputs: [{ greenBeanId: 'a', amount: 120 }],
          outputAmount: 90,
        },
      });
      await save(edit);
      expect((await balance('a')).remaining).toBe('380');
      expect((await balance('b')).remaining).toBe('500');
      expect(await balance('output')).toMatchObject({
        capacity: '90',
        remaining: '70',
      });
      await expect(save(edit)).rejects.toThrow('已变化');
      expect((await balance('a')).remaining).toBe('380');
    });
    it('saves record-form blend edits with matching costs and cancellation refunds', async () => {
      const first = await save(command());
      const edited = await save(
        command({
          draft: undefined,
          expectedUpdatedAt: first.note!.updatedAt,
          legacyEdit: {
            greenBeanId: '',
            amount: 170,
            timestamp: first.note!.timestamp,
            inputs: [
              { greenBeanId: 'a', greenBeanName: 'a', amount: 120 },
              { greenBeanId: 'b', greenBeanName: 'b', amount: 50 },
            ],
          },
        })
      );
      expect((await balance('a')).remaining).toBe('380');
      expect((await balance('b')).remaining).toBe('450');
      expect(await balance('output')).toMatchObject({
        capacity: '120',
        remaining: '120',
        price: '34.00',
      });
      expect(edited.note?.beanId).toBeUndefined();
      expect(edited.note?.changeRecord?.roastingRecord?.inputs).toEqual([
        { greenBeanId: 'a', greenBeanName: 'a', amount: 120, cost: 24 },
        { greenBeanId: 'b', greenBeanName: 'b', amount: 50, cost: 10 },
      ]);
      await save(
        command({ draft: undefined, expectedUpdatedAt: edited.note!.updatedAt })
      );
      expect((await balance('a')).remaining).toBe('500');
      expect((await balance('b')).remaining).toBe('500');
    });
    it('updates a single-input record through the record form without stale input amounts', async () => {
      const first = await save(
        command({
          draft: {
            ...command().draft!,
            inputs: [{ greenBeanId: 'a', amount: 150 }],
          },
        })
      );
      const edited = await save(
        command({
          draft: undefined,
          expectedUpdatedAt: first.note!.updatedAt,
          legacyEdit: {
            greenBeanId: 'a',
            amount: 160,
            timestamp: first.note!.timestamp,
            inputs: first.note!.changeRecord!.roastingRecord!.inputs,
          },
        })
      );
      expect(
        edited.note?.changeRecord?.roastingRecord?.inputs?.[0]
      ).toMatchObject({ amount: 160, cost: 32 });
      expect((await balance('a')).remaining).toBe('340');
      expect((await balance('output')).price).toBe('32.00');
    });
    it('keeps the record and roasted bean dates consistent after a date edit', async () => {
      const first = await save(command());
      const edited = await save(
        command({
          draft: undefined,
          expectedUpdatedAt: first.note!.updatedAt,
          legacyEdit: {
            greenBeanId: '',
            amount: 150,
            timestamp: new Date(2026, 9, 30, 12).getTime(),
            inputs: first.note!.changeRecord!.roastingRecord!.inputs,
          },
        })
      );
      expect(edited.note?.changeRecord?.roastingRecord?.roastDate).toBe(
        '2026-10-30'
      );
      expect(edited.note?.coffeeBeanInfo?.roastDate).toBe('2026-10-30');
      expect(await balance('output')).toMatchObject({
        roastDate: '2026-10-30',
        price: '30.00',
        remaining: '120',
      });
      expect((await balance('a')).remaining).toBe('400');
    });
    it('rejects output below consumed stock without changing any records', async () => {
      const first = await save(command());
      await put([{ ...(await balance('output')), remaining: '10' }]);
      const before = await beans();
      await expect(
        save(
          command({
            expectedUpdatedAt: first.note!.updatedAt,
            draft: { ...command().draft!, outputAmount: 100 },
          })
        )
      ).rejects.toMatchObject({
        field: 'amount',
        message: expect.stringContaining('已使用量'),
      });
      expect(await beans()).toEqual(before);
    });
    it('rejects output changed by another editor and unavailable source beans', async () => {
      const first = await save(command());
      await put([{ ...(await balance('output')), timestamp: 99 }]);
      const before = await beans();
      await expect(
        save(
          command({
            expectedUpdatedAt: first.note!.updatedAt,
            expectedOutputTimestamp: 10,
          })
        )
      ).rejects.toThrow('熟豆信息或库存已变化');
      expect(await beans()).toEqual(before);
      await put([{ ...(await balance('b')), isInTransit: true }]);
      await expect(
        save(command({ noteId: 'new-note', beanId: 'new-bean' }))
      ).rejects.toThrow('尚未到货');
      expect((await balance('a')).remaining).toBe('400');
      expect(await notes()).toHaveLength(1);
    });
    it('serializes competing stock deductions and prevents duplicate creation', async () => {
      const draft = {
        ...command().draft!,
        inputs: [{ greenBeanId: 'a', amount: 400 }],
        outputAmount: 300,
      };
      const results = await Promise.allSettled([
        save(command({ draft })),
        save(command({ draft, noteId: 'other', beanId: 'other-output' })),
      ]);
      expect(
        results.filter(result => result.status === 'fulfilled')
      ).toHaveLength(1);
      expect((await balance('a')).remaining).toBe('100');
      expect(await notes()).toHaveLength(1);
      const winner = results.find(result => result.status === 'fulfilled')!;
      if (winner.status === 'fulfilled')
        await save(
          command({
            draft,
            noteId: winner.value.note!.id,
            beanId: winner.value.beans.at(-1)!.id,
          })
        );
      expect((await balance('a')).remaining).toBe('100');
    });
    it.each(['zero', 'overdraw', 'duplicate', 'date', 'output'] as const)(
      'rejects %s with no partial stock or note writes',
      async kind => {
        const draft = structuredClone(command().draft!);
        if (kind === 'zero') draft.inputs[0].amount = 0;
        if (kind === 'overdraw') draft.inputs[1].amount = 501;
        if (kind === 'duplicate') draft.inputs[1].greenBeanId = 'a';
        if (kind === 'date') draft.roastDate = '2026-02-30';
        if (kind === 'output') draft.outputAmount = 151;
        await expect(save(command({ draft }))).rejects.toThrow();
        expect(await beans()).toEqual(seed);
        expect(await notes()).toEqual([]);
      }
    );
  });
}
