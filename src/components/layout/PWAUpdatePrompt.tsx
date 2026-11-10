'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { detectAppRuntime } from '@/lib/app/runtime';
import { PWA_MANUAL_UPDATE_CHECK_EVENT } from '@/lib/utils/pwaUpdateCheck';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import UpdateDrawer from '@/components/settings/UpdateDrawer';

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const RELOAD_FALLBACK_DELAY_MS = 1500;
const UPDATE_RETRY_SESSION_KEY = 'pwa-update-retry-at';
const UPDATE_RETRY_WINDOW_MS = 30 * 1000;

export default function PWAUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const showUpdatePromptSetting = useSettingsStore(
    state => state.settings.showUpdatePrompt !== false
  );
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const cleanupRegistrationRef = useRef<(() => void) | null>(null);
  const reloadTriggeredRef = useRef(false);
  const reloadTimerRef = useRef<number | null>(null);
  const isNative = useMemo(() => detectAppRuntime().runtime !== 'web', []);

  useEffect(() => {
    if (isNative) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV === 'development') return;

    let disposed = false;

    const readUpdateRetryTimestamp = () => {
      const value = window.sessionStorage.getItem(UPDATE_RETRY_SESSION_KEY);
      if (!value) return null;

      const timestamp = Number(value);
      return Number.isFinite(timestamp) ? timestamp : null;
    };

    const hasRecentUpdateRetry = () => {
      const timestamp = readUpdateRetryTimestamp();
      return (
        timestamp !== null && Date.now() - timestamp < UPDATE_RETRY_WINDOW_MS
      );
    };

    const clearUpdateRetry = () => {
      window.sessionStorage.removeItem(UPDATE_RETRY_SESSION_KEY);
    };

    const scheduleReloadFallback = () => {
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
      }

      reloadTimerRef.current = window.setTimeout(() => {
        window.location.reload();
      }, RELOAD_FALLBACK_DELAY_MS);
    };

    const handleWaitingWorker = (registration: ServiceWorkerRegistration) => {
      if (!registration.waiting || !navigator.serviceWorker.controller) return;

      if (!showUpdatePromptSetting) {
        setIsUpdating(false);
        setShowPrompt(false);
        return;
      }

      if (hasRecentUpdateRetry()) {
        setIsUpdating(true);
        setShowPrompt(false);
        reloadTriggeredRef.current = true;
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        scheduleReloadFallback();
        return;
      }

      setIsUpdating(false);
      setShowPrompt(true);
    };

    const bindRegistration = (registration: ServiceWorkerRegistration) => {
      if (registrationRef.current === registration) {
        handleWaitingWorker(registration);
        return;
      }

      cleanupRegistrationRef.current?.();
      registrationRef.current = registration;

      const workerCleanups: Array<() => void> = [];

      const watchInstallingWorker = (worker: ServiceWorker | null) => {
        if (!worker) return;

        const handleStateChange = () => {
          if (
            worker.state === 'installed' &&
            registration.waiting &&
            navigator.serviceWorker.controller
          ) {
            handleWaitingWorker(registration);
          }
        };

        worker.addEventListener('statechange', handleStateChange);
        workerCleanups.push(() =>
          worker.removeEventListener('statechange', handleStateChange)
        );
      };

      const handleUpdateFound = () => {
        watchInstallingWorker(registration.installing);
      };

      registration.addEventListener('updatefound', handleUpdateFound);
      watchInstallingWorker(registration.installing);

      cleanupRegistrationRef.current = () => {
        registration.removeEventListener('updatefound', handleUpdateFound);
        workerCleanups.forEach(cleanup => cleanup());
      };

      handleWaitingWorker(registration);
    };

    const resolveRegistration = async () => {
      if (registrationRef.current) {
        return registrationRef.current;
      }

      const scopedRegistration =
        await navigator.serviceWorker.getRegistration('/');
      if (scopedRegistration) {
        return scopedRegistration;
      }

      return navigator.serviceWorker.getRegistration();
    };

    const checkForUpdates = async () => {
      try {
        const registration = await resolveRegistration();

        if (!registration) return;

        bindRegistration(registration);
        await registration.update();

        if (!registration.waiting) {
          clearUpdateRetry();
          setIsUpdating(false);
        } else {
          handleWaitingWorker(registration);
        }
      } catch (error) {
        console.error('[PWA] update check failed:', error);
      }
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        if (disposed) return;

        bindRegistration(registration);
        await checkForUpdates();
      } catch (error) {
        console.error('[PWA] service worker registration failed:', error);
      }
    };

    const handleControllerChange = () => {
      clearUpdateRetry();
      setShowPrompt(false);
      setIsUpdating(false);
      if (!reloadTriggeredRef.current) return;
      window.location.reload();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdates();
      }
    };

    const handleFocus = () => {
      void checkForUpdates();
    };

    const handleManualUpdateCheck = () => {
      void checkForUpdates();
    };

    navigator.serviceWorker.addEventListener(
      'controllerchange',
      handleControllerChange
    );
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener(
      PWA_MANUAL_UPDATE_CHECK_EVENT,
      handleManualUpdateCheck
    );

    const intervalId = window.setInterval(() => {
      void checkForUpdates();
    }, UPDATE_CHECK_INTERVAL_MS);

    void registerServiceWorker();
    void checkForUpdates();

    return () => {
      disposed = true;
      cleanupRegistrationRef.current?.();
      navigator.serviceWorker.removeEventListener(
        'controllerchange',
        handleControllerChange
      );
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener(
        PWA_MANUAL_UPDATE_CHECK_EVENT,
        handleManualUpdateCheck
      );
      window.clearInterval(intervalId);
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
      }
    };
  }, [isNative, showUpdatePromptSetting]);

  const applyUpdate = () => {
    const registration = registrationRef.current;
    window.sessionStorage.setItem(UPDATE_RETRY_SESSION_KEY, String(Date.now()));
    setShowPrompt(false);
    setIsUpdating(true);
    reloadTriggeredRef.current = true;

    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      reloadTimerRef.current = window.setTimeout(() => {
        window.location.reload();
      }, RELOAD_FALLBACK_DELAY_MS);
      return;
    }

    window.location.reload();
  };

  if (isNative || !showUpdatePromptSetting || !showPrompt) return null;

  return (
    <UpdateDrawer
      isOpen={showPrompt}
      onClose={() => setShowPrompt(false)}
      mode="pwa"
      historyId="pwa-update-drawer"
      onPrimaryClick={applyUpdate}
      primaryText={isUpdating ? '正在更新…' : '立即更新'}
      secondaryText="稍后"
      primaryDisabled={isUpdating}
    />
  );
}
