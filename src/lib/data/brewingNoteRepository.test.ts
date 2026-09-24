import 'fake-indexeddb/auto';
import Dexie, { type Table } from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { BrewingNoteRepository } from '@/lib/data/contracts';
import { createDexieBrewingNoteRepository } from '@/lib/data/adapters/dexie/brewingNoteRepository';

class BrewingNoteRepositoryTestDatabase extends Dexie {
  brewingNotes!: Table<BrewingNote, string>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      brewingNotes:
        'id, timestamp, equipment, method, beanId, [beanId+timestamp]',
    });
  }
}

const makeNote = (
  id: string,
  beanId: string,
  timestamp: number,
  notes = id
): BrewingNote =>
  ({
    id,
    beanId,
    timestamp,
    updatedAt: timestamp + 1,
    equipment: 'V60',
    method: 'Pulse pour',
    params: {
      coffee: '15g',
      water: '225g',
      ratio: '1:15',
      grindSize: 'medium-fine',
      temp: '92°C',
      stages: [
        { label: 'Bloom', detail: 'wet grounds', water: '45g', duration: 30 },
        { label: 'Pour', detail: 'slow circle', water: '180g', duration: 60 },
      ],
    },
    coffeeBeanInfo: {
      name: `Coffee ${beanId}`,
      roastLevel: 'medium',
      roastDate: '2026-01-02',
    },
    rating: 4,
    taste: { sweetness: 4, acidity: 3, body: 2 },
    notes,
  }) as unknown as BrewingNote;

describe('Dexie BrewingNoteRepository adapter', () => {
  let testDb: BrewingNoteRepositoryTestDatabase;
  let repository: BrewingNoteRepository;

  beforeEach(async () => {
    testDb = new BrewingNoteRepositoryTestDatabase(
      `BrewGuideBrewingNoteRepositoryTest-${Date.now()}-${Math.random()}`
    );
    await testDb.open();
    repository = createDexieBrewingNoteRepository(testDb.brewingNotes);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  it('lists empty tables and returns undefined for a missing note', async () => {
    expect(await repository.list()).toEqual([]);
    expect(await repository.get('missing')).toBeUndefined();
    expect(await repository.count()).toBe(0);
  });

  it('saves and upserts by id while retaining note fields and nested values', async () => {
    const first = makeNote('note-1', 'bean-1', 123, 'First note');
    const updated = makeNote('note-1', 'bean-2', 456, 'Updated note');

    await repository.save(first);
    await repository.save(updated);

    expect(await repository.get('note-1')).toEqual(updated);
    expect(await repository.list()).toEqual([updated]);
    expect(await repository.count()).toBe(1);
    expect(await repository.get('note-1')).toMatchObject({
      id: 'note-1',
      beanId: 'bean-2',
      timestamp: 456,
      equipment: 'V60',
      method: 'Pulse pour',
      coffeeBeanInfo: {
        name: 'Coffee bean-2',
        roastLevel: 'medium',
        roastDate: '2026-01-02',
      },
      params: {
        coffee: '15g',
        stages: [
          { label: 'Bloom', detail: 'wet grounds', water: '45g', duration: 30 },
          { label: 'Pour', detail: 'slow circle', water: '180g', duration: 60 },
        ],
      },
      taste: { sweetness: 4, acidity: 3, body: 2 },
      notes: 'Updated note',
    });
  });

  it('bulk upserts, deletes individual and batched ids, and clears the table', async () => {
    const notes = [
      makeNote('note-a', 'bean-1', 11),
      makeNote('note-b', 'bean-1', 22),
      makeNote('note-c', 'bean-2', 33),
    ];

    await repository.upsertMany(notes);
    expect(await repository.count()).toBe(3);

    await repository.delete('note-a');
    await repository.deleteMany(['note-b']);
    expect(await repository.list()).toEqual([notes[2]]);

    await repository.clear();
    expect(await repository.list()).toEqual([]);
    expect(await repository.count()).toBe(0);
  });

  it('returns only one bean notes in the same descending timestamp order as the old compound query', async () => {
    await repository.upsertMany([
      makeNote('same-bean-late', 'bean-a', 900),
      makeNote('other-bean', 'bean-b', 1200),
      makeNote('same-bean-early', 'bean-a', 100),
      makeNote('same-bean-middle', 'bean-a', 450),
      makeNote('other-bean-early', 'bean-b', 50),
    ]);

    const oldCompoundQuery = await testDb.brewingNotes
      .where('[beanId+timestamp]')
      .between(['bean-a', Dexie.minKey], ['bean-a', Dexie.maxKey])
      .reverse()
      .toArray();

    expect(await repository.listByBeanId('bean-a')).toEqual(oldCompoundQuery);
    expect(
      (await repository.listByBeanId('bean-a')).map(note => note.id)
    ).toEqual(['same-bean-late', 'same-bean-middle', 'same-bean-early']);
  });
});
