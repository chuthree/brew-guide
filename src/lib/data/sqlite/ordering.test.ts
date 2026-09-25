import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { PendingOperation } from '@/lib/supabase/realtime/types';
import { createDexieBrewingNoteRepository } from '@/lib/data/adapters/dexie/brewingNoteRepository';
import { createDexieOfflineQueueRepository } from '@/lib/data/adapters/dexie/offlineQueueRepository';

class OrderingTestDatabase extends Dexie {
  brewingNotes!: Table<BrewingNote, string>;
  pendingOperations!: Table<PendingOperation, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      brewingNotes: 'id, timestamp, beanId, [beanId+timestamp]',
      pendingOperations: 'id, table, recordId, timestamp',
    });
  }
}

const note = (id: string, timestamp: number, beanId = 'bean-1'): BrewingNote =>
  ({
    id,
    beanId,
    timestamp,
    rating: 3,
    taste: {},
    notes: id,
  }) as BrewingNote;

const operation = (id: string, timestamp: number): PendingOperation => ({
  id,
  table: 'coffee_beans',
  type: 'upsert',
  recordId: `bean-${id}`,
  timestamp,
  retryCount: 0,
});

describe('current Dexie ordering observed by SQLite contract tests', () => {
  let database: OrderingTestDatabase;

  beforeEach(async () => {
    database = new OrderingTestDatabase(
      `BrewGuideSqliteOrdering-${Date.now()}-${Math.random()}`
    );
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('freezes newest-first compound note ordering including equal timestamps', async () => {
    const repository = createDexieBrewingNoteRepository(database.brewingNotes);
    await database.brewingNotes.bulkPut([
      note('tie-a', 500),
      note('tie-z', 500),
      note('newest-a', 900),
      note('other-bean', 1200, 'bean-2'),
      note('oldest', 100),
    ]);

    const actual = await repository.listByBeanId('bean-1');
    expect(actual.map(row => row.id)).toEqual([
      'newest-a',
      'tie-z',
      'tie-a',
      'oldest',
    ]);
  });

  it('freezes ascending offline queue ordering including equal timestamps', async () => {
    const repository = createDexieOfflineQueueRepository(
      database.pendingOperations
    );
    await database.pendingOperations.bulkPut([
      operation('tie-z', 200),
      operation('tie-a', 200),
      operation('later', 300),
      operation('earlier', 100),
    ]);

    const actual = await repository.listOrdered();
    expect(actual.map(row => row.id)).toEqual([
      'earlier',
      'tie-a',
      'tie-z',
      'later',
    ]);
  });
});
