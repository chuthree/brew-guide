import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SqliteDriver } from '@/lib/data/sqlite/driver';
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
  saveAppSettings,
  getAppSettings,
} from '@/lib/data/sqlite/repositories/appSettings';
import { listBrewingNotes } from '@/lib/data/sqlite/repositories/brewingNote';
import {
  listCoffeeBeanImageMetadata,
  replaceCoffeeBeanImageMetadata,
} from '@/lib/data/sqlite/imageMetadataExecutor';
import { buildRepurchaseBean } from '@/lib/coffee-beans/repurchase';
import type { AppSettings } from '@/lib/data/models';
import type { CoffeeBean } from '@/types/app';
const native = vi.hoisted(() => ({
  driver: undefined as SqliteDriver | undefined,
}));
vi.mock('@/lib/data/sqlite/tauriSqliteDriver', () => ({
  openTauriSqliteDriver: async () => native.driver!,
}));
vi.mock('@/lib/app/runtime', async original => ({
  ...(await original<typeof import('@/lib/app/runtime')>()),
  detectAppRuntime: () => ({ runtime: 'tauri', capacitorPlatform: null }),
}));
import { executeMcpTool } from './tools';

let db: NodeSqliteTestDatabase;
type Result = {
  bean: CoffeeBean & { version: string };
  note: { id: string; version: string };
  replayed?: boolean;
};
const call = async (name: string, args: Record<string, unknown>) =>
  (await executeMcpTool(name, args, {
    scopes: { beans: 'edit', notes: 'edit' },
  })) as Result;
const source: CoffeeBean = {
  id: 'source',
  name: 'Native #2',
  timestamp: 1,
  capacity: '250',
  remaining: '30',
  roastDate: '2026-10-01',
  overallRating: 4.5,
  ratingNotes: 'old',
  sourceGreenBeanId: 'green',
  sourceGreenBeanIds: ['green'],
  notes: 'keep',
};
beforeEach(async () => {
  db = await createNodeSqliteTestDatabase();
  native.driver = db.driver;
  await saveCoffeeBean(db.driver, source);
});
afterEach(async () => {
  native.driver = undefined;
  await db.close();
});

