'use client';

import { useEffect, useState } from 'react';
import {
  getBrewingNoteImageNoteIds,
  getBrewingNoteImages,
} from '@/lib/notes/imageRepository';

const EMPTY_IMAGES: string[] = [];

export function useBrewingNoteImageIds(noteIds: string[]): Set<string> {
  const [imageIds, setImageIds] = useState<Set<string>>(new Set());
  const idsKey = noteIds.join('\u0001');

  useEffect(() => {
    let cancelled = false;

    getBrewingNoteImageNoteIds(noteIds)
      .then(ids => {
        if (!cancelled) setImageIds(new Set(ids));
      })
      .catch(() => {
        if (!cancelled) setImageIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return imageIds;
}

export function useBrewingNoteImages(
  noteId: string | undefined,
  fallback: string[] = EMPTY_IMAGES
): string[] {
  const [images, setImages] = useState<string[]>(fallback);
  const fallbackKey = fallback.join('\u0001');

  useEffect(() => {
    let cancelled = false;

    if (!noteId) {
      setImages(fallback);
      return;
    }

    getBrewingNoteImages(noteId)
      .then(storedImages => {
        if (!cancelled)
          setImages(storedImages.length > 0 ? storedImages : fallback);
      })
      .catch(() => {
        if (!cancelled) setImages(fallback);
      });

    return () => {
      cancelled = true;
    };
  }, [noteId, fallbackKey]);

  return images;
}

export function useBrewingNoteImagesWhenVisible(
  noteId: string,
  fallback: string[] = EMPTY_IMAGES
): { ref: (node: HTMLElement | null) => void; images: string[] } {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (shouldLoad || !target) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [shouldLoad, target]);

  return {
    ref: setTarget,
    images: useBrewingNoteImages(
      shouldLoad ? noteId : undefined,
      shouldLoad ? fallback : EMPTY_IMAGES
    ),
  };
}
