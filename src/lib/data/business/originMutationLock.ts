/** Shared across tabs so maintenance cannot interleave its several transactions with a command. */
export const WEB_BUSINESS_MUTATION_LOCK = 'brew-guide:business-mutation';

export function hasCrossTabMutationLock(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.locks?.request === 'function'
  );
}

export async function withOriginMutationLock<T>(
  work: () => Promise<T>
): Promise<T> {
  if (!hasCrossTabMutationLock()) return work();
  // Do not silently fall back if the browser refuses a lock it advertised.
  return await navigator.locks.request(
    WEB_BUSINESS_MUTATION_LOCK,
    { mode: 'exclusive' },
    work
  );
}
