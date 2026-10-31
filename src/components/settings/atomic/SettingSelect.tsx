'use client';

import React from 'react';
import * as Select from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

interface SettingSelectProps<T extends string> {
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  disabled?: boolean;
  alignItemWithTrigger?: boolean;
}

function SettingSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled = false,
  alignItemWithTrigger = true,
}: SettingSelectProps<T>) {
  return (
    <Select.Root
      value={value}
      onValueChange={next => onChange(next as T)}
      disabled={disabled}
    >
      <Select.Trigger
        aria-label={ariaLabel}
        className="flex h-4 cursor-pointer items-center justify-end gap-2 rounded-sm p-0 text-sm leading-none font-normal whitespace-nowrap text-neutral-600 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-300"
      >
        <Select.Value />
        <Select.Icon asChild>
          <ChevronsUpDown className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position={alignItemWithTrigger ? 'item-aligned' : 'popper'}
          align="end"
          sideOffset={4}
          collisionPadding={12}
          className="relative z-90 w-max max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-black/5 bg-neutral-100 text-neutral-800 dark:border-white/5 dark:bg-neutral-900 dark:text-neutral-200"
        >
          <Select.ScrollUpButton className="flex h-6 items-center justify-center text-neutral-400 dark:bg-neutral-800/40">
            <ChevronUp className="size-4" />
          </Select.ScrollUpButton>
          <Select.Viewport className="max-h-(--radix-select-content-available-height) p-1 dark:bg-neutral-800/40">
            {/* 右侧距离：行留白 14 + 图标 16 + 间距 8 - 菜单留白 4 - 边框 1。 */}
            {options.map(option => (
              <Select.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="relative flex h-9 cursor-pointer items-center justify-end rounded-lg pr-[calc(2.125rem-1px)] pl-2.5 text-sm leading-none font-normal whitespace-nowrap outline-none select-none focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-neutral-400/60 data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[highlighted]:bg-neutral-200/60 dark:data-[highlighted]:bg-neutral-700/60"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator className="absolute right-2 flex items-center text-neutral-600 dark:text-neutral-300">
                  <Check className="size-4" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
          <Select.ScrollDownButton className="flex h-6 items-center justify-center text-neutral-400 dark:bg-neutral-800/40">
            <ChevronDown className="size-4" />
          </Select.ScrollDownButton>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

export default SettingSelect;
