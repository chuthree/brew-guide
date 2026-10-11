import type { BrewingNote } from '@/lib/core/config';
import {
  brewingNoteImageRepository,
  brewingNoteRepository,
} from '@/lib/data/repositories';

export async function getRelatedNotesForBean(
  beanId: string
): Promise<BrewingNote[]> {
  return brewingNoteRepository.listByBeanId(beanId);
}

export async function getBrewingNoteById(
  noteId: string
): Promise<BrewingNote | undefined> {
  const note = await brewingNoteRepository.get(noteId);
  return note ? brewingNoteImageRepository.mergeNote(note) : undefined;
}

export async function getBrewingNotes(): Promise<BrewingNote[]> {
  return brewingNoteRepository.list();
}
