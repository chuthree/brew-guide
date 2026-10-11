import { describe, expect, it } from 'vitest';
import type { BrewingNote } from '@/lib/core/config';
import { normalizeBrewingNote, normalizeLegacyBrewingNote } from './cleanup';

describe('normalizeBrewingNote', () => {
  it('fills missing taste ratings from CLI-created notes', () => {
    const note = {
      id: 'note-cli',
      timestamp: 1781665593757,
      method: '挂耳包',
      rating: 4.4,
      notes: 'CLI 写入的记录',
    } as BrewingNote;

    const normalized = normalizeBrewingNote(note);

    expect(normalized.changed).toBe(true);
    expect(normalized.note.taste).toEqual({});
  });

  it('removes legacy embedded coffee bean snapshots', () => {
    const note = {
      id: 'note-legacy',
      timestamp: 1,
      rating: 0,
      taste: {},
      notes: '',
      coffeeBean: { name: 'legacy' },
    } as BrewingNote & { coffeeBean: unknown };

    const normalized = normalizeBrewingNote(note);

    expect(normalized.changed).toBe(true);
    expect('coffeeBean' in normalized.note).toBe(false);
  });

  it('keeps notes that need no normalization unchanged, including inline images', () => {
    const note = {
      id: 'note-current',
      timestamp: 1,
      rating: 4,
      taste: {},
      notes: 'current',
      image: 'data:image/jpeg;base64,inline',
    } as BrewingNote;

    const normalized = normalizeLegacyBrewingNote(note);

    expect(normalized.changed).toBe(false);
    expect(normalized.note).toBe(note);
    expect(normalized.note.image).toBe('data:image/jpeg;base64,inline');
    expect(normalized.imageRecord).toBeUndefined();
  });

  it('normalizes and extracts a legacy singular image field', () => {
    const note = {
      id: 'note-image',
      timestamp: 123,
      rating: 4,
      taste: null,
      notes: 'legacy image',
      image: 'data:image/jpeg;base64,single',
    } as unknown as BrewingNote;

    const normalized = normalizeLegacyBrewingNote(note);

    expect(normalized.changed).toBe(true);
    expect(normalized.note.taste).toEqual({});
    expect(normalized.note).not.toHaveProperty('image');
    expect(normalized.imageRecord).toEqual({
      noteId: 'note-image',
      image: 'data:image/jpeg;base64,single',
      images: ['data:image/jpeg;base64,single'],
      updatedAt: 123,
    });
  });

  it('prefers a legacy images array when both inline fields are present', () => {
    const note = {
      id: 'note-images',
      timestamp: 456,
      rating: 4,
      taste: {},
      notes: 'legacy images',
      coffeeBean: { name: 'legacy snapshot' },
      image: 'data:image/jpeg;base64,singular',
      images: [
        'data:image/jpeg;base64,first',
        '',
        'data:image/jpeg;base64,second',
      ],
    } as unknown as BrewingNote;

    const normalized = normalizeLegacyBrewingNote(note);

    expect(normalized.changed).toBe(true);
    expect(normalized.note).not.toHaveProperty('coffeeBean');
    expect(normalized.note).not.toHaveProperty('image');
    expect(normalized.note).not.toHaveProperty('images');
    expect(normalized.imageRecord).toEqual({
      noteId: 'note-images',
      image: 'data:image/jpeg;base64,first',
      images: ['data:image/jpeg;base64,first', 'data:image/jpeg;base64,second'],
      updatedAt: 456,
    });
  });
});
