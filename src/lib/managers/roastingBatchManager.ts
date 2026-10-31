import { roastingPersistence } from '@/lib/data/repositories';
import { getCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { getBrewingNoteStore } from '@/lib/stores/brewingNoteStore';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import type { RoastingCommand } from '@/lib/coffee-beans/roastingBatch';

export async function saveRoastingBatchInMutation(command: RoastingCommand) {
  const changes = await roastingPersistence.save(command);
  const beanStore = getCoffeeBeanStore();
  const updated = new Map(changes.beans.map(bean => [bean.id, bean]));
  beanStore.setBeans([
    ...beanStore.beans.filter(
      bean => !updated.has(bean.id) && bean.id !== changes.deletedBeanId
    ),
    ...changes.beans,
  ]);
  const noteStore = getBrewingNoteStore();
  // Preserve lazy note loading; a partial cache must not become initialized.
  if (noteStore.initialized)
    noteStore.setNotes([
      ...noteStore.notes.filter(note => note.id !== command.noteId),
      ...(changes.note ? [changes.note] : []),
    ]);
  if (typeof window !== 'undefined') {
    for (const bean of changes.beans)
      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: { action: 'update', beanId: bean.id, bean },
        })
      );
    if (changes.deletedBeanId)
      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: { action: 'delete', beanId: changes.deletedBeanId },
        })
      );
    if (changes.note)
      window.dispatchEvent(
        new CustomEvent('brewingNoteDataChanged', {
          detail: {
            action: 'update',
            noteId: changes.note.id,
            note: changes.note,
          },
        })
      );
    if (changes.deletedNoteId)
      window.dispatchEvent(
        new CustomEvent('brewingNoteDataChanged', {
          detail: { action: 'delete', noteId: changes.deletedNoteId },
        })
      );
    window.dispatchEvent(new CustomEvent('brewingNotesUpdated'));
    if (changes.note)
      window.dispatchEvent(
        new CustomEvent('roastingRecordSaved', { detail: changes.note })
      );
  }
  return changes;
}

export const saveRoastingBatch = (command: Omit<RoastingCommand, 'now'>) =>
  withDataMutation(() =>
    saveRoastingBatchInMutation({ ...command, now: Date.now() })
  );