describe('MCP repurchase and ratings with real SQLite', () => {
  it('creates the final repurchase specification once without intermediate inventory history', async () => {
    await saveCoffeeBean(db.driver, {
      ...source,
      capacity: '100',
      remaining: '100',
    });
    const original = (await call('get_bean', { id: source.id })).bean;
    const args = {
      requestId: crypto.randomUUID(),
      id: source.id,
      expectedVersion: original.version,
      changes: {
        capacityGrams: 250,
        price: '120',
        roastDate: '2026-11-10',
        roastLevel: 'light',
      },
    };
    const result = await call('repurchase_bean', args);
    expect(await getCoffeeBean(db.driver, result.bean.id)).toMatchObject({
      name: 'Native #3',
      capacity: '250',
      remaining: '250',
      price: '120',
      roastDate: '2026-11-10',
      roastLevel: '浅度烘焙',
    });
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
    expect((await getCoffeeBean(db.driver, source.id))!.capacity).toBe('100');
    expect((await call('repurchase_bean', args)).bean.id).toBe(result.bean.id);
    await expect(
      call('repurchase_bean', { ...args, changes: { capacityGrams: 300 } })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    for (const changes of [
      { capacityGrams: -1 },
      { roastDate: '2026-02-30' },
      { overallRating: 4.1 },
      { startDay: 20, endDay: 10 },
    ])
      await expect(
        call('repurchase_bean', {
          ...args,
          requestId: crypto.randomUUID(),
          changes,
        })
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await listCoffeeBeans(db.driver)).toHaveLength(2);
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
  });
  it.each([{}, { capacityGrams: 500, price: '120', roastDate: '2026-11-10' }])(
    'repurchases using the UI rule with changes %j, preserves images/groups/stock, replays once and rejects conflicts',
    async changes => {
      await saveCoffeeBean(db.driver, {
        ...source,
        id: 'other',
        name: 'Native #4',
      });
      const groups = [
        {
          id: 'group',
          name: 'Group',
          beanIds: [source.id],
          order: 0,
          createdAt: 1,
          updatedAt: 1,
        },
      ];
      await saveAppSettings(db.driver, {
        coffeeBeanGroups: groups,
      } as AppSettings);
      await replaceCoffeeBeanImageMetadata(db.driver, source.id, [
        {
          imageId: 'front',
          beanId: source.id,
          slot: 'front',
          variant: 'original',
          sourceKind: 'external',
          externalUrl: 'https://example.com/bean.png',
        },
      ]);
      const current = (await call('get_bean', { id: source.id })).bean;
      const args = {
        requestId: crypto.randomUUID(),
        id: source.id,
        expectedVersion: current.version,
        changes,
      };
      const expected = buildRepurchaseBean(
        source,
        await listCoffeeBeans(db.driver),
        changes
      );
      const result = await call('repurchase_bean', args);
      expect(await getCoffeeBean(db.driver, result.bean.id)).toMatchObject(
        expected
      );
      expect(result.bean.name).toBe('Native #5');
      expect(result.bean.overallRating).toBeUndefined();
      expect(
        (await getCoffeeBean(db.driver, result.bean.id))!.sourceGreenBeanId
      ).toBeUndefined();
      expect(await getCoffeeBean(db.driver, source.id)).toEqual(source);
      expect((await getAppSettings(db.driver))!.coffeeBeanGroups).toEqual(
        groups
      );
      expect(await listBrewingNotes(db.driver)).toHaveLength(0);
      expect(
        await listCoffeeBeanImageMetadata(db.driver, result.bean.id)
      ).toMatchObject([
        { beanId: result.bean.id, externalUrl: 'https://example.com/bean.png' },
      ]);
      expect((await call('repurchase_bean', args)).bean.id).toBe(
        result.bean.id
      );
      await saveCoffeeBean(db.driver, { ...source, timestamp: 2 });
      await expect(
        call('repurchase_bean', { ...args, requestId: crypto.randomUUID() })
      ).rejects.toMatchObject({ code: 'CONFLICT' });
      expect(await listCoffeeBeans(db.driver)).toHaveLength(3);
    }
  );

  it('rejects invalid scores in generic native creates and updates without stock or note writes', async () => {
    const current = (await call('get_bean', { id: source.id })).bean;
    for (const overallRating of [0.1, 4.3, 5.1]) {
      await expect(
        call('create_bean', {
          requestId: crypto.randomUUID(),
          bean: { name: 'bad', overallRating },
        })
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
      await expect(
        call('update_bean', {
          requestId: crypto.randomUUID(),
          id: source.id,
          expectedVersion: current.version,
          changes: { overallRating },
        })
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    }
    for (const note of [{ rating: 4.3 }, { taste: { acidity: 4.5 } }]) {
      await expect(
        call('create_brew_note', {
          requestId: crypto.randomUUID(),
          note: { beanId: source.id, coffeeGrams: 10, ...note },
        })
      ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    }
    expect(await listBrewingNotes(db.driver)).toHaveLength(0);
    expect(await listCoffeeBeans(db.driver)).toHaveLength(1);
    expect((await getCoffeeBean(db.driver, source.id))!.remaining).toBe('30');
    const good = await call('create_brew_note', {
      requestId: crypto.randomUUID(),
      note: { notes: 'good', rating: 4.5 },
    });
    await expect(
      call('update_brew_note', {
        requestId: crypto.randomUUID(),
        id: good.note.id,
        expectedVersion: good.note.version,
        changes: { rating: 4.3 },
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    await saveAppSettings(db.driver, {
      beanRatingTenthStep: true,
      flavorRatingTenthStep: true,
    } as AppSettings);
    await call('create_bean', {
      requestId: crypto.randomUUID(),
      bean: { name: 'tenths', overallRating: 4.3 },
    });
    for (const rating of [0, 0.1, 4.3, 5])
      await call('create_brew_note', {
        requestId: crypto.randomUUID(),
        note: { notes: 'valid', rating },
      });
  });
});
