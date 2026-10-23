'use client';

import { create } from 'zustand';
import {
  isAndroidProviderAvailable,
  providerAccess,
  type ProviderAccessState,
} from './client';

// Device-local bridge state only. Never persist in app settings, exports or sync.
export const useProviderAccessState = create<{
  state: ProviderAccessState | null;
}>(() => ({ state: null }));
export function publishProviderAccessState(state: ProviderAccessState) {
  const current = useProviderAccessState.getState().state;
  if (!current || state.revision >= current.revision)
    useProviderAccessState.setState({ state });
}
let refreshInFlight: Promise<void> | null = null;
export function refreshProviderAccessState(): Promise<void> {
  if (!isAndroidProviderAvailable()) return Promise.resolve();
  if (!refreshInFlight) {
    refreshInFlight = providerAccess
      .getState()
      .then(publishProviderAccessState)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}
