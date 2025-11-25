'use client';

import React from 'react';

interface ButtonGroupProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  className?: string;
}

export function ButtonGroup<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: ButtonGroupProps<T>) {
  return (
    <div
      className={`inline-flex rounded bg-neutral-200/80 p-0.5 dark:bg-neutral-700/80 ${className}`}
    >
      {options.map(option => (
        <button
          key={option.value}
          className={`rounded px-2.5 py-1 text-xs font-medium transition-all ${
            value === option.value
              ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-600 dark:text-white'
              : 'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200'
          }`}
          onClick={() => {
            onChange(option.value);
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
