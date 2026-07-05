'use client';

import React from 'react';
import { ChevronRight, Search, X } from 'lucide-react';
import { pinyin } from 'pinyin-pro';
import type { SettingItemData } from './SettingItem';

export interface SettingsSearchGroup {
  id: string;
  label?: string;
  items: SettingItemData[];
}

export interface SettingsSearchItem {
  id: string;
  settingId: string;
  label: string;
  value?: string;
  description?: string;
  groupLabel?: string;
  onClick: () => void;
}

interface SettingsSearchBarProps {
  groups: SettingsSearchGroup[];
  onSelect: (item: SettingsSearchItem) => void;
}

const MAX_VISIBLE_RESULTS = 8;

const normalizeSearchText = (value: string) =>
  value.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

const getPinyinText = (value: string) => {
  if (!value) return '';

  const full = pinyin(value, { toneType: 'none' });
  const initials = pinyin(value, { pattern: 'first', toneType: 'none' });

  return [
    full,
    full.replace(/\s+/g, ''),
    initials,
    initials.replace(/\s+/g, ''),
  ].join(' ');
};

const buildSearchText = (item: SettingsSearchItem) =>
  normalizeSearchText(
    [
      item.label,
      item.value,
      item.description,
      item.groupLabel,
      getPinyinText(item.label),
      item.groupLabel ? getPinyinText(item.groupLabel) : '',
    ]
      .filter(Boolean)
      .join(' ')
  );

const buildSearchItems = (groups: SettingsSearchGroup[]) =>
  groups.flatMap(group =>
    group.items
      .filter(
        (
          item
        ): item is SettingItemData & {
          settingId: string;
          onClick: () => void;
        } => Boolean(item.settingId && item.onClick)
      )
      .map(item => ({
        id: `${group.id}-${item.settingId}`,
        settingId: item.settingId,
        label: item.label,
        value: item.value,
        description: item.description,
        groupLabel: group.label,
        onClick: item.onClick,
      }))
  );

interface SettingsSearchResultButtonProps {
  item: SettingsSearchItem;
  isLast: boolean;
  onSelect: (item: SettingsSearchItem) => void;
}

const SettingsSearchResultButton: React.FC<SettingsSearchResultButtonProps> = ({
  item,
  isLast,
  onSelect,
}) => {
  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    []
  );
  const selectSearchResult = React.useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  return (
    <button
      type="button"
      onMouseDown={handleMouseDown}
      onClick={selectSearchResult}
      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left text-sm transition-colors hover:bg-black/5 active:bg-black/10 dark:hover:bg-white/5 dark:active:bg-white/10 ${
        !isLast ? 'border-b border-black/5 dark:border-white/5' : ''
      }`}
    >
      <Search className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-neutral-800 dark:text-neutral-100">
            {item.label}
          </span>
          {item.value && (
            <span className="shrink-0 text-xs text-neutral-400 dark:text-neutral-500">
              {item.value}
            </span>
          )}
        </div>
        {(item.description || item.groupLabel) && (
          <div className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
            {item.description || item.groupLabel}
          </div>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-neutral-400/70 dark:text-neutral-500" />
    </button>
  );
};

const SettingsSearchBar: React.FC<SettingsSearchBarProps> = ({
  groups,
  onSelect,
}) => {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = React.useState('');
  const [isFocused, setIsFocused] = React.useState(false);
  const deferredQuery = React.useDeferredValue(query);
  const searchItems = React.useMemo(() => buildSearchItems(groups), [groups]);
  const searchableItems = React.useMemo(
    () =>
      searchItems.map(item => ({
        item,
        searchText: buildSearchText(item),
      })),
    [searchItems]
  );
  const normalizedQuery = normalizeSearchText(deferredQuery);
  const tokens = React.useMemo(
    () => normalizedQuery.split(' ').filter(Boolean),
    [normalizedQuery]
  );
  const visibleResults = React.useMemo(() => {
    const matches =
      tokens.length === 0
        ? searchableItems
        : searchableItems.filter(({ searchText }) =>
            tokens.every(token => searchText.includes(token))
          );

    return matches.slice(0, MAX_VISIBLE_RESULTS).map(match => match.item);
  }, [searchableItems, tokens]);
  const shouldShowResults = isFocused && visibleResults.length > 0;
  const shouldShowEmptyState =
    isFocused && normalizedQuery.length > 0 && visibleResults.length === 0;

  const handleSelect = React.useCallback(
    (item: SettingsSearchItem) => {
      onSelect(item);
      setQuery('');
      setIsFocused(false);
      inputRef.current?.blur();
    },
    [onSelect]
  );
  const handleInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    []
  );
  const handleInputFocus = React.useCallback(() => {
    setIsFocused(true);
  }, []);
  const handleInputBlur = React.useCallback(() => {
    setIsFocused(false);
  }, []);
  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Escape') {
        setQuery('');
        inputRef.current?.blur();
        return;
      }

      if (event.key === 'Enter' && visibleResults[0]) {
        event.preventDefault();
        handleSelect(visibleResults[0]);
      }
    },
    [handleSelect, visibleResults]
  );
  const handleClearMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    },
    []
  );
  const handleClearQuery = React.useCallback(() => {
    setQuery('');
    inputRef.current?.focus();
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-neutral-50 via-neutral-50/95 to-neutral-50/0 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] dark:from-neutral-900 dark:via-neutral-900/95 dark:to-neutral-900/0">
      <div className="pointer-events-auto mx-auto w-full max-w-xl">
        {(shouldShowResults || shouldShowEmptyState) && (
          <div className="mb-2 overflow-hidden rounded-xl border border-black/5 bg-neutral-100/95 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/5 dark:bg-neutral-800/95 dark:shadow-black/20">
            {shouldShowResults ? (
              visibleResults.map((item, index) => (
                <SettingsSearchResultButton
                  key={item.id}
                  item={item}
                  isLast={index === visibleResults.length - 1}
                  onSelect={handleSelect}
                />
              ))
            ) : (
              <div className="px-3.5 py-3 text-sm text-neutral-500 dark:text-neutral-400">
                没有匹配项
              </div>
            )}
          </div>
        )}

        <div className="flex h-11 items-center gap-2 rounded-full border border-black/5 bg-neutral-100/95 px-4 shadow-lg shadow-black/5 backdrop-blur-xl dark:border-white/5 dark:bg-neutral-800/95 dark:shadow-black/20">
          <Search className="size-4 shrink-0 text-neutral-400 dark:text-neutral-500" />
          <input
            ref={inputRef}
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            aria-label="搜索设置"
            placeholder="搜索设置"
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
