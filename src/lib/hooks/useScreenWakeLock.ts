import { useEffect } from 'react';
import { KeepAwake } from '@capacitor-community/keep-awake';
import { detectAppRuntime } from '@/lib/app/runtime';

let users = 0;
let releaseLock: (() => Promise<void>) | undefined;
let webLock: WakeLockSentinel | undefined;
let pending = Promise.resolve();

function updateScreenWakeLock() {
  // Serialize platform calls so a slow acquisition cannot outlive its last user.
  pending = pending.then(async () => {
    if (users === 0 || document.visibilityState !== 'visible') {
      await releaseLock?.();
      releaseLock = undefined;
      webLock = undefined;
    } else if (!releaseLock || webLock?.released) {
      if (detectAppRuntime().runtime === 'capacitor') {
        await KeepAwake.keepAwake();
        releaseLock = () => KeepAwake.allowSleep();
      } else if (navigator.wakeLock) {
        const lock = await navigator.wakeLock.request('screen');
        webLock = lock;
        releaseLock = () => lock.release();
      }
    }
  }).catch(() => {
    // Power policy can deny the request. Sync and brewing can still proceed.
  });
}

export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    if (++users === 1) {
      document.addEventListener('visibilitychange', updateScreenWakeLock);
      updateScreenWakeLock();
    }
    return () => {
      if (--users === 0) {
        document.removeEventListener('visibilitychange', updateScreenWakeLock);
        updateScreenWakeLock();
      }
    };
  }, [active]);
}
