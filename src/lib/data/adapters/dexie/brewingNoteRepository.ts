import Dexie, { type Table } from 'dexie';
import { db } from '@/lib/core/db';
import type { BrewingNote } from '@/lib/core/config';
import type { BrewingNoteRepository } from '@/lib/data/contracts';

export function createDexieBrewingNoteRepository(
  table: Table<BrewingNote, string> = db.brewingNotes
): BrewingNoteRepository {
  return {
    list() {
      return table.toArray();
    },

    listByBeanId(beanId) {
      return table
        .where('[beanId+timestamp]')
        .between([beanId, Dexie.minKey], [beanId, Dexie.maxKey])
        .reverse()
        .toArray();
    },

    get(id) {
      return table.get(id);
    },

    count() {
      return table.count();
    },

    async save(note) {
      await table.put(note);
    },

    async upsertMany(notes) {
      if (notes.length > 0) {
        await table.bulkPut(notes);
      }
    },

    async delete(id) {
      await table.delete(id);
    },

    async deleteMany(ids) {
      if (ids.length > 0) {
        await table.bulkDelete(ids);
      }
    },

    async clear() {
      await table.clear();
    },
  };
}

export const brewingNoteRepository = createDexieBrewingNoteRepository();
