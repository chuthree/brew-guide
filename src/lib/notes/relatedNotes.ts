import Dexie from 'dexie';
import { db } from '@/lib/core/db';
import type { BrewingNote } from '@/lib/core/config';
import { mergeNoteWithStoredImages } from '@/lib/notes/imageRepository';

export async function getRelatedNotesForBean(
  beanId: string
): Promise<BrewingNote[]> {
  return db.brewingNotes
    .where('[beanId+timestamp]')
    .between([beanId, Dexie.minKey], [beanId, Dexie.maxKey])
    .reverse()
    .toArray();
}

export async function getBrewingNoteById(
  noteId: string
): Promise<BrewingNote | undefined> {
  const note = await db.brewingNotes.get(noteId);
  return note ? mergeNoteWithStoredImages(note) : undefined;
}

export async function getBrewingNotes(): Promise<BrewingNote[]> {
  return db.brewingNotes.toArray();
}
