import { describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean } from '@/types/app';
import { filterNotesByBeanState } from './noteListModel';

const createNote = (
  id: string,
  overrides: Partial<BrewingNote> = {}
): BrewingNote => ({
  id,
  timestamp: 1,
  rating: 0,
  taste: {},
  notes: '',
  ...overrides,
});

describe('filterNotesByBeanState', () => {
  it('keeps records linked to green beans and restores the full list for roasted mode', () => {
    const beans: CoffeeBean[] = [
      { id: 'green', name: 'Green', timestamp: 1, beanState: 'green' },
      { id: 'roasted', name: 'Roasted', timestamp: 1, beanState: 'roasted' },
    ];
    const greenBrew = createNote('green-brew', { beanId: 'green' });
    const roastingRecord = createNote('green-roast', {
      source: 'roasting',
      changeRecord: {
        roastingRecord: {
          greenBeanId: 'green',
          greenBeanName: 'Green',
          roastedAmount: 20,
        },
      },
    });
    const roastedBrew = createNote('roasted-brew', { beanId: 'roasted' });
    const unlinkedNote = createNote('unlinked');
    const notes = [greenBrew, roastingRecord, roastedBrew, unlinkedNote];

    expect(
      filterNotesByBeanState(notes, 'green', beans).map(note => note.id)
    ).toEqual(['green-brew', 'green-roast']);
    expect(filterNotesByBeanState(notes, 'roasted', beans)).toBe(notes);
  });
});
