'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { X } from 'lucide-react';

const DISMISS_KEY = 'pwa_install_banner_dismissed_v1';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
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
  const isIOSStandalone = (navigator as any).standalone === true;
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
  return (window as any).__onboardingOpen === true;
};

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const isNative = useMemo(() => Capacitor.isNativePlatform?.() === true, []);
  const isIOS = useMemo(getIsIOS, []);
  const isWeChat = useMemo(getIsWeChat, []);
  const isAndroid = useMemo(getIsAndroid, []);
  const isDesktop = useMemo(getIsDesktop, []);
  const [onboardingStatus, setOnboardingStatus] = useState<
    'unknown' | 'open' | 'closed'
  >('unknown');

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

    if (isIOS) {
      setIsVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, [isIOS, isNative]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const current = (window as any).__onboardingOpen;
    if (typeof current === 'boolean') {
      setOnboardingStatus(current ? 'open' : 'closed');
    }
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
    const visible = !isNative && isVisible && onboardingStatus === 'closed';
    (window as any).__pwaInstallBannerVisible = visible;
    window.dispatchEvent(
      new CustomEvent('pwa-install-banner', { detail: { visible } })
    );
  }, [isVisible, onboardingStatus, isNative]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setIsVisible(false);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      try {
        const result = await deferredPrompt.userChoice;
        if (result.outcome === 'accepted') {
          setIsVisible(false);
        }
      } finally {
        setDeferredPrompt(null);
      }
      return;
    }
  }, [deferredPrompt]);

  if (isNative || !isVisible || onboardingStatus !== 'closed') return null;

  const description = isWeChat
    ? '不建议在微信内打开，请点右上角“…”选择“在浏览器打开”'
    : isIOS
      ? '在 Safari 点“共享”→“添加到主屏幕”，即可安装'
      : '离线可用、启动更快，可添加到主屏幕';

  const showPwaInstallButton = Boolean(deferredPrompt) && !isWeChat && !isIOS;
  const showDesktopDownloads = isDesktop && !isWeChat;
  const showAndroidDownload = isAndroid && !isWeChat;

  return (
    <div className="relative z-50 mx-auto w-full max-w-6xl border-b border-neutral-200/50 bg-neutral-50 px-6 py-3 dark:border-neutral-800/50 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <img
          src="/images/icons/app/icon-192x192.png"
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
              下载
            </button>
          )}
          {showDesktopDownloads && (
            <div className="flex items-center gap-1">
              <a
                href="https://gitee.com/chu3/brew-guide/releases/download/v1.5.12/BrewGuide_1.5.12_windows_x64_setup.exe"
                className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                Windows
              </a>
              <a
                href="https://gitee.com/chu3/brew-guide/releases/download/v1.5.12/BrewGuide_1.5.12_macos_arm64.dmg"
                className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                macOS
              </a>
              <a
                href="https://gitee.com/chu3/brew-guide/releases/download/v1.5.12/BrewGuide_1.5.12_linux_x64.AppImage"
                className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
              >
                Linux
              </a>
            </div>
          )}
          {showAndroidDownload && (
            <a
              href="https://github.com/chuthree/brew-guide/releases/download/v1.0.0-online/BrewGuide-OL_1.0.0_android.apk"
              className="rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-800 transition hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            >
              Android APK
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
    </div>
  );
}
