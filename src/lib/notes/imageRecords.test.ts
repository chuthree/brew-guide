import { describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import { mergeBrewingNoteImages, splitBrewingNoteImages } from './imageRecords';

const baseNote: BrewingNote = {
  id: 'note-1',
  timestamp: 1,
  rating: 0,
  taste: {},
  notes: '',
};

describe('brewing note image records', () => {
  it('splits images out of the note payload', () => {
    const split = splitBrewingNoteImages({
      ...baseNote,
      image: 'front',
      images: ['front', 'second'],
    });

    expect(split.note.image).toBeUndefined();
    expect(split.note.images).toBeUndefined();
    expect(split.imageRecord).toMatchObject({
      noteId: 'note-1',
      image: 'front',
      images: ['front', 'second'],
    });
  });

  it('merges stored images back for export and editing', () => {
    expect(
      mergeBrewingNoteImages(baseNote, {
        noteId: 'note-1',
        image: 'front',
        images: ['front'],
        updatedAt: 1,
      })
    ).toMatchObject({
      image: 'front',
      images: ['front'],
    });
  });
});
