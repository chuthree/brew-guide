'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getBrewingNoteImageCounts,
  getBrewingNoteImageNoteIds,
  getBrewingNoteImages,
} from '@/lib/notes/imageRepository';
import { useImageLoadGate } from './useImageLoadGate';

const EMPTY_IMAGES: string[] = [];
const EMPTY_IMAGE_COUNTS = new Map<string, number>();

interface BrewingNoteImagesState {
  noteId: string | undefined;
  images: string[];
}

interface BrewingNoteDataChangedDetail {
  noteId?: string;
  note?: { id?: string };
}

type ImageRefreshSubscriber = () => void;
type ImageIdsRefreshSubscriber = (noteId?: string) => void;

const imageRefreshSubscribers = new Map<
  string,
  Set<ImageRefreshSubscriber>
>();
const imageIdsRefreshSubscribers = new Set<ImageIdsRefreshSubscriber>();
let isBrewingNoteDataChangedListenerAttached = false;

const getBrewingNoteDataChangedNoteId = (
  detail: BrewingNoteDataChangedDetail | undefined
): string | undefined => detail?.noteId || detail?.note?.id;

const notifyImageRefreshSubscribers = (noteId: string | undefined): void => {
  if (noteId) {
    imageRefreshSubscribers.get(noteId)?.forEach(callback => callback());
  } else {
    imageRefreshSubscribers.forEach(callbacks => {
      callbacks.forEach(callback => callback());
    });
  }

  imageIdsRefreshSubscribers.forEach(callback => callback(noteId));
};

const handleBrewingNoteDataChanged = (event: Event): void => {
  const detail = (event as CustomEvent<BrewingNoteDataChangedDetail>).detail;
  notifyImageRefreshSubscribers(getBrewingNoteDataChangedNoteId(detail));
};

const ensureBrewingNoteDataChangedListener = (): void => {
  if (
    typeof window === 'undefined' ||
    isBrewingNoteDataChangedListenerAttached
  ) {
    return;
  }

  window.addEventListener(
    'brewingNoteDataChanged',
    handleBrewingNoteDataChanged
  );
  window.addEventListener('syncCompleted', () => {
    notifyImageRefreshSubscribers(undefined);
  });
  isBrewingNoteDataChangedListenerAttached = true;
};

const subscribeToBrewingNoteImageRefresh = (
  noteId: string,
  callback: ImageRefreshSubscriber
): (() => void) => {
  const callbacks = imageRefreshSubscribers.get(noteId) || new Set();
  callbacks.add(callback);
  imageRefreshSubscribers.set(noteId, callbacks);
  ensureBrewingNoteDataChangedListener();

  return () => {
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      imageRefreshSubscribers.delete(noteId);
    }
  };
};

const subscribeToBrewingNoteImageIdsRefresh = (
  callback: ImageIdsRefreshSubscriber
): (() => void) => {
  imageIdsRefreshSubscribers.add(callback);
  ensureBrewingNoteDataChangedListener();

  return () => {
    imageIdsRefreshSubscribers.delete(callback);
  };
};

const mergeBrewingNoteImageIdChange = (
  currentImageIds: ReadonlySet<string>,
  changedNoteId: string,
  hasImage: boolean
): Set<string> => {
  const nextImageIds = new Set(currentImageIds);
  if (hasImage) {
    nextImageIds.add(changedNoteId);
  } else {
    nextImageIds.delete(changedNoteId);
  }
  return nextImageIds;
};

export function useBrewingNoteImageIds(noteIds: string[]): Set<string> {
  const [imageIds, setImageIds] = useState<Set<string>>(new Set());
  const idsKey = noteIds.join('\u0001');
  const imageNoteIds = useMemo(
    () => (idsKey ? idsKey.split('\u0001') : []),
    [idsKey]
  );

  useEffect(() => {
    const visibleNoteIds = new Set(imageNoteIds);
    let cancelled = false;
    let latestRequest = 0;

    const refreshImageIds = async (changedNoteId?: string) => {
      if (changedNoteId && !visibleNoteIds.has(changedNoteId)) return;

      const request = ++latestRequest;
      try {
        const ids = await getBrewingNoteImageNoteIds(
          changedNoteId ? [changedNoteId] : imageNoteIds
        );
        if (cancelled || request !== latestRequest) return;

        setImageIds(currentImageIds =>
          changedNoteId
            ? mergeBrewingNoteImageIdChange(
                currentImageIds,
                changedNoteId,
                ids.includes(changedNoteId)
              )
            : new Set(ids)
        );
      } catch {
        if (!cancelled && request === latestRequest && !changedNoteId) {
          setImageIds(new Set());
        }
      }
    };

    void refreshImageIds();
    const unsubscribe = subscribeToBrewingNoteImageIdsRefresh(noteId => {
      void refreshImageIds(noteId);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [imageNoteIds]);

  return imageIds;
}

export function useBrewingNoteImageCounts(
  noteIds: string[],
  versionKey = ''
): Map<string, number> {
  return useBrewingNoteImageCountsState(noteIds, versionKey).imageCounts;
}

export function useBrewingNoteImageCountsState(
  noteIds: string[],
  versionKey = ''
): { imageCounts: Map<string, number>; isLoaded: boolean } {
  const [state, setState] = useState<{
    imageCounts: Map<string, number>;
    isLoaded: boolean;
    requestKey: string;
  }>({
    imageCounts: new Map(),
    isLoaded: false,
    requestKey: '',
  });
  const idsKey = noteIds.join('\u0001');
  const requestKey = `${idsKey}\u0001${versionKey}`;
  const imageNoteIds = useMemo(
    () => (idsKey ? idsKey.split('\u0001') : []),
    [idsKey]
  );

  useEffect(() => {
    let cancelled = false;
    const uniqueNoteIds = Array.from(new Set(imageNoteIds.filter(Boolean)));

    if (uniqueNoteIds.length === 0) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setState({ imageCounts: new Map(), isLoaded: true, requestKey });
        }
      });

      return () => {
        cancelled = true;
      };
    }

    getBrewingNoteImageCounts(uniqueNoteIds)
      .then(counts => {
        if (!cancelled) {
          setState({ imageCounts: counts, isLoaded: true, requestKey });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ imageCounts: new Map(), isLoaded: true, requestKey });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageNoteIds, requestKey]);

  return {
    imageCounts:
      state.requestKey === requestKey ? state.imageCounts : EMPTY_IMAGE_COUNTS,
    isLoaded: state.requestKey === requestKey && state.isLoaded,
  };
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
    let latestRequest = 0;

    if (!noteId) {
      return;
    }

    const loadImages = () => {
      const request = ++latestRequest;
      getBrewingNoteImages(noteId)
        .then(storedImages => {
          if (!cancelled && request === latestRequest)
            setImageState({
              noteId,
              images: storedImages.length > 0 ? storedImages : fallback,
          });
        })
        .catch(() => {
          if (!cancelled && request === latestRequest) {
            setImageState({ noteId, images: fallback });
          }
        });
    };

    loadImages();
    const unsubscribe = subscribeToBrewingNoteImageRefresh(noteId, loadImages);

    return () => {
      cancelled = true;
      unsubscribe();
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
