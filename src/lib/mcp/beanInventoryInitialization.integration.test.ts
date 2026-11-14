import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
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
vi.mock('@/lib/data/business/publishChanges', () => ({
  publishBusinessChanges: vi.fn(async () => {}),
}));

import { withDataMutation } from '@/lib/data/mutationCoordinator';
import { publishBusinessChanges } from '@/lib/data/business/publishChanges';
import { buildQuickDecrementRecord } from '@/lib/coffee-beans/inventoryRecords';
import { executeMcpTool } from './tools';
import { TOOL_SCHEMAS } from './toolDefinitions';
import { setBusinessPublicationHost } from './runtimeHost';

type BeanView = CoffeeBean & {
  version: string;
  capacityGrams: number | null;
  remainingGrams: number | null;
};
type Result = {
  bean: BeanView;
  inventoryInitialized?: true;
  replayed?: boolean;
  publicationPending?: boolean;
  notificationWarning?: string;
};
const requestId = () => crypto.randomUUID();

// Execute real persistence/receipt transactions with synthetic data.
// Only native driver opening and post-commit UI publication are replaced.
describe('Native initial bean inventory', () => {
  let sqlite: NodeSqliteTestDatabase | undefined;
  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.mocked(publishBusinessChanges).mockResolvedValue(undefined);
    setBusinessPublicationHost(async () => {});

    sqlite = await createNodeSqliteTestDatabase();
    native.driver = sqlite.driver;
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    setBusinessPublicationHost(undefined);
    native.driver = undefined;
    await sqlite!.close();
  });

  const call = (name: string, args: Record<string, unknown>) =>
    executeMcpTool(name, args, {
      scopes: { beans: 'edit', notes: 'edit' },
    }) as Promise<Result>;
  const create = (capacity?: number) =>
    call('create_bean', {
      requestId: requestId(),
      ...{
        bean: {
          name: 'Synthetic unknown-weight bean',
          ...(capacity === undefined ? {} : { capacityGrams: capacity }),
        },
      },
    });
  const capacityChange = (capacity = 250) => ({ capacityGrams: capacity });
  const argsFor = (bean: BeanView, capacity = 250) => ({
    requestId: requestId(),
    id: bean.id,
    expectedVersion: bean.version,
    changes: capacityChange(capacity),
  });
  const assignmentArgs = (bean: BeanView, remainingGrams = 250) => ({
    requestId: requestId(),
    id: bean.id,
    expectedVersion: bean.version,
    remainingGrams,
  });
  const initializationArgs = (tool: string, bean: BeanView) =>
    tool === 'update_bean' ? argsFor(bean) : assignmentArgs(bean);
  const saved = (id: string) => getCoffeeBean(sqlite!.driver, id);
  const saveBean = async (bean: CoffeeBean) => {
    await saveCoffeeBean(sqlite!.driver, bean);
  };
  const saveNote = async (note: BrewingNote) => {
    await saveBrewingNote(sqlite!.driver, note);
  };
  const notes = () => listBrewingNotes(sqlite!.driver);
  const receipts = async () =>
    (await sqlite!.driver.query('SELECT request_id FROM mcp_operations'))
      .length;
  const current = async (id: string) => (await call('get_bean', { id })).bean;
  const editFixture = async (bean: BeanView, changes: Partial<CoffeeBean>) => {
    await saveBean({ ...(await saved(bean.id))!, ...changes });
    return current(bean.id);
  };
  const unknownWithCapacity = async (capacity = 250) => {
    const initial = await create();
    return {
      bean: await editFixture(initial.bean, { capacity: String(capacity) }),
    };
  };
  const history = (bean: CoffeeBean): BrewingNote => ({
    id: requestId(),
    ...buildQuickDecrementRecord(bean, 10),
  });

  it('keeps unknown creation amounts missing and explicit zero inventory zero', async () => {
    const unknown = await create();
    expect(unknown.bean).toMatchObject({
      capacityGrams: null,
      remainingGrams: null,
    });
    expect((await saved(unknown.bean.id))?.remaining).toBe('');
    const zero = await create(0);
    expect(zero.bean).toMatchObject({ capacityGrams: 0, remainingGrams: 0 });
    expect(await notes()).toHaveLength(0);
  });

  it('uses capacity edits for initialization and rejects the retired flag', async () => {
    const schema = TOOL_SCHEMAS.get('update_bean')!;
    expect(schema.properties).not.toHaveProperty(
      'initializeRemainingFromCapacity'
    );
    expect(schema.properties!.changes.properties).not.toHaveProperty(
      'initializeRemainingFromCapacity'
    );
    expect(schema.properties!.changes.properties).not.toHaveProperty(
      'remainingGrams'
    );
    const initial = await create();
    await expect(
      call('update_bean', {
        ...argsFor(initial.bean),
        initializeRemainingFromCapacity: true,
      })
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect((await saved(initial.bean.id))?.remaining).toBe('');
  });

  it('atomically fills both unknown amounts without inventing an adjustment record', async () => {
    const initial = await create();
    const result = await call('update_bean', argsFor(initial.bean));
    expect(result).toMatchObject({
      bean: { capacityGrams: 250, remainingGrams: 250 },
      inventoryInitialized: true,
      replayed: false,
    });
    expect(await saved(initial.bean.id)).toMatchObject({
      capacity: '250',
      remaining: '250',
    });
    expect(await notes()).toHaveLength(0);
    expect(await receipts()).toBe(2);
  });

  it.each(['update_bean', 'adjust_bean_inventory'])(
    'repairs the capacity-only partial result through an explicit %s request',
    async tool => {
      const partial = await unknownWithCapacity();
      expect(partial.bean).toMatchObject({
        capacityGrams: 250,
        remainingGrams: null,
      });
      expect(partial).not.toHaveProperty('inventoryInitialized');
      const completed = await call(
        tool,
        initializationArgs(tool, partial.bean)
      );
      expect(completed).toMatchObject({
        bean: { capacityGrams: 250, remainingGrams: 250 },
        inventoryInitialized: true,
      });
      expect(await notes()).toHaveLength(0);
    }
  );

  it.each(['', ' ', undefined, null])(
    'initializes missing remaining %s together with metadata and capacity',
    async remaining => {
      const initial = await create();
      const bean = await editFixture(initial.bean, {
        remaining,
      } as Partial<CoffeeBean>);
      const args = argsFor(bean);
      const result = await call('update_bean', {
        ...args,
        changes: {
          ...args.changes,
          name: 'Updated metadata',
        },
      });
      expect(result).toMatchObject({
        inventoryInitialized: true,
        bean: {
          name: 'Updated metadata',
          capacityGrams: 250,
          remainingGrams: 250,
        },
      });
      expect(await receipts()).toBe(2);
      expect(await notes()).toHaveLength(0);
    }
  );

  it('initializes zero capacity as zero remaining', async () => {
    const initial = await create();
    const args = argsFor(initial.bean, 0);
    expect(await call('update_bean', args)).toMatchObject({
      inventoryInitialized: true,
      bean: { capacityGrams: 0, remainingGrams: 0 },
    });
  });

  it('allows metadata-only edits without an inventory choice', async () => {
    const initial = await create();
    expect(
      await call('update_bean', {
        requestId: requestId(),
        id: initial.bean.id,
        expectedVersion: initial.bean.version,
        changes: { name: 'Only metadata changed' },
      })
    ).toMatchObject({
      bean: {
        name: 'Only metadata changed',
        capacityGrams: null,
        remainingGrams: null,
      },
    });
    expect((await saved(initial.bean.id))?.remaining).toBe('');
  });

  it.each(['', ' ', undefined, null])(
    'sets explicit stock from truly missing remaining %s without a fake adjustment',
    async remaining => {
      const initial = await unknownWithCapacity();
      const bean = await editFixture(initial.bean, {
        remaining,
      } as Partial<CoffeeBean>);
      const result = await call('adjust_bean_inventory', assignmentArgs(bean));
      expect(result).toMatchObject({
        bean: { capacityGrams: 250, remainingGrams: 250 },
        inventoryInitialized: true,
        adjustmentNote: null,
      });
      expect(result.bean.version).not.toBe(bean.version);
      expect(await saved(bean.id)).toMatchObject({
        capacity: '250',
        remaining: '250',
      });
      expect(await notes()).toHaveLength(0);
      expect(await receipts()).toBe(2);
    }
  );

  it.each([0, 75, 250.5])(
    'assigns exact initial stock %s within known capacity',
    async remaining => {
      const initial = await unknownWithCapacity(300);
      expect(
        await call(
          'adjust_bean_inventory',
          assignmentArgs(initial.bean, remaining)
        )
      ).toMatchObject({
        inventoryInitialized: true,
        bean: { capacityGrams: 300, remainingGrams: remaining },
      });
      expect(await notes()).toHaveLength(0);
    }
  );

  it('allows zero remaining with zero known capacity and rejects precision loss', async () => {
    const zero = await unknownWithCapacity(0);
    expect(
      await call('adjust_bean_inventory', assignmentArgs(zero.bean, 0))
    ).toMatchObject({
      bean: { capacityGrams: 0, remainingGrams: 0 },
      inventoryInitialized: true,
    });
    const initial = await unknownWithCapacity();
    const before = await saved(initial.bean.id);
    await expect(
      call('adjust_bean_inventory', assignmentArgs(initial.bean, 200.0001))
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect(await saved(initial.bean.id)).toEqual(before);
  });

  it.each([
    { remainingGrams: 251 },
    { remainingGrams: -1 },
    { remainingGrams: 1_000_001 },
    { deltaGrams: 250 },
    { deltaGrams: -10 },
    { remainingGrams: 250, deltaGrams: 250 },
    { remainingGrams: 250, recordType: 'quick-decrement' },
    {},
  ])('rejects unsafe unknown-stock request %j atomically', async fields => {
    const initial = await unknownWithCapacity();
    const before = await saved(initial.bean.id);
    const { remainingGrams: _amount, ...args } = assignmentArgs(initial.bean);
    await expect(
      call('adjust_bean_inventory', { ...args, ...fields })
    ).rejects.toMatchObject({
      code: 'INVALID_ARGUMENT',
    });
    expect(await saved(initial.bean.id)).toEqual(before);
    expect(await receipts()).toBe(1);
    expect(await notes()).toHaveLength(0);
  });

  it.each(['invalid', '-1', false])(
    'does not treat malformed remaining %s as missing',
    async remaining => {
      const initial = await unknownWithCapacity();
      const bean = await editFixture(initial.bean, {
        remaining,
      } as Partial<CoffeeBean>);
      const before = await saved(bean.id);
      await expect(
        call('adjust_bean_inventory', assignmentArgs(bean))
      ).rejects.toMatchObject({
        code: 'INVALID_ARGUMENT',
      });
      expect(await saved(bean.id)).toEqual(before);
      expect(await receipts()).toBe(1);
    }
  );

  it.each(['', ' ', undefined, null, 'unknown', '250 or 500g', '-250'])(
    'requires a valid known capacity for exact initial stock (%s)',
    async capacity => {
      const initial = await create();
      const bean = await editFixture(initial.bean, {
        capacity,
      } as Partial<CoffeeBean>);
      const before = await saved(bean.id);
      await expect(
        call('adjust_bean_inventory', assignmentArgs(bean))
      ).rejects.toMatchObject({
        code: 'INVALID_ARGUMENT',
      });
      expect(await saved(bean.id)).toEqual(before);
      expect(await receipts()).toBe(1);
    }
  );

  it('preserves known-stock adjustments, including zero and consumption history', async () => {
    const initial = await create(250);
    const first = await call(
      'adjust_bean_inventory',
      assignmentArgs(initial.bean, 0)
    );
    expect(first).not.toHaveProperty('inventoryInitialized');
    expect((await current(initial.bean.id)).remainingGrams).toBe(0);
    expect((await notes())[0]).toMatchObject({
      source: 'capacity-adjustment',
      changeRecord: {
        capacityAdjustment: { originalAmount: 250, newAmount: 0 },
      },
    });
    const empty = await current(initial.bean.id);
    const next = await call(
      'adjust_bean_inventory',
      assignmentArgs(empty, 200)
    );
    expect(next).not.toHaveProperty('inventoryInitialized');
    expect((await current(empty.id)).remainingGrams).toBe(200);
    const restored = await current(empty.id);
    const { remainingGrams: _amount, ...args } = assignmentArgs(restored);
    await call('adjust_bean_inventory', { ...args, deltaGrams: -10 });
    expect((await current(empty.id)).remainingGrams).toBe(190);
    expect((await notes()).map(note => note.source).sort()).toEqual([
      'capacity-adjustment',
      'capacity-adjustment',
      'quick-decrement',
    ]);
  });

  it('preserves both image sides and thumbnails during exact initialization', async () => {
    const initial = await unknownWithCapacity();
    const id = initial.bean.id;

    for (const side of ['front', 'back'])
      for (const variant of ['original', 'thumbnail'])
        await sqlite!.driver.execute(
          `INSERT INTO coffee_bean_images
             (image_id, bean_id, slot, variant, source_kind, relative_path, mime_type, size_bytes, sha256, external_url, updated_at_ms)
             VALUES (?, ?, ?, ?, 'file', ?, 'image/webp', 10, NULL, NULL, 1)`,
          [
            `${side}-${variant}`,
            id,
            side,
            variant,
            `images/synthetic-${side}-${variant}.webp`,
          ]
        );

    const images = () =>
      sqlite!.driver.query(
        'SELECT * FROM coffee_bean_images ORDER BY image_id'
      );
    const beforeImages = await images();
    const bean = await current(id);
    await call('adjust_bean_inventory', assignmentArgs(bean));
    expect(await images()).toEqual(beforeImages);
    expect((await current(id)).remainingGrams).toBe(250);
    expect(await notes()).toHaveLength(0);
  });

  it('records unknown-to-known snapshots without inventing zero stock', async () => {
    const initial = await unknownWithCapacity();
    const args = assignmentArgs(initial.bean);
    await call('adjust_bean_inventory', args);
    const changes = JSON.parse(
      String(
        (
          await sqlite!.driver.query(
            'SELECT snapshots_json FROM mcp_activity WHERE request_id = ?',
            [args.requestId]
          )
        )[0].snapshots_json
      )
    );
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ entity: 'bean', id: initial.bean.id });
    expect(changes[0].before).toMatchObject({ remainingGrams: null });
    expect(changes[0].after).toMatchObject({ remainingGrams: 250 });
    expect(await notes()).toHaveLength(0);
  });

  it.each([
    { remaining: '200', expected: 300 },
    { remaining: '150', expected: 150 },
  ])(
    'updates capacity with stock $remaining to $expected',
    async ({ remaining, expected }) => {
      const initial = await create(200);
      const bean = await editFixture(initial.bean, { remaining });
      const result = await call('update_bean', argsFor(bean, 300));
      expect(result.bean).toMatchObject({
        capacityGrams: 300,
        remainingGrams: expected,
      });
      expect(result).not.toHaveProperty('inventoryInitialized');
    }
  );

  it('initializes an exact decimal and rejects a silently rounded initial weight', async () => {
    const initial = await create();
    const result = await call('update_bean', argsFor(initial.bean, 250.5));
    expect(result.bean).toMatchObject({
      capacityGrams: 250.5,
      remainingGrams: 250.5,
    });
    const other = await create();
    await expect(
      call('update_bean', argsFor(other.bean, 250.0001))
    ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
    expect((await saved(other.bean.id))?.remaining).toBe('');
  });

  it.each(['0', 0, '75'])(
    'preserves known remaining %s when adding a missing capacity',
    async remaining => {
      const initial = await create();
      const bean = await editFixture(initial.bean, {
        remaining,
      } as Partial<CoffeeBean>);
      const result = await call('update_bean', argsFor(bean));
      expect(result.bean).toMatchObject({
        capacityGrams: 250,
        remainingGrams: Number(remaining),
      });
      expect(result).not.toHaveProperty('inventoryInitialized');
      expect(await notes()).toHaveLength(0);
    }
  );

  it.each(['invalid', '-1'])(
    'rejects malformed remaining %s without any writes',
    async remaining => {
      const initial = await create();
      const bean = await editFixture(initial.bean, {
        remaining,
      } as Partial<CoffeeBean>);
      const before = await saved(bean.id);
      await expect(call('update_bean', argsFor(bean))).rejects.toMatchObject({
        code: 'INVALID_ARGUMENT',
      });
      expect(await saved(bean.id)).toEqual(before);
      expect(await receipts()).toBe(1);
    }
  );

  it.each(['200', '0'])(
    'initializes unknown stock from the new capacity after previous capacity %s',
    async capacity => {
      const initial = await create();
      const bean = await editFixture(initial.bean, { capacity });
      expect(await call('update_bean', argsFor(bean))).toMatchObject({
        inventoryInitialized: true,
        bean: { capacityGrams: 250, remainingGrams: 250 },
      });
      expect(await notes()).toHaveLength(0);
    }
  );

  it.each(['unknown', '250 or 500g', '-250'])(
    'rejects malformed original capacity %s',
    async capacity => {
      const initial = await create();
      const bean = await editFixture(initial.bean, { capacity });
      const before = await saved(bean.id);
      await expect(call('update_bean', argsFor(bean))).rejects.toMatchObject({
        code: 'INVALID_ARGUMENT',
      });
      expect(await saved(bean.id)).toEqual(before);
    }
  );

  it.each(['', ' ', undefined, null])(
    'accepts truly missing remaining %s with matching capacity',
    async remaining => {
      const initial = await create();
      const bean = await editFixture(initial.bean, {
        capacity: '250.0g',
        remaining,
      } as Partial<CoffeeBean>);
      expect(await call('update_bean', argsFor(bean))).toMatchObject({
        inventoryInitialized: true,
        bean: { capacityGrams: 250, remainingGrams: 250 },
      });
    }
  );

  it.each([{}, { zero: true }])(
    'initializes only when this request supplies capacity (%j)',
    async variant => {
      const initial = await create();
      const bean = await editFixture(initial.bean, { capacity: '250' });
      const args = argsFor(bean);
      const result = await call('update_bean', {
        ...args,
        changes: variant.zero ? capacityChange(0) : { name: 'Unrelated edit' },
      });
      expect(await saved(bean.id)).toMatchObject({
        capacity: variant.zero ? '0' : '250',
        remaining: variant.zero ? '0' : '',
      });
      expect(result.inventoryInitialized).toBe(variant.zero ? true : undefined);
    }
  );

  it.each([
    'ordinary',
    'tasting',
    'quick-decrement',
    'capacity-adjustment',
    'roasting-linked',
    'roasting-legacy-input',
    'roasting-multiple-inputs',
    'roasting-output',
  ])(
    'rejects retained %s history even when the bean version is unchanged',
    async kind => {
      const initial = await unknownWithCapacity();
      const note = history(initial.bean);
      if (kind === 'ordinary' || kind === 'tasting') {
        delete note.source;
        if (kind === 'tasting') note.params!.coffee = '';
      } else if (kind === 'capacity-adjustment') {
        note.source = 'capacity-adjustment';
        note.changeRecord = {
          capacityAdjustment: {
            originalAmount: 250,
            newAmount: 240,
            changeAmount: -10,
            changeType: 'decrease',
          },
        };
      } else if (kind.startsWith('roasting')) {
        note.source = 'roasting';
        if (kind !== 'roasting-linked') note.beanId = 'other-bean';
        note.changeRecord = {
          roastingRecord: {
            greenBeanId:
              kind === 'roasting-legacy-input'
                ? initial.bean.id
                : 'other-green',
            greenBeanName: 'Synthetic green bean',
            roastedAmount: 10,
            roastedBeanId:
              kind === 'roasting-output' ? initial.bean.id : 'other-output',
            ...(kind === 'roasting-multiple-inputs'
              ? {
                  inputs: [
                    {
                      greenBeanId: initial.bean.id,
                      greenBeanName: 'Synthetic green bean',
                      amount: 10,
                    },
                  ],
                }
              : {}),
          },
        };
      }
      await saveNote(note);
      expect((await current(initial.bean.id)).version).toBe(
        initial.bean.version
      );
      for (const tool of ['update_bean', 'adjust_bean_inventory'])
        await expect(
          call(tool, initializationArgs(tool, initial.bean))
        ).rejects.toMatchObject({ code: 'INVALID_ARGUMENT' });
      expect((await saved(initial.bean.id))?.remaining).toBe('');
      expect(await notes()).toHaveLength(1);
      expect(await receipts()).toBe(1);
    }
  );

  it.each(['source', 'multiple-sources', 'dependent', 'multiple-dependents'])(
    'rejects %s bean lineage even without surviving notes',
    async kind => {
      const initial = await unknownWithCapacity();
      let bean = initial.bean;
      if (kind === 'source' || kind === 'multiple-sources') {
        bean = await editFixture(
          bean,
          kind === 'source'
            ? { sourceGreenBeanId: 'green-origin' }
            : { sourceGreenBeanIds: ['green-origin'] }
        );
      } else {
        await saveBean({
          id: 'synthetic-dependent',
          timestamp: 1,
          name: 'Dependent output',
          ...(kind === 'dependent'
            ? { sourceGreenBeanId: bean.id }
            : { sourceGreenBeanIds: [bean.id] }),
        });
      }
      for (const tool of ['update_bean', 'adjust_bean_inventory'])
        await expect(
          call(tool, initializationArgs(tool, bean))
        ).rejects.toMatchObject({
          code: 'INVALID_ARGUMENT',
        });
      expect((await saved(bean.id))?.remaining).toBe('');
    }
  );

  it.each(['update_bean', 'adjust_bean_inventory'])(
    'checks newly queued history at execution for %s, not the earlier read',
    async tool => {
      const initial = await unknownWithCapacity();
      const args = initializationArgs(tool, initial.bean);
      const historyWrite = withDataMutation(() =>
        saveNote(history(initial.bean))
      );
      const initialization = call(tool, args);
      await historyWrite;
      await expect(initialization).rejects.toMatchObject({
        code: 'INVALID_ARGUMENT',
      });
      expect((await saved(initial.bean.id))?.remaining).toBe('');
      expect(await receipts()).toBe(1);
    }
  );

  it.each(['update_bean', 'adjust_bean_inventory'])(
    'does not block %s initialization because unrelated beans have history',
    async tool => {
      const initial = await unknownWithCapacity();
      const unrelated = await create(100);
      await saveNote(history(unrelated.bean));
      expect(
        await call(tool, initializationArgs(tool, initial.bean))
      ).toMatchObject({
        inventoryInitialized: true,
        bean: { capacityGrams: 250, remainingGrams: 250 },
      });
      expect((await saved(unrelated.bean.id))?.remaining).toBe('100');
      expect(await notes()).toHaveLength(1);
    }
  );

  it.each(['update_bean', 'adjust_bean_inventory'])(
    'replays one concurrent %s request and never initializes twice',
    async tool => {
      const initial = await unknownWithCapacity();
      const args = initializationArgs(tool, initial.bean);
      const results = await Promise.all([call(tool, args), call(tool, args)]);
      expect(results.map(result => result.replayed).sort()).toEqual([
        false,
        true,
      ]);
      for (const result of results)
        expect(result.inventoryInitialized).toBe(true);
      expect(results[0].bean).toEqual(results[1].bean);
      expect(await receipts()).toBe(2);
      expect(await notes()).toHaveLength(0);
      await expect(
        call(tool, {
          ...args,
          ...(tool === 'update_bean'
            ? { changes: capacityChange(300) }
            : { remainingGrams: 200 }),
        })
      ).rejects.toMatchObject({
        code: 'IDEMPOTENCY_CONFLICT',
      });
      expect((await saved(initial.bean.id))?.remaining).toBe('250');
    }
  );

  it.each(['update_bean', 'adjust_bean_inventory'])(
    'rejects concurrent distinct %s requests based on the same stale version',
    async tool => {
      const initial = await unknownWithCapacity();
      const results = await Promise.allSettled([
        call(tool, initializationArgs(tool, initial.bean)),
        call(tool, initializationArgs(tool, initial.bean)),
      ]);
      expect(
        results.filter(result => result.status === 'fulfilled')
      ).toHaveLength(1);
      const rejected = results.find(
        result => result.status === 'rejected'
      ) as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ code: 'CONFLICT' });
      expect(await receipts()).toBe(2);
      expect((await saved(initial.bean.id))?.remaining).toBe('250');
    }
  );

  it.each(['update_bean', 'adjust_bean_inventory'])(
    'rolls back %s and its receipt if receipt persistence fails',
    async tool => {
      const initial = await unknownWithCapacity();
      const before = await saved(initial.bean.id);

      const transaction = sqlite!.driver.transaction.bind(sqlite!.driver);
      vi.spyOn(sqlite!.driver, 'transaction').mockImplementation(work =>
        transaction(tx =>
          work({
            query: (sql, params) => tx.query(sql, params),
            execute: (sql, params) => {
              if (sql.startsWith('INSERT INTO mcp_operations'))
                throw new Error('synthetic receipt failure');
              return tx.execute(sql, params);
            },
          })
        )
      );

      await expect(
        call(tool, initializationArgs(tool, initial.bean))
      ).rejects.toThrow('synthetic receipt failure');
      expect(await saved(initial.bean.id)).toEqual(before);
      expect(await receipts()).toBe(1);
      expect(await notes()).toHaveLength(0);
    }
  );

  it.each(['update_bean', 'adjust_bean_inventory'])(
    'keeps a committed %s result after publication fails and replays without new stock',
    async tool => {
      const initial = await unknownWithCapacity();
      const args = initializationArgs(tool, initial.bean);
      const unavailable = async () => {
        throw new Error('synthetic UI unavailable');
      };
      setBusinessPublicationHost(unavailable);
      const result = await call(tool, args);
      expect(result).toMatchObject({
        inventoryInitialized: true,
        replayed: false,
      });
      expect(result.notificationWarning).toBeTruthy();
      setBusinessPublicationHost(async () => {});
      expect(await call(tool, args)).toMatchObject({
        inventoryInitialized: true,
        replayed: true,
      });
      expect(await saved(initial.bean.id)).toMatchObject({
        capacity: '250',
        remaining: '250',
      });
      expect(await receipts()).toBe(2);
      expect(await notes()).toHaveLength(0);
    }
  );
});
