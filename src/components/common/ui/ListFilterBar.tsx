'use client';

import type { ComponentProps, ReactNode } from 'react';
import { X } from 'lucide-react';
import SearchAllSuggestion from './SearchAllSuggestion';
import TabBar from './TabBar';

interface ListSearch {
  active?: boolean;
  input: Pick<
    ComponentProps<'input'>,
    'ref' | 'onChange' | 'onKeyDown' | 'placeholder'
  > & { value?: string };
  onOpen: () => void;
  onClose: () => void;
  history?: string[];
  onHistoryClick?: (query: string) => void;
  scopeLabel?: string;
  onSearchAll?: () => void;
}

export function ListHeaderSummary({
  navigation,
  children,
}: {
  navigation?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-center justify-between px-6">
      <div className={`relative min-w-0 ${navigation ? 'pl-6' : ''}`}>
        {navigation && (
          <div className="absolute top-1/2 -left-1.5 -translate-y-1/2">
            {navigation}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

export function ListFilterBar({
  leading,
  tabs,
  multiple,
  search,
  children,
}: {
  leading: ReactNode;
  tabs: ReactNode;
  multiple?: boolean;
  search?: ListSearch;
  children: ReactNode;
}) {
  const query = search?.input.value ?? '';
  return (
    <div className="border-b border-neutral-200/50 dark:border-neutral-800/50">
      <div className="relative px-6">
        {search?.active ? (
          <div className="relative flex items-center pb-1.5">
            <input
              {...search.input}
              type="text"
              aria-label={search.input.placeholder}
              className="min-w-0 flex-1 border-none bg-transparent pr-2 text-xs font-medium text-neutral-800 placeholder-neutral-400 outline-hidden dark:text-neutral-100 dark:placeholder-neutral-500"
              autoComplete="off"
              autoFocus
            />
            <button
              type="button"
              aria-label="关闭搜索"
              onClick={search.onClose}
              className="-m-2 ml-1 flex items-center p-2 text-neutral-500 dark:text-neutral-400"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ) : (
          <TabBar multiple={multiple} className="relative flex items-center">
            <div className="relative flex shrink-0 items-center bg-neutral-50 pr-3 dark:bg-neutral-900">
              {leading}
              <div className="fade-mask-to-l pointer-events-none absolute top-0 right-0 bottom-0 w-5 bg-neutral-50 dark:bg-neutral-900" />
            </div>
            <div className="relative min-w-0 flex-1 overflow-hidden">
              <div
                data-scroll-shadow="left"
                className="fade-mask-to-r pointer-events-none absolute top-0 bottom-0 left-0 z-10 w-6 bg-neutral-50/95 dark:bg-neutral-900/95"
              />
              <div data-category-scroll className="flex overflow-x-auto">
                {tabs}
              </div>
              <div
                data-scroll-shadow="right"
                className="fade-mask-to-l pointer-events-none absolute top-0 right-0 bottom-0 z-10 w-6 bg-neutral-50/95 dark:bg-neutral-900/95"
              />
            </div>
            {search && (
              <div className="relative flex shrink-0 items-center bg-neutral-50 pl-3 dark:bg-neutral-900">
                <div className="mr-3 mb-1.5 h-3 w-px bg-neutral-200 dark:bg-neutral-800" />
                <button
                  type="button"
                  onClick={search.onOpen}
                  className="relative flex items-center pb-1.5 text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400"
                >
                  搜索
                </button>
                <div className="fade-mask-to-r pointer-events-none absolute top-0 bottom-0 left-0 w-5 bg-neutral-50 dark:bg-neutral-900" />
              </div>
            )}
          </TabBar>
        )}
      </div>

      {search?.active && !query.trim() && Boolean(search.history?.length) && (
        <div className="border-t border-neutral-200/50 px-6 py-3 dark:border-neutral-800/50">
          <div className="flex max-h-14 flex-wrap items-center gap-2 overflow-hidden">
            <span className="shrink-0 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              历史搜索:
            </span>
            {search.history?.map((item, index) => (
              <button
                type="button"
                key={index}
                onClick={() => search.onHistoryClick?.(item)}
                className="shrink-0 bg-neutral-200/30 px-2 py-1 text-xs font-medium whitespace-nowrap text-neutral-400 transition-colors dark:bg-neutral-800/50 dark:text-neutral-400"
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}
      {search?.active && (
        <SearchAllSuggestion
          scopeLabel={search.scopeLabel}
          query={query}
          onClick={search.onSearchAll}
        />
      )}
      {children}
    </div>
  );
}
