import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/core/db';
import { bindDexieRepositories } from '@/lib/data/dexieRuntime';
import { brewingNoteRepository } from '@/lib/data/repositories';
import type { BrewingNote } from '@/lib/core/config';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';

vi.mock('@/lib/app/dataIntegrity', () => ({
  clearExpectedCoreDataDeletion: vi.fn(async () => {}),
  markExpectedCoreDataDeletionIfEmpty: vi.fn(async () => {}),
}));

const notes: BrewingNote[] = [
  { id: 'note-delete', timestamp: 10, rating: 4, taste: {}, notes: 'Delete' },
  { id: 'note-remove', timestamp: 20, rating: 3, taste: {}, notes: 'Remove' },
];

describe('brewingNoteStore image-aware deletion', () => {
  beforeEach(async () => {
    bindDexieRepositories();
    await Promise.all([
      db.brewingNotes.clear(),
      db.brewingNoteImages.clear(),
      db.brewingNoteImageThumbnails.clear(),
    ]);
    useBrewingNoteStore.setState({
      notes: [],
      isLoading: false,
      error: null,
      initialized: false,
    });
  });

  afterEach(async () => {
    await Promise.all([
      db.brewingNotes.clear(),
      db.brewingNoteImages.clear(),
      db.brewingNoteImageThumbnails.clear(),
    ]);
  });

  it('deletes note bodies, original images, and thumbnails through both store actions', async () => {
    await brewingNoteRepository.upsertMany(notes);
    for (const note of notes) {
      await db.brewingNoteImages.put({
        noteId: note.id,
        image: `original-${note.id}`,
        updatedAt: note.timestamp,
      });
      await db.brewingNoteImageThumbnails.put({
        noteId: note.id,
        imageThumbnail: `thumbnail-${note.id}`,
        updatedAt: note.timestamp,
      });
    }
    useBrewingNoteStore.getState().setNotes(notes);

    expect(await useBrewingNoteStore.getState().deleteNote('note-delete')).toBe(
      true
    );
    await useBrewingNoteStore.getState().removeNote('note-remove');

    expect(useBrewingNoteStore.getState().notes).toEqual([]);
    for (const note of notes) {
      expect(await brewingNoteRepository.get(note.id)).toBeUndefined();
      expect(await db.brewingNoteImages.get(note.id)).toBeUndefined();
      expect(await db.brewingNoteImageThumbnails.get(note.id)).toBeUndefined();
    }
  });
});
