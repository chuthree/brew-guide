"use client";

import * as React from "react";
import { format } from "date-fns";
import * as Popover from '@radix-ui/react-popover';
import { Calendar } from "./Calendar";
import { zhCN, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils/classNameUtils";

export interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date) => void;
  placeholder?: string;
  locale?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePicker({
  date,
  onDateChange,
  placeholder = "选择日期",
  locale = "zh-CN",
  className = "",
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const localeObj = locale === "zh-CN" ? zhCN : enUS;
  
  const handleSelect = (selectedDate: Date) => {
    if (onDateChange) {
      onDateChange(selectedDate);
    }
    setTimeout(() => {
      setOpen(false);
    }, 300);
  };

  return (
    <div className={`relative w-full ${className}`}>
      <Popover.Root open={open && !disabled} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button 
            className="w-full py-2 bg-transparent outline-hidden border-b border-neutral-300 dark:border-neutral-700 focus-within:border-neutral-800 dark:focus-within:border-neutral-400 cursor-pointer flex items-center justify-between"
            onClick={() => !disabled && setOpen(true)}
            disabled={disabled}
            type="button"
          >
            <span className={`${!date ? 'text-neutral-500' : 'text-neutral-800 dark:text-white'}`}>
              {date ? format(date, "yyyy/MM/dd", { locale: localeObj }) : placeholder}
            </span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
            className={cn(
              "bg-white dark:bg-neutral-900 rounded-md shadow-md border border-neutral-200 dark:border-neutral-800 z-50",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
              "data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2"
            )}
            sideOffset={4}
            align="start"
          >
            <Calendar
              selected={date}
              onSelect={handleSelect}
              locale={locale}
              initialFocus
            />
            <Popover.Arrow className="fill-white dark:fill-neutral-900" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
} 