'use client';

import { useMemo } from 'react';
import { coordinateStoreActions } from '@/lib/data/storeMutationBoundary';

/** Register a deferred UI event action; composing workflows use its raw identity. */
export function useCoordinatedAction<A extends unknown[], R>(
  action: (...args: A) => Promise<R>
): (...args: A) => Promise<R> {
  return useMemo(
    () => coordinateStoreActions({ action }, ['action']).action,
    [action]
  );
}
