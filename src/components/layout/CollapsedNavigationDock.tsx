'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NavigationSettingsButton } from '@/components/layout/NavigationControls';

interface CollapsedNavigationDockProps {
  overlayContent: React.ReactNode;
}

export const useCollapsedNavigationDock = () => {
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const openOverlay = useCallback(() => {
    setIsOverlayOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setIsOverlayOpen(false);
  }, []);

  useEffect(() => {
    if (!isOverlayOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !overlayRef.current?.contains(target)
      ) {
        closeOverlay();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeOverlay();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeOverlay, isOverlayOpen]);

  return {
    isOverlayOpen,
    triggerRef,
    overlayRef,
    openOverlay,
    closeOverlay,
  };
};

export type CollapsedNavigationDockState = ReturnType<
  typeof useCollapsedNavigationDock
>;

interface CollapsedNavigationDockTriggerProps {
  triggerRef: CollapsedNavigationDockState['triggerRef'];
  openOverlay: CollapsedNavigationDockState['openOverlay'];
  closeOverlay: CollapsedNavigationDockState['closeOverlay'];
}

export const CollapsedNavigationDockTrigger: React.FC<
  CollapsedNavigationDockTriggerProps
> = ({ triggerRef, openOverlay, closeOverlay }) => {
  return (
    <div
      ref={triggerRef}
      className="relative flex shrink-0 items-center"
      onPointerEnter={openOverlay}
      onPointerLeave={closeOverlay}
    >
      <NavigationSettingsButton
        placement="inline"
        title="显示导航"
        ariaLabel="显示导航"
        onClick={openOverlay}
        onPointerEnter={openOverlay}
        onFocus={openOverlay}
      />
    </div>
  );
};

interface CollapsedNavigationDockOverlayProps
  extends CollapsedNavigationDockProps {
  isOverlayOpen: CollapsedNavigationDockState['isOverlayOpen'];
  overlayRef: CollapsedNavigationDockState['overlayRef'];
  openOverlay: CollapsedNavigationDockState['openOverlay'];
  closeOverlay: CollapsedNavigationDockState['closeOverlay'];
}

export const CollapsedNavigationDockOverlay: React.FC<
  CollapsedNavigationDockOverlayProps
> = ({
  isOverlayOpen,
  overlayRef,
  openOverlay,
  closeOverlay,
  overlayContent,
}) => {
  return (
    isOverlayOpen && (
      <div
        ref={overlayRef}
        className="absolute top-0 left-0 z-20 max-h-[min(420px,calc(100vh-2rem))] overflow-y-auto overflow-x-hidden border-r border-b border-neutral-200/50 bg-neutral-50 pb-4 dark:border-neutral-800/50 dark:bg-neutral-900"
        onPointerEnter={openOverlay}
        onPointerLeave={closeOverlay}
      >
        {overlayContent}
      </div>
    )
  );
};
