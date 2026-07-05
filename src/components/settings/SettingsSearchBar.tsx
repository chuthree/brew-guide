'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import type { SettingsSearchItem } from './settingsSearch';

interface SettingsSearchBarProps {
  query: string;
  firstResult: SettingsSearchItem | null;
  onQueryChange: (query: string) => void;
  onSelect: (item: SettingsSearchItem) => void;
}

const SettingsSearchBar: React.FC<SettingsSearchBarProps> = ({
  query,
  firstResult,
  onQueryChange,
  onSelect,
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onQueryChange(event.target.value);
    },
    [onQueryChange]
  );
  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        onQueryChange('');
        inputRef.current?.blur();
        return;
      }

      if (event.key === 'Enter' && firstResult) {
        event.preventDefault();
        onSelect(firstResult);
        inputRef.current?.blur();
      }
    },
    [firstResult, onQueryChange, onSelect]
  );
  const handleClearMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    []
  );
  const handleClearQuery = React.useCallback(() => {
    onQueryChange('');
    inputRef.current?.focus();
  }, [onQueryChange]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+0.875rem)]">
      <div
        aria-hidden="true"
        className="fade-mask-to-t pointer-events-none absolute inset-0 bg-[var(--background)]"
      />
      <div className="pointer-events-auto relative mx-auto w-full max-w-xl">
        <div className="flex h-11 items-center gap-2 rounded-full border border-black/5 bg-neutral-100/95 px-4 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/5 dark:bg-neutral-800/95 dark:shadow-black/20">
          <Search className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            aria-label="搜索"
            placeholder="搜索"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-neutral-800 outline-none placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500"
          />
          {query && (
            <button
              type="button"
              onMouseDown={handleClearMouseDown}
              onClick={handleClearQuery}
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-500 transition active:scale-95 dark:bg-neutral-700 dark:text-neutral-300"
              aria-label="清除搜索"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsSearchBar;
