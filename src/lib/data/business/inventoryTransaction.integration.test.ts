import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrewGuideDB } from '@/lib/core/db';
import type { BrewingNote } from '@/lib/core/config';
import { createDexieBrewingNotePersistence } from '@/lib/data/adapters/dexie/brewingNoteImageRepository';
import { createDexieBusinessUnitOfWork } from './dexieUnitOfWork';
import type { BusinessChange } from './types';

let database: BrewGuideDB;
const bean = {
  id: 'stock-bean',
  timestamp: 10,
  name: 'Coffee',
  capacity: '250',
  remaining: '250',
};
const note: BrewingNote = {
  id: 'brew-note',
  timestamp: 20,
  beanId: bean.id,
  rating: 4,
  taste: {},
  notes: 'Brew',
  params: { coffee: '15g' },
  images: ['data:image/png;base64,aW1hZ2U='],
};
beforeEach(async () => {
  await Dexie.delete('BrewGuideDB');
  database = new BrewGuideDB();
  await database.open();
  await database.coffeeBeans.put(bean);
  await database.appSettings.put({
    id: 'main',
    data: { supabaseSync: { enabled: true } } as never,
  });
});
afterEach(async () => {
  database.close();
  await Dexie.delete('BrewGuideDB');
});

async function saveNote() {
  const changes =
    await createDexieBrewingNotePersistence(database).saveWithInventory(note);
  const publications: BusinessChange[] = [
    { entity: 'brew_note', id: note.id, before: null, after: changes.note },
    ...changes.beans.map(after => ({
      entity: 'bean' as const,
      id: after.id,
      before: bean,
      after,
    })),
  ];
  return { result: { note: changes.note! }, changes: publications };
}
const command = () => ({
  tool: 'create_brew_note',
  args: { requestId: 'audit-brew-request', beanId: bean.id, grams: 15 },
  work: saveNote,
});

describe('real Dexie nested inventory transactions', () => {
  it('rolls back stock, note, images, sync intents and receipt after nested persistence succeeds then outer work fails', async () => {
    const publish = vi.fn(async () => {});
    const unit = createDexieBusinessUnitOfWork(database, publish);
    await expect(
      unit.execute({
        ...command(),
        work: async () => {
          await saveNote();
          throw new Error('injected failure after note persistence');
        },
      })
    ).rejects.toThrow('injected failure');
    expect(await database.coffeeBeans.get(bean.id)).toEqual(bean);
    expect(await database.brewingNotes.count()).toBe(0);
    expect(await database.brewingNoteImages.count()).toBe(0);
    expect(await database.pendingOperations.count()).toBe(0);
    expect(await database.businessOperations.count()).toBe(0);
    expect(await database.businessPublications.count()).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('keeps one stock decrement and one intent per record through publication failure, reopen and replay', async () => {
    const failedPublisher = vi.fn(async () => {
      throw new Error('UI failed');
    });
    const result = await createDexieBusinessUnitOfWork(
      database,
      failedPublisher
    ).execute(command());
    expect(result.publicationPending).toBe(true);
    expect((await database.coffeeBeans.get(bean.id))?.remaining).toBe('235');
    expect(await database.pendingOperations.count()).toBe(2);
    expect(await database.brewingNoteImages.get(note.id)).toMatchObject({
      images: note.images,
    });
    database.close();
    database = new BrewGuideDB();
    await database.open();
    const work = vi.fn(saveNote);
    const published = vi.fn(async () => {
      expect(Dexie.currentTransaction).toBeNull();
      expect((await database.coffeeBeans.get(bean.id))?.remaining).toBe('235');
    });
    const replay = await createDexieBusinessUnitOfWork(
      database,
      published
    ).execute({ ...command(), work });
    expect(replay).toMatchObject({ replayed: true, publicationPending: false });
    expect(work).not.toHaveBeenCalled();
    expect(await database.pendingOperations.count()).toBe(2);
    expect(await database.businessPublications.count()).toBe(0);
    expect(published).toHaveBeenCalledOnce();
  });

  it('keeps deletion sync timestamps newer than the deleted logical record', async () => {
    const future = Date.now() + 60_000;
    const existing = { ...note, updatedAt: future };
    await database.brewingNotes.put(existing);
    await database.coffeeBeans.put({ ...bean, remaining: '235' });
    await createDexieBusinessUnitOfWork(database, async () => {}).execute({
      tool: 'delete_brew_note',
      args: { requestId: 'audit-delete-request', id: note.id },
      work: async () => {
        const changes = await createDexieBrewingNotePersistence(
          database
        ).deleteWithInventory(note.id, { expectedRecord: existing });
        return {
          result: { deleted: note.id },
          changes: [
            {
              entity: 'brew_note' as const,
              id: note.id,
              before: existing,
              after: null,
            },
            ...changes.beans.map(after => ({
              entity: 'bean' as const,
              id: after.id,
              before: bean,
              after,
            })),
          ],
        };
      },
    });
    const queued = await database.pendingOperations
      .where('recordId')
      .equals(note.id)
      .first();
    expect(queued?.type).toBe('delete');
    expect(queued?.timestamp).toBeGreaterThan(future);
    expect((await database.coffeeBeans.get(bean.id))?.remaining).toBe('250');
  });
});
