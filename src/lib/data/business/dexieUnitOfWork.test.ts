import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { BrewGuideDB } from '@/lib/core/db';
import { createDexieBusinessUnitOfWork } from './dexieUnitOfWork';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import { assertBusinessVersion, businessRecordVersion } from './versions';

let database: BrewGuideDB;
beforeEach(async () => {
  await Dexie.delete('BrewGuideDB');
  database = new BrewGuideDB();
  await database.open();
});
afterEach(async () => {
  database.close();
  await Dexie.delete('BrewGuideDB');
});
const signal = () => new AbortController().signal;
const bean = (name = 'Before') => ({
  id: 'bean',
  name,
  timestamp: 1,
  capacity: '100',
  remaining: '100',
});
function command(requestId = 'request-0001') {
  return {
    tool: 'update_bean',
    args: { requestId, name: 'After' },
    signal: signal(),
    work: async () => {
      const before = await database.coffeeBeans.get('bean');
      await database.coffeeBeans.put(bean('After'));
      return {
        result: { bean: bean('After') },
        changes: [
          {
            entity: 'bean' as const,
            id: 'bean',
            before: before ?? null,
            after: bean('After'),
          },
        ],
      };
    },
  };
}

describe('durable Dexie business unit of work', () => {
  it('commits data, receipt and sync intent atomically, publishing only after commit', async () => {
    await database.coffeeBeans.put(bean());
    await database.appSettings.put({
      id: 'main',
      data: { supabaseSync: { enabled: true } } as never,
    });
    const publish = vi.fn(async () => {
      expect(Dexie.currentTransaction).toBeNull();
      expect((await database.coffeeBeans.get('bean'))?.name).toBe('After');
      expect(await database.businessOperations.count()).toBe(1);
    });
    const unit = createDexieBusinessUnitOfWork(database, publish);
    expect(await unit.execute(command())).toMatchObject({
      replayed: false,
      publicationPending: false,
    });
    expect(await database.pendingOperations.count()).toBe(1);
    expect(await database.businessPublications.count()).toBe(0);
    expect(publish).toHaveBeenCalledOnce();
  });

  it('replays after database reopen without rerunning business work', async () => {
    const unit = createDexieBusinessUnitOfWork(database, async () => {});
    await unit.execute(command());
    database.close();
    database = new BrewGuideDB();
    await database.open();
    const work = vi.fn(command().work);
    const replay = await createDexieBusinessUnitOfWork(
      database,
      async () => {}
    ).execute({ ...command(), work });
    expect(replay.replayed).toBe(true);
    expect(work).not.toHaveBeenCalled();
    expect(await database.businessOperations.count()).toBe(1);
  });

  it('skips foreign preparation on durable replay and prepares outside a database transaction', async () => {
    const unit = createDexieBusinessUnitOfWork(database, async () => {});
    const prepare = vi.fn(async () => {
      expect(Dexie.currentTransaction).toBeNull();
    });
    await unit.execute({ ...command(), prepare });
    const failingDecoder = vi.fn(async () => {
      throw new Error('decoder unavailable');
    });
    expect(
      await unit.execute({ ...command(), prepare: failingDecoder })
    ).toMatchObject({ replayed: true });
    expect(prepare).toHaveBeenCalledOnce();
    expect(failingDecoder).not.toHaveBeenCalled();
  });

  it('rejects a reused id with changed arguments', async () => {
    const unit = createDexieBusinessUnitOfWork(database, async () => {});
    await unit.execute(command());
    await expect(
      unit.execute({
        ...command(),
        args: { requestId: 'request-0001', name: 'Other' },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
    expect((await database.coffeeBeans.get('bean'))?.name).toBe('After');
  });

  it('rolls back every table and receipt when work fails or cancellation precedes commit', async () => {
    await database.coffeeBeans.put(bean());
    const publish = vi.fn(async () => {});
    const unit = createDexieBusinessUnitOfWork(database, publish);
    await expect(
      unit.execute({
        ...command(),
        work: async () => {
          await database.coffeeBeans.put(bean('Broken'));
          throw new Error('failure');
        },
      })
    ).rejects.toThrow('failure');
    const controller = new AbortController();
    await expect(
      unit.execute({
        ...command(),
        signal: controller.signal,
        work: async () => {
          const result = await command().work();
          controller.abort();
          return result;
        },
      })
    ).rejects.toThrow();
    expect((await database.coffeeBeans.get('bean'))?.name).toBe('Before');
    expect(await database.businessOperations.count()).toBe(0);
    expect(await database.businessPublications.count()).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('retains committed receipt and pending publication on UI failure, then recovers without mutation', async () => {
    const publish = vi.fn(async () => {
      throw new Error('UI unavailable');
    });
    const unit = createDexieBusinessUnitOfWork(database, publish);
    expect(await unit.execute(command())).toMatchObject({
      publicationPending: true,
      replayed: false,
    });
    expect((await database.coffeeBeans.get('bean'))?.name).toBe('After');
    expect(await database.businessPublications.count()).toBe(1);
    const recovered = createDexieBusinessUnitOfWork(database, async changes => {
      expect(changes[0].id).toBe('bean');
    });
    expect(await recovered.recoverPublications()).toEqual({
      published: 1,
      pending: 0,
    });
    expect(await database.businessOperations.count()).toBe(1);
  });

  it('keeps crypto version checks within the active transaction and rejects stale versions', async () => {
    await database.coffeeBeans.put(bean());
    const version = await businessRecordVersion(bean());
    const unit = createDexieBusinessUnitOfWork(database, async () => {});
    await unit.execute({
      ...command(),
      work: async () => {
        await assertBusinessVersion(
          await database.coffeeBeans.get('bean'),
          version
        );
        return command().work();
      },
    });
    await expect(
      unit.execute({
        ...command('request-0002'),
        work: async () => {
          await assertBusinessVersion(
            await database.coffeeBeans.get('bean'),
            version
          );
          return command().work();
        },
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await database.businessOperations.count()).toBe(1);
  });

  it('cancels a queued command before it acquires the transaction', async () => {
    let release!: () => void;
    const blocking = withDataMutation(
      () =>
        new Promise<void>(resolve => {
          release = resolve;
        })
    );
    await new Promise(resolve => setTimeout(resolve, 0));
    const controller = new AbortController();
    const work = vi.fn(command().work);
    const unit = createDexieBusinessUnitOfWork(database, async () => {});
    const running = unit.execute({
      ...command(),
      signal: controller.signal,
      work,
    });
    controller.abort();
    release();
    await blocking;
    await expect(running).rejects.toThrow();
    expect(work).not.toHaveBeenCalled();
    expect(await database.businessOperations.count()).toBe(0);
  });

  it('preserves monotonic deletion sync timestamps already queued by persistence', async () => {
    await database.appSettings.put({
      id: 'main',
      data: { supabaseSync: { enabled: true } } as never,
    });
    const future = Date.now() + 100000;
    const unit = createDexieBusinessUnitOfWork(database, async () => {});
    await unit.execute({
      ...command(),
      work: async () => {
        await database.pendingOperations.add({
          id: 'existing',
          table: 'coffee_beans',
          recordId: 'bean',
          type: 'delete',
          timestamp: future + 50,
          retryCount: 0,
        });
        return {
          result: { deleted: true },
          changes: [
            {
              entity: 'bean',
              id: 'bean',
              before: { timestamp: future },
              after: null,
            },
          ],
        };
      },
    });
    const queued = await database.pendingOperations.toArray();
    expect(queued).toHaveLength(1);
    expect(queued[0].timestamp).toBe(future + 50);
    expect(queued[0].type).toBe('delete');
  });

  it('serializes concurrent executions of one request across separate database connections', async () => {
    const other = new BrewGuideDB();
    await other.open();
    try {
      const one = createDexieBusinessUnitOfWork(database, async () => {});
      const two = createDexieBusinessUnitOfWork(other, async () => {});
      const work = vi.fn(async (active: BrewGuideDB) => {
        await active.coffeeBeans.put(bean('After'));
        return { result: { bean: bean('After') }, changes: [] };
      });
      const results = await Promise.all([
        one.execute({ ...command(), work: () => work(database) }),
        two.execute({ ...command(), work: () => work(other) }),
      ]);
      expect(work).toHaveBeenCalledOnce();
      expect(results.map(result => result.replayed).sort()).toEqual([
        false,
        true,
      ]);
    } finally {
      other.close();
    }
  });
});
