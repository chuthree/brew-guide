'use client';

import { useSyncExternalStore } from 'react';
import {
  BROWSER_CHROME_MEDIA,
  useThemeColor,
} from '@/lib/hooks/useThemeColor';

const subscribe = (onChange: () => void) => {
  const media = window.matchMedia(BROWSER_CHROME_MEDIA);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
};

const isMobileLayout = () => window.matchMedia(BROWSER_CHROME_MEDIA).matches;

export default function BrowserChrome() {
  useThemeColor();
  const showEdge = useSyncExternalStore(subscribe, isMobileLayout, () => false);
  if (!showEdge) return null;

  // Last root-layout sibling, outside the pages' transform/opacity animations.
  return <div aria-hidden="true" className="browser-edge-top" />;
}
