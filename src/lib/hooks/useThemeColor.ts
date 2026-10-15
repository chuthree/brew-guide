/** One progress writer for the scrim, Safari sampling edge and theme-color. */
import { useLayoutEffect, useRef, useState } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import { useTheme } from 'next-themes';

export const THEME_COLORS = {
  light: { base: '#fafafa' },
  dark: { base: '#171717' },
} as const;

interface UseThemeColorOptions {
  useOverlay?: boolean;
  enabled?: boolean;
}

export const getResolvedTheme = (
  theme: string | undefined,
  systemTheme: string | undefined
): 'light' | 'dark' =>
  theme === 'dark' || ((theme === 'system' || !theme) && systemTheme === 'dark')
    ? 'dark'
    : 'light';

export const updateThemeColorMeta = (color: string) => {
  const root = document.documentElement;
  if (root.style.getPropertyValue('--edge-top-background') !== color) {
    root.style.setProperty('--edge-top-background', color);
  }
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.removeAttribute('media');
  if (meta.content !== color) meta.content = color;
};

interface OverlayState {
  progress: number;
}
const activeOverlays = new Set<OverlayState>();
let resolvedTheme: 'light' | 'dark' = 'light';

function publishColor() {
  const base = Number.parseInt(
    THEME_COLORS[resolvedTheme].base.slice(1, 3),
    16
  );
  // Every mounted black/50 scrim contributes once, including nested drawers.
  const transmission = [...activeOverlays].reduce(
    (remaining, overlay) => remaining * (1 - overlay.progress * 0.5),
    1
  );
  const channel = Math.round(base * transmission);
  updateThemeColorMeta(`rgb(${channel}, ${channel}, ${channel})`);
}

export const restoreDefaultThemeColor = (
  theme: string | undefined,
  systemTheme: string | undefined
) => {
  resolvedTheme = getResolvedTheme(theme, systemTheme);
  publishColor();
};

function readTransition(style: CSSStyleDeclaration) {
  const isAnimation =
    style.animationName !== 'none' && style.animationName !== '';
  const duration =
    Number.parseFloat(
      isAnimation ? style.animationDuration : style.transitionDuration
    ) || 0;
  const timing = isAnimation
    ? style.animationTimingFunction
    : style.transitionTimingFunction;
  const values = timing
    .match(/cubic-bezier\(([^)]+)\)/)?.[1]
    .split(',')
    .map(Number);
  const named: Record<string, [number, number, number, number]> = {
    linear: [0, 0, 1, 1],
    ease: [0.25, 0.1, 0.25, 1],
    'ease-in': [0.42, 0, 1, 1],
    'ease-out': [0, 0, 0.58, 1],
    'ease-in-out': [0.42, 0, 0.58, 1],
  };
  const ease =
    values?.length === 4
      ? (values as [number, number, number, number])
      : named[timing] || named.ease;
  return { duration, ease };
}

/** Own the visible opacity; never sample an independently animated compositor layer. */
export function registerThemeColorOverlay(element: HTMLElement) {
  // Read the existing drawer's timing before disabling its separate opacity animation.
  const transition = readTransition(getComputedStyle(element));
  const overlay: OverlayState = { progress: 0 };
  let playback: AnimationPlaybackControls | undefined;
  let target = 0;
  let previousInlineOpacity = element.style.opacity;
  let previousInlineTransition = element.style.transition;
  let disposed = false;
  activeOverlays.add(overlay);
  element.style.setProperty(
    '--browser-overlay-duration',
    `${transition.duration}s`
  );
  element.dataset.browserOverlay = '';

  const render = (value: number) => {
    if (disposed) return;
    overlay.progress = Math.min(1, Math.max(0, value));
    // This write and all three solid backgrounds happen in the same callback.
    element.style.setProperty(
      '--browser-overlay-progress',
      String(overlay.progress)
    );
    publishColor();
  };

  const moveTo = (value: number) => {
    if (target === value) return;
    target = value;
    playback?.stop();
    if (!transition.duration) {
      render(value);
      return;
    }
    playback = animate(overlay.progress, value, {
      ...transition,
      onUpdate: render,
    });
  };

  // Vaul still reports drag/release through its inline opacity. Consume that
  // input before paint; our CSS prevents it from starting a second visual fade.
  const observer = new MutationObserver(() => {
    const opacity = element.style.opacity;
    const inlineTransition = element.style.transition;
    if (
      opacity === previousInlineOpacity &&
      inlineTransition === previousInlineTransition
    )
      return;
    previousInlineOpacity = opacity;
    previousInlineTransition = inlineTransition;
    if (opacity === '') return;
    const value = Math.min(1, Math.max(0, Number(opacity)));
    if (!element.hasAttribute('data-vaul-overlay')) return;
    if (inlineTransition === 'none') {
      playback?.stop();
      target = value;
      render(value);
    } else {
      moveTo(value);
    }
  });
  observer.observe(element, { attributes: true, attributeFilter: ['style'] });
  render(0);

  return {
    setOpen(open: boolean) {
      moveTo(open ? 1 : 0);
    },
    dispose() {
      disposed = true;
      playback?.stop();
      observer.disconnect();
      activeOverlays.delete(overlay);
      delete element.dataset.browserOverlay;
      element.style.removeProperty('--browser-overlay-progress');
      element.style.removeProperty('--browser-overlay-duration');
      publishColor();
    },
  };
}

export const useThemeColor = (options: UseThemeColorOptions = {}) => {
  const { useOverlay = false, enabled = true } = options;
  const { theme, systemTheme } = useTheme();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const controller = useRef<ReturnType<
    typeof registerThemeColorOverlay
  > | null>(null);

  useLayoutEffect(() => {
    if (!element) return;
    const binding = registerThemeColorOverlay(element);
    controller.current = binding;
    return () => {
      binding.dispose();
      controller.current = null;
    };
  }, [element]);

  useLayoutEffect(() => {
    restoreDefaultThemeColor(theme, systemTheme);
    controller.current?.setOpen(enabled);
  }, [theme, systemTheme, enabled, element, useOverlay]);

  return setElement;
};
