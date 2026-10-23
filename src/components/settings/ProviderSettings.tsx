'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { modalHistory, useModalHistory } from '@/lib/hooks/useModalHistory';
import SettingPage from './atomic/SettingPage';
import { ProviderSettingsSection } from './ProviderSettingsSection';

/** Independent Settings page, deliberately not a child of DataSettings. */
export default function ProviderSettings({ onClose }: { onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const closeRef = useRef(onClose);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  const close = useCallback(() => {
    setVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    timer.current = setTimeout(() => closeRef.current(), 350);
  }, []);
  useModalHistory({
    id: 'provider-settings',
    isOpen: true,
    onClose: close,
    skipPageExitTransitionOnHistory: true,
  });
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(frame);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const back = useCallback(() => modalHistory.back(), []);
  return (
    <SettingPage title="授权管理" isVisible={visible} onClose={back}>
      <ProviderSettingsSection />
    </SettingPage>
  );
}
