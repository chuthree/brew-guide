'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getBrewingNoteImageCounts,
  getBrewingNoteImageNoteIds,
  getBrewingNoteImages,
} from '@/lib/notes/imageRepository';
import { useImageLoadGate } from './useImageLoadGate';

const EMPTY_IMAGES: string[] = [];

interface BrewingNoteImagesState {
  noteId: string | undefined;
  images: string[];
}

export function useBrewingNoteImageIds(noteIds: string[]): Set<string> {
  const [imageIds, setImageIds] = useState<Set<string>>(new Set());
  const idsKey = noteIds.join('\u0001');
  const imageNoteIds = useMemo(
    () => (idsKey ? idsKey.split('\u0001') : []),
    [idsKey]
  );

  useEffect(() => {
    let cancelled = false;

    getBrewingNoteImageNoteIds(imageNoteIds)
      .then(ids => {
        if (!cancelled) setImageIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setImageIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [imageNoteIds]);

  return imageIds;
}

export function useBrewingNoteImageCounts(
  noteIds: string[],
  versionKey = ''
): Map<string, number> {
  const [imageCounts, setImageCounts] = useState<Map<string, number>>(
    new Map()
  );
  const idsKey = noteIds.join('\u0001');
  const imageNoteIds = useMemo(
    () => (idsKey ? idsKey.split('\u0001') : []),
    [idsKey]
  );

  useEffect(() => {
    let cancelled = false;

    getBrewingNoteImageCounts(imageNoteIds)
      .then(counts => {
        if (!cancelled) setImageCounts(counts);
      })
      .catch(() => {
        if (!cancelled) setImageCounts(new Map());
      });

    return () => {
      cancelled = true;
    };
  }, [imageNoteIds, versionKey]);

  return imageCounts;
}

export function useBrewingNoteImages(
  noteId: string | undefined,
  fallback: string[] = EMPTY_IMAGES
): string[] {
  const [imageState, setImageState] = useState<BrewingNoteImagesState>({
    noteId,
    images: fallback,
  });

  useEffect(() => {
    let cancelled = false;

    if (!noteId) {
      return;
    }

    getBrewingNoteImages(noteId)
      .then(storedImages => {
        if (!cancelled)
          setImageState({
            noteId,
            images: storedImages.length > 0 ? storedImages : fallback,
          });
      })
      .catch(() => {
        if (!cancelled) setImageState({ noteId, images: fallback });
      });

    return () => {
      cancelled = true;
    };
  }, [noteId, fallback]);

  if (!noteId) {
    return fallback;
  }

  return imageState.noteId === noteId ? imageState.images : fallback;
}

export function useBrewingNoteImagesWhenVisible(
  noteId: string,
  fallback: string[] = EMPTY_IMAGES
): { ref: (node: HTMLElement | null) => void; images: string[] } {
  const { ref, shouldLoad } = useImageLoadGate();

  return {
    ref,
    images: useBrewingNoteImages(
      shouldLoad ? noteId : undefined,
      shouldLoad ? fallback : EMPTY_IMAGES
    ),
  };
}
