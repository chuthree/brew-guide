'use client';

import React from 'react';
import { cn } from '@/lib/utils/classNameUtils';
import SettingSelectionIndicator, {
  type SettingSelectionIndicatorShape,
} from './SettingSelectionIndicator';

export interface SettingVerticalSelectorOption<
  T extends string | number = string,
> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface SettingVerticalSelectorBaseProps<T extends string | number = string> {
  options: readonly SettingVerticalSelectorOption<T>[];
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
  indicator?: SettingSelectionIndicatorShape;
}

interface SettingVerticalSelectorSingleProps<
  T extends string | number = string,
> extends SettingVerticalSelectorBaseProps<T> {
  type?: 'single';
  value: T;
  onChange: (value: T) => void;
}

interface SettingVerticalSelectorMultipleProps<
  T extends string | number = string,
> extends SettingVerticalSelectorBaseProps<T> {
  type: 'multiple';
  value: readonly T[];
  onChange: (value: T[]) => void;
}

type SettingVerticalSelectorProps<T extends string | number = string> =
  | SettingVerticalSelectorSingleProps<T>
  | SettingVerticalSelectorMultipleProps<T>;

function SettingVerticalSelector<T extends string | number = string>({
  options,
  className,
  disabled = false,
  ariaLabel,
  indicator = 'circle',
  ...selectionProps
}: SettingVerticalSelectorProps<T>) {
  const isMultiple = selectionProps.type === 'multiple';

  const isSelected = React.useCallback(
    (value: T) => {
      if (isMultiple) {
        return selectionProps.value.includes(value);
      }

      return selectionProps.value === value;
    },
    [isMultiple, selectionProps.value]
  );

  const handleSelection = React.useCallback(
    (option: SettingVerticalSelectorOption<T>) => {
      if (disabled || option.disabled) {
        return;
      }

      if (isMultiple) {
        const nextValue = isSelected(option.value)
          ? selectionProps.value.filter(value => value !== option.value)
          : [...selectionProps.value, option.value];

        selectionProps.onChange(nextValue);
        return;
      }

      if (option.value !== selectionProps.value) {
        selectionProps.onChange(option.value);
      }
    },
    [disabled, isMultiple, isSelected, selectionProps]
  );

  const role = isMultiple ? 'group' : 'radiogroup';
  const optionRole = isMultiple ? 'checkbox' : 'radio';
  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={cn(
        'w-full overflow-hidden',
        disabled && 'opacity-60',
        className
      )}
    >
      {options.map((option, index) => {
        const selected = isSelected(option.value);
        const optionDisabled = disabled || option.disabled;
        const isLast = index === options.length - 1;

        return (
          <button
            key={String(option.value)}
            type="button"
            role={optionRole}
            aria-checked={selected}
            disabled={optionDisabled}
            onClick={() => handleSelection(option)}
            className={cn(
              'flex w-full cursor-pointer items-stretch px-3.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-neutral-400/60 focus-visible:outline-none focus-visible:ring-inset disabled:cursor-not-allowed dark:focus-visible:ring-neutral-500/70',
              'active:bg-black/5 disabled:opacity-50 dark:active:bg-white/5'
            )}
          >
            <span
              className={cn(
                'flex min-w-0 flex-1 items-center gap-3 py-3.5',
                !isLast && 'border-b border-black/5 dark:border-white/5'
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200">
                  {option.label}
                </span>
                {option.description && (
                  <span className="mt-1.5 block text-xs leading-snug font-normal text-neutral-500 dark:text-neutral-400">
                    {option.description}
                  </span>
                )}
              </span>
              <SettingSelectionIndicator
                selected={selected}
                shape={indicator}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default SettingVerticalSelector;
