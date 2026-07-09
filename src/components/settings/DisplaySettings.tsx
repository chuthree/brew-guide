'use client';

import React from 'react';
import { SettingsOptions } from './Settings';
import { useTheme } from 'next-themes';
import fontZoomUtils from '@/lib/utils/fontZoomUtils';
import hapticsUtils from '@/lib/ui/haptics';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingSelector,
  SettingSlider,
  SettingToggle,
} from './atomic';
import { makeSettingRowSearchId } from './settingsSearch';

const DEFAULT_TEXT_ZOOM_LEVEL = 1;
const TRANSITION_DURATION_MS = 350;
const SAFE_AREA_PREVIEW_HIDE_DELAY_MS = 1200;
const SAFE_AREA_MARGIN_MIN = 10;
const SAFE_AREA_MARGIN_MAX = 80;
const SAFE_AREA_MARGIN_STEP = 2;
const DEFAULT_SAFE_AREA_MARGINS: NonNullable<
  SettingsOptions['safeAreaMargins']
> = {
  top: 12,
  bottom: 38,
};

type SafeAreaPreviewState = NonNullable<SettingsOptions['safeAreaMargins']> & {
  visible: boolean;
};

const APPEARANCE_OPTIONS = [
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
  { value: 'system', label: '系统' },
];

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

function resolveSafeAreaMargins(margins?: SettingsOptions['safeAreaMargins']) {
  const resolvedMargins = margins ?? DEFAULT_SAFE_AREA_MARGINS;
  return {
    top: clampSafeAreaMargin(resolvedMargins.top),
    bottom: clampSafeAreaMargin(resolvedMargins.bottom),
  };
}

function clampSafeAreaMargin(value: number) {
  return Math.min(
    SAFE_AREA_MARGIN_MAX,
    Math.max(SAFE_AREA_MARGIN_MIN, value)
  );
}

interface SafeAreaMarginPreviewProps {
  preview: SafeAreaPreviewState;
}

function SafeAreaMarginPreview({ preview }: SafeAreaMarginPreviewProps) {
  const topBandStyle = React.useMemo<React.CSSProperties>(
    function createTopBandStyle() {
      return { height: `${preview.top}px` };
    },
    [preview.top]
  );
  const bottomBandStyle = React.useMemo<React.CSSProperties>(
    function createBottomBandStyle() {
      return { height: `${preview.bottom}px` };
    },
    [preview.bottom]
  );
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[9999] transition-opacity duration-200 ${
        preview.visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className="absolute inset-x-0 top-0 border-b border-neutral-900/20 bg-neutral-900/5 dark:border-white/25 dark:bg-white/10"
        style={topBandStyle}
      />
      <div
        className="absolute inset-x-0 bottom-0 border-t border-neutral-900/20 bg-neutral-900/5 dark:border-white/25 dark:bg-white/10"
        style={bottomBandStyle}
      />
    </div>
  );
}

interface DisplaySettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void | Promise<void>;
}

