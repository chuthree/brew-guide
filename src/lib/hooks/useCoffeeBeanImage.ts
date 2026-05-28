'use client';

import { useEffect, useRef, useState } from 'react';
import {
  type CoffeeBeanImageSide,
  getCoffeeBeanImageBeanIds,
  getCoffeeBeanImageSource,
} from '@/lib/coffee-beans/imageRepository';

type CoffeeBeanDataChangedDetail = {
  beanId?: string;
  bean?: { id?: string };
};

type CoffeeBeanImageThumbnailChangedDetail = {
  beanId?: string;
};

export function useCoffeeBeanImage(
  beanId: string | undefined,
  options: {
    side?: CoffeeBeanImageSide;
    preferThumbnail?: boolean;
    fallback?: string;
  } = {}
): string | undefined {
  const { side = 'front', preferThumbnail = true, fallback } = options;
  const [imageSource, setImageSource] = useState<string | undefined>(fallback);
  const [refreshKey, setRefreshKey] = useState(0);
  const sourceIdentityRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    const sourceIdentity = [beanId, side, preferThumbnail].join('\u0001');
    const sourceIdentityChanged = sourceIdentityRef.current !== sourceIdentity;
    sourceIdentityRef.current = sourceIdentity;

    if (!beanId) {
      setImageSource(fallback);
      return;
    }

    if (sourceIdentityChanged) {
      setImageSource(fallback);
    }

    getCoffeeBeanImageSource(beanId, { side, preferThumbnail })
      .then(source => {
        if (!cancelled) {
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
  }, [beanId, side, preferThumbnail, fallback, refreshKey]);

  useEffect(() => {
    if (typeof window === 'undefined' || !beanId) {
      return;
    }

    const handleBeanDataChanged = (event: Event) => {
      const detail = (event as CustomEvent<CoffeeBeanDataChangedDetail>).detail;

      if (detail?.beanId && detail.beanId !== beanId) {
        return;
      }

      if (detail?.bean?.id && detail.bean.id !== beanId) {
        return;
      }

      setRefreshKey(key => key + 1);
    };

    const handleThumbnailChanged = (event: Event) => {
      const detail = (
        event as CustomEvent<CoffeeBeanImageThumbnailChangedDetail>
      ).detail;

      if (detail?.beanId && detail.beanId !== beanId) {
        return;
      }

      setRefreshKey(key => key + 1);
    };

    window.addEventListener('coffeeBeanDataChanged', handleBeanDataChanged);
    window.addEventListener(
      'coffeeBeanImageThumbnailChanged',
      handleThumbnailChanged
    );

    return () => {
      window.removeEventListener(
        'coffeeBeanDataChanged',
        handleBeanDataChanged
      );
      window.removeEventListener(
        'coffeeBeanImageThumbnailChanged',
        handleThumbnailChanged
      );
    };
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
    preferThumbnail?: boolean;
  } = {}
): Map<string, string> {
  const { side = 'front', preferThumbnail = true } = options;
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
  }, [idsKey, side, preferThumbnail]);

  return imageSources;
}
