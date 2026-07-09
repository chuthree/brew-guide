'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type CoffeeBeanImageSide,
  type CoffeeBeanImageSourceMode,
  getCoffeeBeanImageBeanIds,
  getCoffeeBeanImageSource,
} from '@/lib/coffee-beans/imageRepository';
type CoffeeBeanDataChangedDetail = {
  beanId?: string;
  bean?: { id?: string };
};

type RefreshSubscriber = () => void;

const refreshSubscribers = new Map<string, Set<RefreshSubscriber>>();
const imageSourceCache = new Map<string, string | undefined>();
const EMPTY_IMAGE_SOURCES = new Map<string, string>();
const EMPTY_IMAGE_IDS = new Set<string>();
let isCoffeeBeanDataChangedListenerAttached = false;

const getImageSourceCacheKey = (
  beanId: string,
  side: CoffeeBeanImageSide,
  mode: CoffeeBeanImageSourceMode
): string => [beanId, side, mode].join('\u0001');

const resolveCoffeeBeanImageSourceMode = (
  mode: CoffeeBeanImageSourceMode | undefined,
  preferThumbnail: boolean
): CoffeeBeanImageSourceMode =>
  mode ?? (preferThumbnail ? 'thumbnail' : 'original');

export const shouldCacheCoffeeBeanImageSource = (
  mode: CoffeeBeanImageSourceMode,
  cache?: boolean
): boolean => cache ?? mode === 'thumbnail';

const invalidateImageSourceCache = (beanId: string | undefined): void => {
  if (!beanId) {
    imageSourceCache.clear();
    return;
  }

  const keyPrefix = `${beanId}\u0001`;
  imageSourceCache.forEach((_source, key) => {
    if (key.startsWith(keyPrefix)) {
      imageSourceCache.delete(key);
    }
  });
};

const ensureCoffeeBeanDataChangedListener = (): void => {
  if (
    typeof window === 'undefined' ||
    isCoffeeBeanDataChangedListenerAttached
  ) {
    return;
  }

  window.addEventListener('coffeeBeanDataChanged', handleCoffeeBeanDataChanged);
  isCoffeeBeanDataChangedListenerAttached = true;
};

export function getCoffeeBeanDataChangedBeanId(
  detail: CoffeeBeanDataChangedDetail | undefined
): string | undefined {
  return detail?.beanId || detail?.bean?.id;
}

export const shouldRefreshCoffeeBeanImageIds = (
  visibleBeanIds: ReadonlySet<string>,
  changedBeanId: string | undefined
): boolean => !changedBeanId || visibleBeanIds.has(changedBeanId);

export const mergeCoffeeBeanImageIdChange = (
  currentImageIds: ReadonlySet<string>,
  changedBeanId: string,
  hasImage: boolean
): Set<string> => {
  const nextImageIds = new Set(currentImageIds);
  if (hasImage) {
    nextImageIds.add(changedBeanId);
  } else {
    nextImageIds.delete(changedBeanId);
  }
  return nextImageIds;
};

const notifyRefreshSubscribers = (beanId: string | undefined): void => {
  invalidateImageSourceCache(beanId);

  if (beanId) {
    refreshSubscribers.get(beanId)?.forEach(callback => callback());
    return;
  }

  refreshSubscribers.forEach(callbacks => {
    callbacks.forEach(callback => callback());
  });
};

const handleCoffeeBeanDataChanged = (event: Event): void => {
  const detail = (event as CustomEvent<CoffeeBeanDataChangedDetail>).detail;
  notifyRefreshSubscribers(getCoffeeBeanDataChangedBeanId(detail));
};

const subscribeToCoffeeBeanImageRefresh = (
  beanId: string,
  callback: RefreshSubscriber
): (() => void) => {
  const callbacks = refreshSubscribers.get(beanId) || new Set();
  callbacks.add(callback);
  refreshSubscribers.set(beanId, callbacks);
  ensureCoffeeBeanDataChangedListener();

  return () => {
    callbacks.delete(callback);
    if (callbacks.size === 0) {
      refreshSubscribers.delete(beanId);
    }
  };
};

export function useCoffeeBeanImage(
  beanId: string | undefined,
  options: {
    side?: CoffeeBeanImageSide;
    mode?: CoffeeBeanImageSourceMode;
    preferThumbnail?: boolean;
    fallback?: string;
    cache?: boolean;
  } = {}
): string | undefined {
  const {
    side = 'front',
    mode,
    preferThumbnail = true,
    fallback,
    cache,
  } = options;
  const resolvedMode = resolveCoffeeBeanImageSourceMode(mode, preferThumbnail);
  const shouldCache = shouldCacheCoffeeBeanImageSource(resolvedMode, cache);
  const sourceIdentity = beanId
    ? getImageSourceCacheKey(beanId, side, resolvedMode)
    : undefined;
  const [imageSource, setImageSource] = useState<string | undefined>(() => {
    if (
      !shouldCache ||
      !sourceIdentity ||
      !imageSourceCache.has(sourceIdentity)
    ) {
      return fallback;
    }

    return imageSourceCache.get(sourceIdentity) || fallback;
  });
  const [refreshKey, setRefreshKey] = useState(0);
  const sourceIdentityRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const sourceIdentityChanged = sourceIdentityRef.current !== sourceIdentity;
    sourceIdentityRef.current = sourceIdentity;

    if (!beanId || !sourceIdentity) {
      return;
    }

    if (
      shouldCache &&
      sourceIdentityChanged &&
      imageSourceCache.has(sourceIdentity)
    ) {
      setImageSource(imageSourceCache.get(sourceIdentity) || fallback);
    } else if (sourceIdentityChanged && fallback !== undefined) {
      setImageSource(fallback);
    }

    getCoffeeBeanImageSource(beanId, { side, mode, preferThumbnail })
      .then(source => {
        if (!cancelled) {
          if (shouldCache) {
            imageSourceCache.set(sourceIdentity, source);
          }
          ensureCoffeeBeanDataChangedListener();
          setImageSource(source || fallback);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageSource(fallback);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    beanId,
    side,
    mode,
    preferThumbnail,
    fallback,
    shouldCache,
    refreshKey,
    sourceIdentity,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined' || !beanId) {
      return;
    }

    return subscribeToCoffeeBeanImageRefresh(beanId, () =>
      setRefreshKey(key => key + 1)
    );
  }, [beanId]);

  return beanId ? imageSource : fallback;
}

