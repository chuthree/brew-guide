import { nanoid } from 'nanoid';
import type { BrewingNote } from '@/lib/core/config';
import type { BrewingNoteData } from '@/types/app';

export const createBrewingNoteCopyData = (
  note: BrewingNote,
  timestamp = Date.now(),
  id = nanoid()
): Partial<BrewingNoteData> => {
  if (note.source === 'roasting') {
    throw new Error('Roasting records must use the roasting copy flow');
  }

  return {
    timestamp,
    equipment: note.equipment,
    method: note.method,
    params: note.params,
    coffeeBeanInfo: note.coffeeBeanInfo || {
      name: '',
      roastLevel: '',
    },
    image: undefined,
    rating: note.rating,
    taste: note.taste,
    notes: note.notes,
    totalTime: note.totalTime,
    beanId: note.beanId,
    id,
    ...(note.source && {
      source: note.source,
      quickDecrementAmount: note.quickDecrementAmount,
      changeRecord: note.changeRecord,
    }),
  };
};
