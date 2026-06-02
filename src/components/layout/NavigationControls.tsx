'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, Equal } from 'lucide-react';

type ControlPlacement = 'sidebar' | 'inline';

interface NavigationSettingsButtonProps {
  children?: React.ReactNode;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onFocus?: () => void;
  placement?: ControlPlacement;
  title?: string;
  ariaLabel?: string;
  className?: string;
}

interface NavigationArrowButtonProps {
  direction: 'collapse' | 'expand';
  onClick: () => void;
  placement?: ControlPlacement;
  className?: string;
}

const placementClasses: Record<ControlPlacement, string> = {
  sidebar: '-mt-3 -ml-3 pt-3 pr-4 pb-3 pl-3',
  inline: 'p-1.5',
};

const arrowPlacementClasses: Record<ControlPlacement, string> = {
  sidebar: '-mt-3 -mr-3 p-3',
  inline: 'p-1.5',
};

const controlBaseClass =
  'inline-flex shrink-0 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-50 focus-visible:outline-none dark:text-neutral-400 dark:hover:text-neutral-100 dark:focus-visible:ring-neutral-600 dark:focus-visible:ring-offset-neutral-900';

export const NavigationSettingsButton: React.FC<
  NavigationSettingsButtonProps
> = ({
  children,
  onClick,
  onPointerEnter,
  onFocus,
  placement = 'sidebar',
  title = '设置',
  ariaLabel = title,
  className = '',
}) => (
  <button
    type="button"
    aria-label={ariaLabel}
    title={title}
    onClick={onClick}
    onPointerEnter={onPointerEnter}
    onFocus={onFocus}
    className={`${controlBaseClass} ${placementClasses[placement]} ${className}`}
  >
    <span className="relative flex h-4 w-4 items-center justify-center">
      {children ?? <Equal className="h-4 w-4" aria-hidden="true" />}
    </span>
  </button>
);

export const NavigationArrowButton: React.FC<NavigationArrowButtonProps> = ({
  direction,
  onClick,
  placement = 'sidebar',
  className = '',
}) => {
  const Icon = direction === 'collapse' ? ChevronLeft : ChevronRight;
  const label = direction === 'collapse' ? '收起侧边栏' : '展开侧边栏';
  const title = `${label} (Cmd/Ctrl+B)`;

  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={onClick}
      className={`${controlBaseClass} ${arrowPlacementClasses[placement]} ${className}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
};