function DisplaySettings({ onClose }: DisplaySettingsProps) {
  const hapticFeedback = useSettingsStore(
    state => state.settings.hapticFeedback
  );
  const textZoomLevel = useSettingsStore(state => state.settings.textZoomLevel);
  const safeAreaMargins = useSettingsStore(
    state => state.settings.safeAreaMargins
  );
  const showMenuBarIcon = useSettingsStore(
    state => state.settings.showMenuBarIcon
  );
  const updateSettings = useSettingsStore(state => state.updateSettings);

  const { theme, setTheme } = useTheme();
  const [zoomLevel, setZoomLevel] = React.useState(
    () => textZoomLevel ?? DEFAULT_TEXT_ZOOM_LEVEL
  );
  const [isFontZoomEnabled, setIsFontZoomEnabled] = React.useState(false);
  const [isTauriEnv, setIsTauriEnv] = React.useState(false);
  const [isVisible, setIsVisible] = React.useState(false);
  const [safeAreaPreview, setSafeAreaPreview] =
    React.useState<SafeAreaPreviewState | null>(null);

  const onCloseRef = React.useRef(onClose);
  const safeAreaPreviewTimeoutRef = React.useRef<number | null>(null);

  React.useEffect(
    function syncOnCloseRef() {
      onCloseRef.current = onClose;
    },
    [onClose]
  );

  const handleCloseWithAnimation = React.useCallback(
    function closeWithAnimation() {
      setIsVisible(false);
      window.dispatchEvent(new CustomEvent('subSettingsClosing'));

      window.setTimeout(function finishCloseAnimation() {
        onCloseRef.current();
      }, TRANSITION_DURATION_MS);
    },
    []
  );

  useModalHistory({
    id: 'display-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
    skipPageExitTransitionOnHistory: true,
  });

  const handleClose = React.useCallback(function closeDisplaySettings() {
    modalHistory.back();
  }, []);

  React.useEffect(function revealAfterLayout() {
    let outerFrame = 0;
    let innerFrame = 0;

    outerFrame = requestAnimationFrame(function scheduleReveal() {
      innerFrame = requestAnimationFrame(function reveal() {
        setIsVisible(true);
      });
    });

    return function cancelReveal() {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, []);

  React.useEffect(function detectRuntimeFeatures() {
    setIsFontZoomEnabled(fontZoomUtils.isAvailable());
    setIsTauriEnv(isTauri());
  }, []);

  React.useEffect(
    function syncZoomLevel() {
      setZoomLevel(textZoomLevel ?? DEFAULT_TEXT_ZOOM_LEVEL);
    },
    [textZoomLevel]
  );

  React.useEffect(function clearSafeAreaPreviewTimer() {
    return function clearTimer() {
      if (safeAreaPreviewTimeoutRef.current !== null) {
        window.clearTimeout(safeAreaPreviewTimeoutRef.current);
      }
    };
  }, []);

  const hideSafeAreaPreview = React.useCallback(function hideSafeAreaPreview() {
    setSafeAreaPreview(function hideCurrentPreview(currentPreview) {
      if (currentPreview === null) {
        return null;
      }

      return {
        ...currentPreview,
        visible: false,
      };
    });
  }, []);

  const showSafeAreaPreview = React.useCallback(
    function showSafeAreaPreview(
      nextMargins: NonNullable<SettingsOptions['safeAreaMargins']>
    ) {
      if (safeAreaPreviewTimeoutRef.current !== null) {
        window.clearTimeout(safeAreaPreviewTimeoutRef.current);
      }

      setSafeAreaPreview({
        ...nextMargins,
        visible: true,
      });
      safeAreaPreviewTimeoutRef.current = window.setTimeout(
        hideSafeAreaPreview,
        SAFE_AREA_PREVIEW_HIDE_DELAY_MS
      );
    },
    [hideSafeAreaPreview]
  );

  const handleFontZoomChange = React.useCallback(
    async function changeFontZoom(newValue: number) {
      setZoomLevel(newValue);
      fontZoomUtils.set(newValue);
      await updateSettings({ textZoomLevel: newValue });

      if (hapticFeedback) {
        hapticsUtils.light();
      }
    },
    [hapticFeedback, updateSettings]
  );

  const handleMenuBarIconChange = React.useCallback(
    async function changeMenuBarIcon(enabled: boolean) {
      await updateSettings({ showMenuBarIcon: enabled });

      if (isTauriEnv) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('set_tray_visible', { visible: enabled });
        } catch (error) {
          console.warn('Failed to update tray visibility:', error);
        }
      }

      if (hapticFeedback) {
        hapticsUtils.light();
      }
    },
    [hapticFeedback, isTauriEnv, updateSettings]
  );

  const handleThemeChange = React.useCallback(
    function changeTheme(value: string) {
      setTheme(value);
      if (hapticFeedback) {
        hapticsUtils.light();
      }
    },
    [hapticFeedback, setTheme]
  );

  const handleTopSafeAreaChange = React.useCallback(
    async function changeTopSafeArea(value: number) {
      const nextMargins = {
        ...resolveSafeAreaMargins(safeAreaMargins),
        top: value,
      };

      showSafeAreaPreview(nextMargins);
      await updateSettings({
        safeAreaMargins: nextMargins,
      });
    },
    [safeAreaMargins, showSafeAreaPreview, updateSettings]
  );

  const handleBottomSafeAreaChange = React.useCallback(
    async function changeBottomSafeArea(value: number) {
      const nextMargins = {
        ...resolveSafeAreaMargins(safeAreaMargins),
        bottom: value,
      };

      showSafeAreaPreview(nextMargins);
      await updateSettings({
        safeAreaMargins: nextMargins,
      });
    },
    [safeAreaMargins, showSafeAreaPreview, updateSettings]
  );

  return (
    <SettingPage title="外观" isVisible={isVisible} onClose={handleClose}>
      {safeAreaPreview !== null ? (
        <SafeAreaMarginPreview preview={safeAreaPreview} />
      ) : null}

      <SettingSection title="外观" className="-mt-4">
        <SettingRow label="外观模式" isLast>
          <SettingSelector
            value={theme ?? 'system'}
            options={APPEARANCE_OPTIONS}
            ariaLabel="外观模式"
            onChange={handleThemeChange}
          />
        </SettingRow>
      </SettingSection>

      {isFontZoomEnabled ? (
        <SettingSection title="字体">
          <SettingRow
            settingId={makeSettingRowSearchId('字体')}
            isLast
            vertical
          >
            <SettingSlider
              value={zoomLevel}
              min={0.8}
              max={1.2}
              step={0.1}
              onChange={handleFontZoomChange}
              minLabel="小"
              maxLabel="大"
              showTicks
            />
          </SettingRow>
        </SettingSection>
      ) : null}

      {isTauriEnv ? (
        <SettingSection title="菜单栏">
          <SettingRow label="显示菜单栏图标" isLast>
            <SettingToggle
              checked={showMenuBarIcon !== false}
              onChange={handleMenuBarIconChange}
            />
          </SettingRow>
        </SettingSection>
      ) : null}

      <SettingSection title="安全区域边距">
        <SettingRow label="顶部边距" vertical>
          <SettingSlider
            value={resolveSafeAreaMargins(safeAreaMargins).top}
            min={SAFE_AREA_MARGIN_MIN}
            max={SAFE_AREA_MARGIN_MAX}
            step={SAFE_AREA_MARGIN_STEP}
            onChange={handleTopSafeAreaChange}
            minLabel="小"
            maxLabel="大"
          />
        </SettingRow>

        <SettingRow label="底部边距" isLast vertical>
          <SettingSlider
            value={resolveSafeAreaMargins(safeAreaMargins).bottom}
            min={SAFE_AREA_MARGIN_MIN}
            max={SAFE_AREA_MARGIN_MAX}
            step={SAFE_AREA_MARGIN_STEP}
            onChange={handleBottomSafeAreaChange}
            minLabel="小"
            maxLabel="大"
          />
        </SettingRow>
      </SettingSection>
    </SettingPage>
  );
}

export default DisplaySettings;
