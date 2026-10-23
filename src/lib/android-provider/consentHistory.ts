import type { ModalEntry } from '@/lib/navigation/modalHistory';

interface ConsentHistory {
  register(entry: ModalEntry): void;
  close(id: string, skipOnClose?: boolean, expectedEntry?: ModalEntry): void;
}

/** Keep Back above the user's draft until native cancellation/approval completes. */
export function installProviderConsentHistory(
  history: ConsentHistory,
  cancel: () => void
): () => void {
  const entry: ModalEntry = {
    id: 'provider-authorization',
    onClose: () => {
      // Back already popped the entry. Restore it synchronously before resolving;
      // another Back must not pop the editor beneath this still-visible drawer.
      history.register(entry);
      cancel();
    },
  };
  history.register(entry);
  return () => history.close(entry.id, true, entry);
}
