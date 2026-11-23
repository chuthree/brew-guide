import { useEffect } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { detectAppRuntime } from '@/lib/app/runtime';

let users = 0;
let releaseLock: (() => Promise<void>) | undefined;
let webLock: WakeLockSentinel | undefined;
let pending = Promise.resolve();

function onSystemRelease() {
  if (users > 0 && document.visibilityState === 'visible')
    updateScreenWakeLock();
}

function updateScreenWakeLock() {
  // Serialize platform calls so a slow acquisition cannot outlive its last user.
  pending = pending
    .then(async () => {
      if (users === 0 || document.visibilityState !== 'visible') {
        webLock?.removeEventListener('release', onSystemRelease);
        await releaseLock?.();
        releaseLock = undefined;
        webLock = undefined;
      } else if (!releaseLock || webLock?.released) {
        webLock?.removeEventListener('release', onSystemRelease);
        if (detectAppRuntime().runtime === 'capacitor') {
          await KeepAwake.keepAwake();
          releaseLock = () => KeepAwake.allowSleep();
        } else if (navigator.wakeLock) {
          const lock = await navigator.wakeLock.request('screen');
          webLock = lock;
          lock.addEventListener('release', onSystemRelease);
          releaseLock = () => lock.release();
        }
      }
    })
    .catch(() => {
      // Power policy can deny the request. Sync and brewing can still proceed.
    });
}

export function retainScreenWakeLock() {
  if (typeof document === 'undefined') return () => {};
  let retained = true;
  if (++users === 1) {
    document.addEventListener('visibilitychange', updateScreenWakeLock);
    updateScreenWakeLock();
  }
  return () => {
    if (!retained) return;
    retained = false;
    if (--users === 0) {
      document.removeEventListener('visibilitychange', updateScreenWakeLock);
      updateScreenWakeLock();
    }
  };
}

export async function duringScreenWakeLock<T>(
  work: () => Promise<T>
): Promise<T> {
  const release = retainScreenWakeLock();
  try {
    return await work();
  } finally {
    release();
  }
}

export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (active) return retainScreenWakeLock();
  }, [active]);
}
