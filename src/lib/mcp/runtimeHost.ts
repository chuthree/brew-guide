import type { MutationChange } from './storage';
/** Optional non-UI publication port. Desktop retains its existing Store/event path. */
let publication: ((changes: MutationChange[]) => Promise<void>) | undefined;
export function setBusinessPublicationHost(host: typeof publication): void {
  publication = host;
}
export async function publishThroughBusinessHost(
  changes: MutationChange[]
): Promise<boolean> {
  if (!publication) return false;
  await publication(changes);
  return true;
}

let activityScope: ((requestId: string) => boolean) | undefined;
export function setBusinessActivityScope(scope: typeof activityScope): void {
  activityScope = scope;
}
export function isBusinessActivityVisible(requestId: string): boolean {
  return activityScope?.(requestId) ?? true;
}

/** Native IPC enforces per-domain write/delete on actual transactional side effects. */
let mutationAuthorization:
  | ((changes: MutationChange[]) => Promise<void>)
  | undefined;
export function setBusinessMutationAuthorizationHost(
  host: typeof mutationAuthorization
): void {
  mutationAuthorization = host;
}
export async function authorizeMutationChanges(
  changes: MutationChange[]
): Promise<void> {
  await mutationAuthorization?.(changes);
}
