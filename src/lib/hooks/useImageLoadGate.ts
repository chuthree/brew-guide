'use client';

import { useCallback, useEffect, useState } from 'react';

export const DEFAULT_IMAGE_LOAD_ROOT_MARGIN = '600px';

export const getNextImageLoadState = (
  hasLoaded: boolean,
  isNearViewport: boolean
): boolean => hasLoaded || isNearViewport;

export function useImageLoadGate(options: { rootMargin?: string } = {}): {
  ref: (node: HTMLElement | null) => void;
  shouldLoad: boolean;
} {
  const { rootMargin = DEFAULT_IMAGE_LOAD_ROOT_MARGIN } = options;
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const canUseIntersectionObserver =
    typeof IntersectionObserver !== 'undefined';
  const ref = useCallback((node: HTMLElement | null) => {
    setTarget(node);
  }, []);

  useEffect(() => {
    if (!target || !canUseIntersectionObserver) {
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        setShouldLoad(hasLoaded =>
          getNextImageLoadState(
            hasLoaded,
            entries.some(entry => entry.isIntersecting)
          )
        );
        if (entries.some(entry => entry.isIntersecting)) {
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [canUseIntersectionObserver, rootMargin, target]);

  return {
    ref,
    shouldLoad: canUseIntersectionObserver ? shouldLoad : Boolean(target),
  };
}
