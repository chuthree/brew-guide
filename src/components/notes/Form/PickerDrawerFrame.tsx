'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

interface PickerDrawerFrameProps {
  isOpen: boolean;
  onClose: () => void;
  historyId: string;
  children: React.ReactNode;
  className?: string;
  onAfterOpen?: () => void;
  onAfterClose?: () => void;
}

const OPEN_DELAY_MS = 10;
const ANIMATION_DURATION_MS = 400;

const PickerDrawerFrame: React.FC<PickerDrawerFrameProps> = ({
  isOpen,
  onClose,
  historyId,
  children,
  className = '',
  onAfterOpen,
  onAfterClose,
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const onAfterOpenRef = useRef(onAfterOpen);
  const onAfterCloseRef = useRef(onAfterClose);
  const hasOpenedRef = useRef(false);

  useEffect(() => {
    onAfterOpenRef.current = onAfterOpen;
    onAfterCloseRef.current = onAfterClose;
  });

  useThemeColor({ useOverlay: true, enabled: isOpen });

  useModalHistory({
    id: historyId,
    isOpen,
    onClose,
  });

  useEffect(() => {
    if (isOpen) {
      hasOpenedRef.current = true;
      setShouldRender(true);

      const showTimer = setTimeout(() => setIsVisible(true), OPEN_DELAY_MS);
      const openTimer = setTimeout(() => {
        onAfterOpenRef.current?.();
      }, ANIMATION_DURATION_MS);

      return () => {
        clearTimeout(showTimer);
        clearTimeout(openTimer);
      };
    }

    if (!hasOpenedRef.current) return;

    setIsVisible(false);
    const closeTimer = setTimeout(() => {
      setShouldRender(false);
      onAfterCloseRef.current?.();
    }, ANIMATION_DURATION_MS);

    return () => clearTimeout(closeTimer);
  }, [isOpen]);

  if (!shouldRender || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div
        className={`fixed inset-0 z-60 bg-black/50 transition-opacity duration-400 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-70 mx-auto flex h-[85vh] max-w-md flex-col rounded-t-3xl bg-white shadow-xl transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] dark:bg-neutral-900 ${isVisible ? 'translate-y-0' : 'translate-y-full'} ${className}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {children}
      </div>
    </>,
    document.body
  );
};

export default PickerDrawerFrame;
