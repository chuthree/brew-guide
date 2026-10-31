import type { BrewingNote } from '@/lib/core/config';
import { noteUsesBean } from '@/lib/coffee-beans/roastingBatch';
import {
  brewingNoteImageRepository,
  brewingNoteRepository,
} from '@/lib/data/repositories';

export async function getRelatedNotesForBean(
  beanId: string
): Promise<BrewingNote[]> {
  return (await brewingNoteRepository.list())
    .filter(
      note =>
        noteUsesBean(note, beanId) ||
        (note.source === 'roasting' &&
          note.changeRecord?.roastingRecord?.roastedBeanId === beanId)
    )
    .sort((a, b) => b.timestamp - a.timestamp);
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
