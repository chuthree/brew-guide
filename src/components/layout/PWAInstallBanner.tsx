'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { X } from 'lucide-react';
import Image from 'next/image';
import PWAInstallGuideDrawer from '@/components/layout/PWAInstallGuideDrawer';
import { isBundledNativeApp } from '@/lib/app/capacitor';
import { APP_VERSION } from '@/lib/core/config';
import {
  getDesktopDownloadUrl,
  getOfflineAndroidDownloadUrl,
} from '@/lib/utils/downloadUrls';

const DISMISS_KEY = 'pwa_install_banner_dismissed_v1';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

type BrewGuideWindow = Window & {
  __onboardingOpen?: boolean;
  __pwaInstallBannerVisible?: boolean;
};

const getIsIOS = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return isIOS;
};

const getIsStandalone = () => {
  if (typeof window === 'undefined') return false;
  const isStandaloneMode = window.matchMedia?.(
    '(display-mode: standalone)'
  )?.matches;
  const isIOSStandalone =
    (navigator as NavigatorWithStandalone).standalone === true;
  return Boolean(isStandaloneMode || isIOSStandalone);
};

const getIsWeChat = () => {
  if (typeof navigator === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent || '');
};

const getIsAndroid = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android/i.test(navigator.userAgent || '');
};

const getIsDesktop = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isMobile =
    /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return !isMobile;
};

const getOnboardingOpen = () => {
  if (typeof window === 'undefined') return false;
  return (window as BrewGuideWindow).__onboardingOpen === true;
};

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(() => {
    if (typeof window === 'undefined') return false;
    if (getIsStandalone()) return false;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return false;
    } catch {
      // ignore
    }
    if (Capacitor.isNativePlatform?.() === true) {
      return !isBundledNativeApp() && getIsAndroid();
    }
    return getIsIOS() || getIsAndroid();
  });
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false);
  const isNative = useMemo(() => Capacitor.isNativePlatform?.() === true, []);
  const isBundledNative = useMemo(() => isBundledNativeApp(), []);
  const isIOS = useMemo(() => getIsIOS(), []);
  const isWeChat = useMemo(() => getIsWeChat(), []);
  const isAndroid = useMemo(() => getIsAndroid(), []);
  const isDesktop = useMemo(() => getIsDesktop(), []);
  const showOnlineNativeMigration =
    isNative && !isBundledNative && isAndroid && !isWeChat;
  const [onboardingStatus, setOnboardingStatus] = useState<
    'unknown' | 'open' | 'closed'
  >(() => {
    if (typeof window === 'undefined') return 'unknown';
    return getOnboardingOpen() ? 'open' : 'closed';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isNative) return;
    if (getIsStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY) === '1') return;

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [isNative]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnboarding = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      if (typeof detail?.open === 'boolean') {
        setOnboardingStatus(detail.open ? 'open' : 'closed');
      }
    };
    window.addEventListener('onboarding-visibility', handleOnboarding);
    return () => {
      window.removeEventListener('onboarding-visibility', handleOnboarding);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const visible =
      isVisible &&
      onboardingStatus === 'closed' &&
      (!isNative || showOnlineNativeMigration);
    (window as BrewGuideWindow).__pwaInstallBannerVisible = visible;
    window.dispatchEvent(
      new CustomEvent('pwa-install-banner', { detail: { visible } })
    );
  }, [isVisible, onboardingStatus, isNative, showOnlineNativeMigration]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setIsInstallGuideOpen(false);
    setIsVisible(false);
  }, []);

  const handleInstallGuideClose = useCallback(() => {
    setIsInstallGuideOpen(false);
  }, []);

  const handleInstall = useCallback(async () => {
    if (isIOS) {
      setIsInstallGuideOpen(true);
      return;
    }

    if (deferredPrompt) {
      await deferredPrompt.prompt();
      let accepted = false;
      try {
        const result = await deferredPrompt.userChoice;
        accepted = result.outcome === 'accepted';
      } catch {
        // ignore: 用户取消安装或浏览器中断
      }
      setDeferredPrompt(null);
      if (accepted) {
        setIsVisible(false);
      }
      return;
    }
  }, [deferredPrompt, isIOS]);

  if (
    (!showOnlineNativeMigration && isNative) ||
    !isVisible ||
    onboardingStatus !== 'closed'
  ) {
    return null;
  }

  const description = showOnlineNativeMigration
    ? '长期稳定版已发布，如需离线使用可安装'
    : isWeChat
      ? '不建议在微信内打开，请点右上角“…”选择“在浏览器打开”'
      : '添加到主屏，离线可用';

  const showPwaInstallButton =
    !showOnlineNativeMigration &&
    !isWeChat &&
    (isIOS || Boolean(deferredPrompt));
  const showDesktopDownloads = isDesktop && !isWeChat;
  const showAndroidDownload =
    (isAndroid || showOnlineNativeMigration) && !isWeChat;
  const desktopDownloadUrl = getDesktopDownloadUrl();
  const androidDownloadUrl = getOfflineAndroidDownloadUrl(APP_VERSION);

  return (
    <div className="pt-safe-top relative z-50 mx-auto w-full max-w-6xl border-b border-neutral-200/50 bg-neutral-50 px-6 pb-3 dark:border-neutral-800/50 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <Image
          src="/images/icons/app/icon-192x192-contained.png"
          alt="Brew Guide APP"
          className="h-11 w-11"
          width={44}
          height={44}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-neutral-900 dark:text-neutral-100">
            Brew Guide APP
          </div>
          <div className="text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            {description}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showPwaInstallButton && (
            <button
              type="button"
              onClick={handleInstall}
              className="rounded-full bg-neutral-900 px-3 py-1 text-[12px] font-medium text-white transition hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              安装
            </button>
          )}
          {showDesktopDownloads && (
            <div className="flex items-center gap-1">
              <a
                href={desktopDownloadUrl}
                className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                Windows
              </a>
              <a
                href={desktopDownloadUrl}
                className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                macOS
              </a>
              <a
                href={desktopDownloadUrl}
                className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                Linux
              </a>
            </div>
          )}
          {showAndroidDownload && (
            <a
              href={androidDownloadUrl}
              className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              {showOnlineNativeMigration ? '下载离线版' : 'Android APK'}
            </a>
          )}
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <PWAInstallGuideDrawer
        isOpen={isInstallGuideOpen}
        onClose={handleInstallGuideClose}
      />
    </div>
  );
}
