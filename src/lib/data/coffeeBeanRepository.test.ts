import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { CoffeeBeanRepository } from '@/lib/data/contracts';
import { createDexieCoffeeBeanRepository } from '@/lib/data/adapters/dexie/coffeeBeanRepository';

class CoffeeBeanRepositoryTestDatabase extends Dexie {
  coffeeBeans!: Table<CoffeeBean, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ coffeeBeans: 'id, timestamp, name, type' });
  }
}

const makeBean = (
  id: string,
  timestamp: number,
  name = 'Ethiopia'
): CoffeeBean =>
  ({
    id,
    timestamp,
    name,
    beanType: 'filter',
    blendComponents: [
      {
        origin: 'Ethiopia',
        process: 'Natural',
        variety: 'Heirloom',
        percentage: 70,
        note: { lot: 'Lot 12' },
      },
      {
        origin: 'Colombia',
        process: 'Washed',
        variety: 'Caturra',
        percentage: 30,
      },
    ],
  }) as CoffeeBean;

describe('Dexie CoffeeBeanRepository adapter', () => {
  let testDb: CoffeeBeanRepositoryTestDatabase;
  let repository: CoffeeBeanRepository;

  beforeEach(async () => {
    testDb = new CoffeeBeanRepositoryTestDatabase(
      `BrewGuideCoffeeBeanRepositoryTest-${Date.now()}-${Math.random()}`
    );
    await testDb.open();
    repository = createDexieCoffeeBeanRepository(testDb.coffeeBeans);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('lists empty tables and returns undefined for a missing bean', async () => {
    expect(await repository.list()).toEqual([]);
    expect(await repository.get('missing')).toBeUndefined();
    expect(await repository.count()).toBe(0);
  });

  it('saves and upserts by the unchanged id while preserving timestamp and nested blend data', async () => {
    const first = makeBean('bean-1', 123, 'First name');
    const updated = makeBean('bean-1', 456, 'Updated name');

    await repository.save(first);
    await repository.save(updated);

    expect(await repository.get('bean-1')).toEqual(updated);
    expect(await repository.list()).toEqual([updated]);
    expect(await repository.count()).toBe(1);
    expect(await repository.get('bean-1')).toMatchObject({
      id: 'bean-1',
      timestamp: 456,
      beanType: 'filter',
      blendComponents: [
        {
          origin: 'Ethiopia',
          process: 'Natural',
          variety: 'Heirloom',
          percentage: 70,
          note: { lot: 'Lot 12' },
        },
        {
          origin: 'Colombia',
          process: 'Washed',
          variety: 'Caturra',
          percentage: 30,
        },
      ],
    });
  });

  it('bulk upserts beans and preserves each id and nested blend structure', async () => {
    const beans = [makeBean('bean-a', 11), makeBean('bean-b', 22, 'Kenya')];

    await repository.upsertMany(beans);

    expect(await repository.count()).toBe(2);
    expect(await repository.list()).toEqual(beans);
  });

  it('deletes a bean by id and deletes batches of ids', async () => {
    await repository.upsertMany([
      makeBean('bean-a', 11),
      makeBean('bean-b', 22),
      makeBean('bean-c', 33),
    ]);

    await repository.delete('bean-a');
    await repository.deleteMany(['bean-b']);

    expect(await repository.list()).toEqual([makeBean('bean-c', 33)]);
  });

  it('clears all beans', async () => {
    await repository.save(makeBean('bean-1', 123));

    await repository.clear();

    expect(await repository.list()).toEqual([]);
    expect(await repository.count()).toBe(0);
  });
});