export function useCoffeeBeanImageIds(
  beanIds: string[],
  options: {
    side?: CoffeeBeanImageSide | 'any';
  } = {}
): Set<string> {
  return useCoffeeBeanImageIdsState(beanIds, options).imageIds;
}

export function useCoffeeBeanImageIdsState(
  beanIds: string[],
  options: {
    side?: CoffeeBeanImageSide | 'any';
  } = {}
): { imageIds: Set<string>; isLoaded: boolean } {
  const { side = 'any' } = options;
  const [state, setState] = useState<{
    imageIds: Set<string>;
    isLoaded: boolean;
    requestKey: string;
  }>({
    imageIds: new Set(),
    isLoaded: false,
    requestKey: '',
  });
  const idsKey = beanIds.join('\u0001');
  const requestKey = `${side}\u0001${idsKey}`;
  const imageBeanIds = useMemo(
    () => (idsKey ? idsKey.split('\u0001') : []),
    [idsKey]
  );

  useEffect(() => {
    let cancelled = false;
    const uniqueBeanIds = Array.from(new Set(imageBeanIds.filter(Boolean)));

    if (uniqueBeanIds.length === 0) {
      Promise.resolve().then(() => {
        if (!cancelled) {
          setState({ imageIds: new Set(), isLoaded: true, requestKey });
        }
      });

      return () => {
        cancelled = true;
      };
    }

    getCoffeeBeanImageBeanIds(uniqueBeanIds, { side })
      .then(ids => {
        if (!cancelled) {
          setState({ imageIds: new Set(ids), isLoaded: true, requestKey });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState({ imageIds: new Set(), isLoaded: true, requestKey });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageBeanIds, requestKey, side]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const visibleBeanIds = new Set(imageBeanIds);
    let cancelled = false;
    const refreshImageIds = async (changedBeanId?: string) => {
      if (!shouldRefreshCoffeeBeanImageIds(visibleBeanIds, changedBeanId)) {
        return;
      }

      try {
        const ids = await getCoffeeBeanImageBeanIds(
          changedBeanId ? [changedBeanId] : imageBeanIds,
          { side }
        );
        if (cancelled) return;

        setState(current => {
          if (current.requestKey !== requestKey) return current;

          return {
            requestKey,
            isLoaded: true,
            imageIds: changedBeanId
              ? mergeCoffeeBeanImageIdChange(
                  current.imageIds,
                  changedBeanId,
                  ids.includes(changedBeanId)
                )
              : new Set(ids),
          };
        });
      } catch {
        // 保留当前图片集合，等待下一次变更或同步完成后重试。
      }
    };
    const handleImageIdsChanged = (event: Event) => {
      const changedBeanId = getCoffeeBeanDataChangedBeanId(
        (event as CustomEvent<CoffeeBeanDataChangedDetail>).detail
      );
      void refreshImageIds(changedBeanId);
    };
    const handleSyncCompleted = () => {
      void refreshImageIds();
    };

    window.addEventListener('coffeeBeanDataChanged', handleImageIdsChanged);
    window.addEventListener('syncCompleted', handleSyncCompleted);
    return () => {
      cancelled = true;
      window.removeEventListener(
        'coffeeBeanDataChanged',
        handleImageIdsChanged
      );
      window.removeEventListener('syncCompleted', handleSyncCompleted);
    };
  }, [imageBeanIds, requestKey, side]);

  return {
    imageIds:
      state.requestKey === requestKey ? state.imageIds : EMPTY_IMAGE_IDS,
    isLoaded: state.requestKey === requestKey && state.isLoaded,
  };
}

export function useCoffeeBeanImageSources(
  beanIds: string[],
  options: {
    side?: CoffeeBeanImageSide;
    mode?: CoffeeBeanImageSourceMode;
    preferThumbnail?: boolean;
  } = {}
): Map<string, string> {
  const { side = 'front', mode, preferThumbnail = true } = options;
  const [imageSources, setImageSources] = useState<Map<string, string>>(
    new Map()
  );
  const idsKey = beanIds.join('\u0001');
  const imageBeanIds = useMemo(
    () => (idsKey ? idsKey.split('\u0001') : []),
    [idsKey]
  );

  useEffect(() => {
    let cancelled = false;
    const uniqueBeanIds = Array.from(new Set(imageBeanIds.filter(Boolean)));

    if (uniqueBeanIds.length === 0) {
      return;
    }

    Promise.all(
      uniqueBeanIds.map(async beanId => {
        const source = await getCoffeeBeanImageSource(beanId, {
          side,
          mode,
          preferThumbnail,
        });
        return [beanId, source] as const;
      })
    )
      .then(entries => {
        if (!cancelled) {
          setImageSources(
            new Map(
              entries.filter((entry): entry is readonly [string, string] =>
                Boolean(entry[1])
              )
            )
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageSources(new Map());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageBeanIds, side, mode, preferThumbnail]);

  return imageBeanIds.length > 0 ? imageSources : EMPTY_IMAGE_SOURCES;
}
