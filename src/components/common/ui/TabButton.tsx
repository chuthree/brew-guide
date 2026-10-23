'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/classNameUtils';

interface TabButtonProps extends ComponentProps<'button'> {
  isActive: boolean;
  dataTab?: string;
}

const TabButton = ({
  isActive,
  onClick,
  children,
  className,
  dataTab,
  ...props
}: TabButtonProps) => {
  return (
    <button
      type="button"
      aria-pressed={isActive}
      {...props}
      onClick={onClick}
      data-tab={dataTab}
      data-tab-active={isActive}
      className={cn(
        'shrink-0 border-b pb-[5px] text-xs leading-4 font-medium whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:cursor-not-allowed disabled:opacity-40',
        isActive
          ? 'border-neutral-800 text-neutral-800 dark:border-white dark:text-neutral-100'
          : 'border-transparent text-neutral-600 hover:opacity-80 dark:text-neutral-400',
        className
      )}
    >
      {children}
    </button>
  );
};

export default TabButton;
