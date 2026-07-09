'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  type CoffeeBeanImageSide,
  getCoffeeBeanImageRecords,
} from '@/lib/coffee-beans/imageRepository';
import type { CoffeeBeanImageRecord } from '@/lib/coffee-beans/imageRecords';
import {
  getDataUrlImageDimensions,
  type ImageDimensions,
} from '@/lib/images/dimensions';
import { getCoffeeBeanDataChangedBeanId } from './useCoffeeBeanImage';

export interface CoffeeBeanImageFlowSource {
  beanId: string;
  src: string;
  dimensions: ImageDimensions;
}

interface UseCoffeeBeanImageFlowSourcesResult {
  sources: Map<string, CoffeeBeanImageFlowSource>;
  isLoading: boolean;
}

export const MAX_COFFEE_BEAN_IMAGE_FLOW_SOURCE_CACHE_ENTRIES = 96;
const MAX_SETTLED_IMAGE_FLOW_REQUESTS = 32;
const imageFlowSourceCache = new Map<string, CoffeeBeanImageFlowSource>();

const normalizeBeanIds = (beanIds: string[]): string[] =>
  Array.from(new Set(beanIds.filter(Boolean)));

const getImageFlowSourceCacheKey = (
  beanId: string,
  side: CoffeeBeanImageSide
): string => `${side}\u0001${beanId}`;

const getRecordImageForSide = (
  record: CoffeeBeanImageRecord,
  side: CoffeeBeanImageSide
): string | undefined => (side === 'front' ? record.image : record.backImage);

export const createCoffeeBeanImageFlowSource = (
  record: CoffeeBeanImageRecord,
  side: CoffeeBeanImageSide = 'front'
): CoffeeBeanImageFlowSource | undefined => {
  const src = getRecordImageForSide(record, side);
  const dimensions = getDataUrlImageDimensions(src);

  if (!src || !dimensions) {
    return undefined;
  }

  return {
    beanId: record.beanId,
    src,
    dimensions,
  };
};

const rememberImageFlowSource = (
  side: CoffeeBeanImageSide,
  source: CoffeeBeanImageFlowSource
): void => {
  const cacheKey = getImageFlowSourceCacheKey(source.beanId, side);

  if (imageFlowSourceCache.has(cacheKey)) {
    imageFlowSourceCache.delete(cacheKey);
  }

  imageFlowSourceCache.set(cacheKey, source);
};

const trimImageFlowSourceCache = (protectedKeys = new Set<string>()): void => {
  while (
    imageFlowSourceCache.size > MAX_COFFEE_BEAN_IMAGE_FLOW_SOURCE_CACHE_ENTRIES
  ) {
    let oldestKey: string | undefined;
    for (const cacheKey of imageFlowSourceCache.keys()) {
      if (!protectedKeys.has(cacheKey)) {
        oldestKey = cacheKey;
        break;
      }
    }

    if (!oldestKey) break;
    imageFlowSourceCache.delete(oldestKey);
  }
};

const forgetImageFlowSource = (beanId: string | undefined): void => {
  if (!beanId) {
    imageFlowSourceCache.clear();
    return;
  }

  imageFlowSourceCache.delete(getImageFlowSourceCacheKey(beanId, 'front'));
  imageFlowSourceCache.delete(getImageFlowSourceCacheKey(beanId, 'back'));
};

const getCachedImageFlowSources = (
  beanIds: string[],
  side: CoffeeBeanImageSide,
  cacheRevision = 0
): Map<string, CoffeeBeanImageFlowSource> => {
  void cacheRevision;

  const sources = new Map<string, CoffeeBeanImageFlowSource>();

  beanIds.forEach(beanId => {
    const source = imageFlowSourceCache.get(
      getImageFlowSourceCacheKey(beanId, side)
    );
    if (source) {
      sources.set(beanId, source);
    }
  });

  return sources;
};

