export const PWA_MANUAL_UPDATE_CHECK_EVENT = 'pwa:manual-update-check';

export function requestPWAUpdateCheck() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PWA_MANUAL_UPDATE_CHECK_EVENT));
}
