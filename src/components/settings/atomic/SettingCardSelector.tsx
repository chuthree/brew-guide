'use client';

import React from 'react';
import { cn } from '@/lib/utils/classNameUtils';
import SettingSelectionIndicator, {
  type SettingSelectionIndicatorShape,
} from './SettingSelectionIndicator';

export interface SettingCardSelectorOption<T extends string | number = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface SettingCardSelectorProps<T extends string | number = string> {
  value: T;
  options: readonly SettingCardSelectorOption<T>[];
  onChange: (value: T) => void;
  renderPreview: (option: SettingCardSelectorOption<T>) => React.ReactNode;
  getPreviewAction?: (option: SettingCardSelectorOption<T>) =>
    | {
        ariaLabel: string;
        onClick: () => void;
      }
    | undefined;
  className?: string;
  ariaLabel?: string;
  indicator?: SettingSelectionIndicatorShape;
}

function SettingCardSelector<T extends string | number = string>({
  value,
  options,
  onChange,
  renderPreview,
  getPreviewAction,
  className,
  ariaLabel,
  indicator = 'circle',
}: SettingCardSelectorProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('grid grid-cols-2 gap-3', className)}
    >
      {options.map(option => {
        const selected = option.value === value;
        const previewAction = getPreviewAction?.(option);

        return (
          <div
            key={String(option.value)}
            className="group flex min-w-0 flex-col rounded-lg bg-neutral-100 p-2.5 text-left dark:bg-neutral-800/80"
          >
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={option.disabled}
              onClick={() => onChange(option.value)}
              className="mb-2 flex min-h-5 w-full min-w-0 cursor-pointer items-center gap-2 text-left focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-neutral-500/70"
            >
              <span className="min-w-0 flex-1 truncate text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
                {option.label}
              </span>
              <SettingSelectionIndicator
                selected={selected}
                shape={indicator}
                className="size-5"
              />
            </button>
            {previewAction ? (
              <button
                type="button"
                aria-label={previewAction.ariaLabel}
                disabled={option.disabled}
                onClick={previewAction.onClick}
                className="flex aspect-square w-full cursor-pointer items-center justify-center overflow-hidden rounded-md bg-neutral-50 focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:outline-none disabled:cursor-not-allowed dark:bg-neutral-900/80 dark:focus-visible:ring-neutral-500/70"
              >
                {renderPreview(option)}
              </button>
            ) : (
              <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-neutral-50 dark:bg-neutral-900/80">
                {renderPreview(option)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default SettingCardSelector;
