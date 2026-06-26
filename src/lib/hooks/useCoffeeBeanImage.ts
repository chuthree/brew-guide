'use client';

import { useEffect, useRef, useState } from 'react';
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
let isCoffeeBeanDataChangedListenerAttached = false;

const getImageSourceCacheKey = (
  beanId: string,
  side: CoffeeBeanImageSide,
  mode: CoffeeBeanImageSourceMode | undefined,
  preferThumbnail: boolean
): string =>
  [beanId, side, mode ?? (preferThumbnail ? 'thumbnail' : 'original')].join(
    '\u0001'
  );

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
  } = {}
): string | undefined {
  const { side = 'front', mode, preferThumbnail = true, fallback } = options;
  const sourceIdentity = beanId
    ? getImageSourceCacheKey(beanId, side, mode, preferThumbnail)
    : undefined;
  const [imageSource, setImageSource] = useState<string | undefined>(() => {
    if (!sourceIdentity || !imageSourceCache.has(sourceIdentity)) {
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
      setImageSource(fallback);
      return;
    }

    if (sourceIdentityChanged && imageSourceCache.has(sourceIdentity)) {
      setImageSource(imageSourceCache.get(sourceIdentity) || fallback);
    } else if (sourceIdentityChanged && fallback !== undefined) {
      setImageSource(fallback);
    }

    getCoffeeBeanImageSource(beanId, { side, mode, preferThumbnail })
      .then(source => {
        if (!cancelled) {
          imageSourceCache.set(sourceIdentity, source);
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

  return imageSource;
}

export function useCoffeeBeanImageIds(beanIds: string[]): Set<string> {
  const [imageIds, setImageIds] = useState<Set<string>>(new Set());
  const idsKey = beanIds.join('\u0001');

  useEffect(() => {
    let cancelled = false;

    getCoffeeBeanImageBeanIds(beanIds)
      .then(ids => {
        if (!cancelled) {
          setImageIds(new Set(ids));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImageIds(new Set());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  return imageIds;
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

  useEffect(() => {
    let cancelled = false;
    const uniqueBeanIds = Array.from(new Set(beanIds.filter(Boolean)));

    if (uniqueBeanIds.length === 0) {
      setImageSources(new Map());
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
  }, [idsKey, side, mode, preferThumbnail]);

  return imageSources;
}