const getProtectedImageFlowCacheKeys = (
  beanIds: string[],
  side: CoffeeBeanImageSide
): Set<string> =>
  new Set(beanIds.map(beanId => getImageFlowSourceCacheKey(beanId, side)));

const rememberSettledRequestKey = (
  requestKeys: Set<string>,
  requestKey: string
): Set<string> => {
  const nextRequestKeys = new Set(requestKeys);
  nextRequestKeys.add(requestKey);

  while (nextRequestKeys.size > MAX_SETTLED_IMAGE_FLOW_REQUESTS) {
    const oldestKey = nextRequestKeys.keys().next().value;
    if (!oldestKey) break;
    nextRequestKeys.delete(oldestKey);
  }

  return nextRequestKeys;
};

export function useCoffeeBeanImageFlowSources(
  beanIds: string[],
  options: { side?: CoffeeBeanImageSide } = {}
): UseCoffeeBeanImageFlowSourcesResult {
  const { side = 'front' } = options;
  const idsKey = beanIds.filter(Boolean).join('\u0001');
  const uniqueBeanIds = useMemo(
    () => normalizeBeanIds(idsKey ? idsKey.split('\u0001') : []),
    [idsKey]
  );
  const [refreshKey, setRefreshKey] = useState(0);
  const [cacheVersion, setCacheVersion] = useState(0);
  const [settledRequestKeys, setSettledRequestKeys] = useState<Set<string>>(
    () => new Set()
  );
  const cacheRevision = cacheVersion + refreshKey;
  const sources = useMemo(
    () => getCachedImageFlowSources(uniqueBeanIds, side, cacheRevision),
    [cacheRevision, side, uniqueBeanIds]
  );
  const missingBeanIds = useMemo(
    () => uniqueBeanIds.filter(beanId => !sources.has(beanId)),
    [sources, uniqueBeanIds]
  );
  const missingIdsKey = missingBeanIds.join('\u0001');
  const requestKey = `${side}\u0002${idsKey}\u0002${refreshKey}`;
  const isCurrentRequestSettled = settledRequestKeys.has(requestKey);
  const isLoading = missingBeanIds.length > 0 && !isCurrentRequestSettled;

  useEffect(() => {
    const missingIds = missingIdsKey ? missingIdsKey.split('\u0001') : [];
    if (missingIds.length === 0 || isCurrentRequestSettled) {
      return;
    }

    let cancelled = false;

    getCoffeeBeanImageRecords(missingIds)
      .then(records => {
        if (cancelled) return;

        records.forEach(record => {
          const source = createCoffeeBeanImageFlowSource(record, side);
          if (!source) return;

          rememberImageFlowSource(side, source);
        });
        trimImageFlowSourceCache(
          getProtectedImageFlowCacheKeys(
            idsKey ? idsKey.split('\u0001') : [],
            side
          )
        );

        setSettledRequestKeys(requestKeys =>
          rememberSettledRequestKey(requestKeys, requestKey)
        );
        setCacheVersion(version => version + 1);
      })
      .catch(() => {
        if (!cancelled) {
          setSettledRequestKeys(requestKeys =>
            rememberSettledRequestKey(requestKeys, requestKey)
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [idsKey, isCurrentRequestSettled, missingIdsKey, requestKey, side]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const visibleBeanIds = new Set(uniqueBeanIds);
    const handleCoffeeBeanDataChanged = (event: Event) => {
      const beanId = getCoffeeBeanDataChangedBeanId(
        (event as CustomEvent).detail
      );

      if (beanId && !visibleBeanIds.has(beanId)) {
        return;
      }

      forgetImageFlowSource(beanId);
      setCacheVersion(version => version + 1);
      setRefreshKey(key => key + 1);
    };

    window.addEventListener(
      'coffeeBeanDataChanged',
      handleCoffeeBeanDataChanged
    );
    return () =>
      window.removeEventListener(
        'coffeeBeanDataChanged',
        handleCoffeeBeanDataChanged
      );
  }, [uniqueBeanIds]);

  return { sources, isLoading };
}
