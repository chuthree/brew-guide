import { describe, expect, it } from 'vitest';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import {
  mapLegacyBrewingNoteImages,
  mapLegacyCoffeeBeanImages,
} from './legacyImageMapper';

describe('legacy image precedence contract', () => {
  it('keeps bean image sources while reflecting current split-over-inline merge and thumbnail-table priority', () => {
    const bean = {
      id: 'bean-1',
      timestamp: 100,
      name: 'Bean',
      image: 'inline-front',
      backImage: 'inline-back',
    } as CoffeeBean;
    const resolution = mapLegacyCoffeeBeanImages(
      bean,
      {
        beanId: 'bean-1',
        image: 'split-front',
        backImage: 'split-back',
        imageThumbnail: 'embedded-thumbnail',
        backImageThumbnail: 'embedded-back-thumbnail',
        updatedAt: 100,
      },
      {
        beanId: 'bean-1',
        imageThumbnail: 'table-thumbnail',
        backImageThumbnail: 'back-table-thumbnail',
        updatedAt: 100,
      }
    );

    expect(resolution.mergedBean.image).toBe('split-front');
    expect(resolution.mergedBean.backImage).toBe('split-back');
    expect(resolution.canonicalOriginals).toEqual({
      front: 'split-front',
      back: 'split-back',
    });
    expect(resolution.originalConflicts).toEqual([
      {
        slot: 'front',
        inline: 'inline-front',
        split: 'split-front',
        selected: 'split-front',
        selectedSource: 'image-record',
      },
      {
        slot: 'back',
        inline: 'inline-back',
        split: 'split-back',
        selected: 'split-back',
        selectedSource: 'image-record',
      },
    ]);
    expect(resolution.exportedBean.image).toBe('split-front');
    expect(resolution.exportedBean.backImage).toBe('split-back');
    expect(resolution.repositoryOriginals).toEqual({
      front: 'split-front',
      back: 'split-back',
    });
    expect(resolution.repositoryThumbnails).toEqual({
      front: 'table-thumbnail',
      back: 'back-table-thumbnail',
    });
    expect(resolution.thumbnailGenerationFallback).toEqual({
      front: 'split-front',
      back: 'split-back',
    });
    expect(resolution.startupMigrationInlineOriginals).toEqual({
      front: 'inline-front',
      back: 'inline-back',
    });
    expect(resolution.startupMigrationWouldReplaceSplitRecord).toBe(true);
    expect(resolution.startupMigrationEmbeddedThumbnails).toEqual({
      front: 'embedded-thumbnail',
      back: 'embedded-back-thumbnail',
    });
    expect(resolution.candidates).toEqual([
      {
        slot: 'front',
        variant: 'original',
        origin: 'entity-inline',
        data: 'inline-front',
      },
      {
        slot: 'front',
        variant: 'original',
        origin: 'image-record',
        data: 'split-front',
      },
      {
        slot: 'front',
        variant: 'thumbnail',
        origin: 'image-record-embedded-thumbnail',
        data: 'embedded-thumbnail',
      },
      {
        slot: 'front',
        variant: 'thumbnail',
        origin: 'thumbnail-table',
        data: 'table-thumbnail',
      },
      {
        slot: 'back',
        variant: 'original',
        origin: 'entity-inline',
        data: 'inline-back',
      },
      {
        slot: 'back',
        variant: 'original',
        origin: 'image-record',
        data: 'split-back',
      },
      {
        slot: 'back',
        variant: 'thumbnail',
        origin: 'image-record-embedded-thumbnail',
        data: 'embedded-back-thumbnail',
      },
      {
        slot: 'back',
        variant: 'thumbnail',
        origin: 'thumbnail-table',
        data: 'back-table-thumbnail',
      },
    ]);
  });

  it('does not use embedded bean thumbnails as direct public sources when the thumbnail table is absent', () => {
    const resolution = mapLegacyCoffeeBeanImages(
      {
        id: 'bean-2',
        timestamp: 1,
        name: 'Bean',
        image: 'inline',
      } as CoffeeBean,
      {
        beanId: 'bean-2',
        image: 'split-original',
        imageThumbnail: 'embedded-thumbnail',
        updatedAt: 1,
      }
    );
    expect(resolution.repositoryThumbnails).toEqual({});
    expect(resolution.repositoryOriginals).toEqual({ front: 'split-original' });
    expect(resolution.thumbnailGenerationFallback.front).toBe('split-original');
    expect(resolution.startupMigrationInlineOriginals).toEqual({
      front: 'inline',
    });
    expect(resolution.startupMigrationWouldReplaceSplitRecord).toBe(true);
    expect(
      resolution.candidates.some(item => item.data === 'embedded-thumbnail')
    ).toBe(true);
    expect(resolution.exportedBean.image).toBe('split-original');
    const inlineOnly = mapLegacyCoffeeBeanImages({
      id: 'bean-inline-only',
      timestamp: 1,
      name: 'Bean',
      image: 'inline',
    } as CoffeeBean);
    expect(inlineOnly.canonicalOriginals).toEqual({ front: 'inline' });
    expect(inlineOnly.originalConflicts).toEqual([]);
    expect(inlineOnly.exportedBean.image).toBeUndefined();
  });

  it('uses note images[] over image, then split records over inline, and preserves order', () => {
    const note = {
      id: 'note-1',
      timestamp: 100,
      image: 'inline-single',
      images: ['inline-first', 'inline-second'],
      rating: 4,
      taste: {},
      notes: '',
    } as BrewingNote;
    const resolution = mapLegacyBrewingNoteImages(
      note,
      {
        noteId: 'note-1',
        image: 'split-single',
        images: ['split-first', 'split-second'],
        updatedAt: 100,
      },
      {
        noteId: 'note-1',
        imageThumbnail: 'ignored-thumbnail',
        imageThumbnails: ['ignored-thumb-0', 'ignored-thumb-1'],
        updatedAt: 100,
      }
    );

    expect(resolution.publicReadImages).toEqual([
      'split-first',
      'split-second',
    ]);
    expect(resolution.canonicalOriginals).toEqual([
      'split-first',
      'split-second',
    ]);
    expect(resolution.originalConflicts).toEqual([
      {
        position: 0,
        inline: 'inline-first',
        split: 'split-first',
        selected: 'split-first',
        inlineField: 'images',
        splitField: 'images',
        selectedSource: 'image-record',
      },
      {
        position: 1,
        inline: 'inline-second',
        split: 'split-second',
        selected: 'split-second',
        inlineField: 'images',
        splitField: 'images',
        selectedSource: 'image-record',
      },
    ]);
    expect(resolution.startupMigrationInlineImages).toEqual([
      'inline-first',
      'inline-second',
    ]);
    expect(resolution.startupMigrationWouldReplaceSplitRecord).toBe(true);
    expect(resolution.mergedNote.image).toBe('split-first');
    expect(resolution.mergedNote.images).toEqual([
      'split-first',
      'split-second',
    ]);
    expect(resolution.exportedNote.images).toEqual([
      'split-first',
      'split-second',
    ]);
    expect(resolution.publicReadThumbnails).toEqual([]);
    expect(
      resolution.candidates.filter(item => item.variant === 'thumbnail')
    ).toEqual([
      {
        position: 0,
        variant: 'thumbnail',
        origin: 'thumbnail-table',
        field: 'imageThumbnail',
        data: 'ignored-thumbnail',
      },
      {
        position: 0,
        variant: 'thumbnail',
        origin: 'thumbnail-table',
        field: 'imageThumbnails',
        data: 'ignored-thumb-0',
      },
      {
        position: 1,
        variant: 'thumbnail',
        origin: 'thumbnail-table',
        field: 'imageThumbnails',
        data: 'ignored-thumb-1',
      },
    ]);
    expect(
      resolution.candidates
        .filter(item => item.variant === 'original')
        .map(({ origin, field, data }) => [origin, field, data])
    ).toEqual([
      ['entity-inline', 'image', 'inline-single'],
      ['entity-inline', 'images', 'inline-first'],
      ['entity-inline', 'images', 'inline-second'],
      ['image-record', 'image', 'split-single'],
      ['image-record', 'images', 'split-first'],
      ['image-record', 'images', 'split-second'],
    ]);
  });

  it('falls back to inline note images when a split record has no usable original', () => {
    const note = {
      id: 'note-2',
      timestamp: 100,
      image: 'inline-single',
      images: ['inline-first', 'inline-second'],
      rating: 0,
      taste: {},
      notes: '',
    } as BrewingNote;
    const resolution = mapLegacyBrewingNoteImages(note, {
      noteId: 'note-2',
      images: [],
      updatedAt: 100,
    });
    expect(resolution.publicReadImages).toEqual([
      'inline-first',
      'inline-second',
    ]);
    expect(resolution.canonicalOriginals).toEqual([
      'inline-first',
      'inline-second',
    ]);
    expect(resolution.originalConflicts).toEqual([]);
    expect(resolution.exportedNote.images).toBeUndefined();
  });
});
