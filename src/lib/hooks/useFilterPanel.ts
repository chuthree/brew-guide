'use client';

import { useEffect, useId, useRef, useState, type MouseEvent } from 'react';

export function useFilterPanel() {
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [keyboardInteraction, setKeyboardInteraction] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      setKeyboardInteraction(false);
      const path = event.composedPath();
      if (
        path.some(
          target =>
            target === panelRef.current ||
            (target instanceof HTMLElement &&
              target.getAttribute('aria-controls') === id)
        )
      ) {
        return;
      }

      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setKeyboardInteraction(true);
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [id, isOpen]);

  const handleTriggerClick = (
    event: MouseEvent<HTMLButtonElement>,
    nextOpen?: boolean
  ) => {
    triggerRef.current = event.currentTarget;
    setKeyboardInteraction(event.detail === 0);
    setIsOpen(open => nextOpen ?? !open);
  };

  return {
    isOpen,
    setIsOpen,
    triggerRef,
    handleTriggerClick,
    interactionProps: {
      onKeyDownCapture: () => setKeyboardInteraction(true),
      onPointerDownCapture: () => setKeyboardInteraction(false),
    },
    panelProps: { id, isOpen, panelRef, keyboardInteraction },
  };
}
