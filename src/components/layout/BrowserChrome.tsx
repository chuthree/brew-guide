'use client';

import { useThemeColor } from '@/lib/hooks/useThemeColor';

export default function BrowserChrome() {
  useThemeColor();

  // Last root-layout sibling, outside the pages' transform/opacity animations.
  return <div aria-hidden="true" className="browser-edge-top" />;
}
