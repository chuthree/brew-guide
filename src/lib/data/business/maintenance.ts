import { detectAppRuntime } from '@/lib/app/runtime';
import { resolveStorageBackend } from '@/lib/data/runtime';
import { nanoid } from 'nanoid';

export const BUSINESS_HISTORY_INVALIDATED_EVENT =
  'brew-guide:business-history-invalidated';
const HISTORY_CHANNEL = 'brew-guide:business-history';
const HISTORY_STORAGE_KEY = 'brew-guide:business-history-revision';
let invalidateHistory: (() => Promise<void>) | undefined;

/** Bound with the selected repositories; generic callers never load a backend. */
export function configureBusinessHistoryMaintenance(
  invalidate: () => Promise<void>
): void {
  invalidateHistory = invalidate;
}

/** Signal only; no private records or operation results cross tabs. */
export function announceBusinessHistoryInvalidation(): void {
  if (typeof window === 'undefined') return;
  const detail = { revision: nanoid() };
  window.dispatchEvent(
    new CustomEvent(BUSINESS_HISTORY_INVALIDATED_EVENT, { detail })
  );
  try {
    if (window.BroadcastChannel) {
      const channel = new window.BroadcastChannel(HISTORY_CHANNEL);
      channel.postMessage(detail);
      channel.close();
    }
  } catch {
    // Storage events below also cover browsers without BroadcastChannel.
  }
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(detail));
  } catch {
    // Private browsing may disallow storage; local and channel signals still work.
  }
}

/** Subscribe once at the application shell; duplicate channel/storage signals are coalesced. */
export function subscribeBusinessHistoryInvalidation(
  onInvalidate: () => void
): () => void {
  if (typeof window === 'undefined') return () => {};
  const seen = new Set<string>();
  const receive = (detail: unknown) => {
    if (!detail || typeof detail !== 'object') return;
    const revision = (detail as { revision?: unknown }).revision;
    if (
      typeof revision !== 'string' ||
      !revision ||
      revision.length > 128 ||
      seen.has(revision)
    )
      return;
    seen.add(revision);
    if (seen.size > 64) seen.delete(seen.values().next().value!);
    onInvalidate();
  };
  const local = (event: Event) => receive((event as CustomEvent).detail);
  const storage = (event: StorageEvent) => {
    if (event.key !== HISTORY_STORAGE_KEY || !event.newValue) return;
    try {
      receive(JSON.parse(event.newValue));
    } catch {
      /* Ignore malformed external storage. */
    }
  };
  window.addEventListener(BUSINESS_HISTORY_INVALIDATED_EVENT, local);
  window.addEventListener('storage', storage);
  let channel: BroadcastChannel | undefined;
  try {
    if (window.BroadcastChannel) {
      channel = new window.BroadcastChannel(HISTORY_CHANNEL);
      channel.onmessage = event => receive(event.data);
    }
  } catch {
    /* Storage events remain available. */
  }
  return () => {
    window.removeEventListener(BUSINESS_HISTORY_INVALIDATED_EVENT, local);
    window.removeEventListener('storage', storage);
    channel?.close();
  };
}

/** Caller owns withDataMutation. Invalidate before replacement, including partial failures. */
export async function invalidateWebBusinessHistoryInMutation(): Promise<void> {
  if (
    resolveStorageBackend(detectAppRuntime()) !== 'dexie' ||
    !invalidateHistory
  )
    return;
  await invalidateHistory();
  announceBusinessHistoryInvalidation();
}
