'use client';

import React from 'react';
import { ChevronRight, Search } from 'lucide-react';
import type { SettingsSearchItem } from './settingsSearch';

interface SettingsSearchResultsProps {
  query: string;
  results: SettingsSearchItem[];
  paddingClass?: string;
  onSelect: (item: SettingsSearchItem) => void;
}

const groupSearchResults = (items: SettingsSearchItem[]) => {
  const groups: Array<{ label: string; items: SettingsSearchItem[] }> = [];
  const groupMap = new Map<string, SettingsSearchItem[]>();

  items.forEach(item => {
    const label = item.groupLabel || '结果';
    const groupItems = groupMap.get(label);

    if (groupItems) {
      groupItems.push(item);
      return;
    }

    const nextGroupItems = [item];
    groupMap.set(label, nextGroupItems);
    groups.push({ label, items: nextGroupItems });
  });

  return groups;
};

const SettingsSearchResultRow: React.FC<{
  item: SettingsSearchItem;
  isLast: boolean;
  onSelect: (item: SettingsSearchItem) => void;
}> = ({ item, isLast, onSelect }) => {
  const selectSearchResult = React.useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);

  return (
    <button
      type="button"
      onClick={selectSearchResult}
      className="flex w-full cursor-pointer items-stretch pr-3.5 pl-[7px] text-left text-sm font-medium text-neutral-800 transition-colors active:bg-black/5 dark:text-neutral-200 dark:active:bg-white/5"
    >
      <div className="flex items-center pr-[7px]">
        <div className="flex size-7 items-center justify-center rounded-md bg-neutral-200/30 dark:bg-neutral-700/10">
          <Search className="size-4 stroke-[1.75px] text-neutral-500 dark:text-neutral-400" />
        </div>
      </div>

      <div
        className={`flex min-w-0 flex-1 items-center justify-between border-b py-3.5 ${
          !isLast ? 'border-black/5 dark:border-white/5' : 'border-transparent'
        }`}
      >
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="max-w-full truncate leading-none">{item.label}</span>
          {(item.description || item.value) && (
            <span className="max-w-full truncate text-xs font-normal text-neutral-400 dark:text-neutral-500">
              {item.description || item.value}
            </span>
          )}
        </div>

        <div className="ml-4 flex shrink-0 items-center gap-2">
          {item.value && item.description && (
            <span className="text-sm text-neutral-400 dark:text-neutral-500">
              {item.value}
            </span>
          )}
          <ChevronRight className="size-4 text-neutral-400/60" />
        </div>
      </div>
    </button>
  );
};

const SettingsSearchResults: React.FC<SettingsSearchResultsProps> = ({
  query,
  results,
  paddingClass = 'px-6',
  onSelect,
}) => {
  const trimmedQuery = query.trim();
  const groupedResults = React.useMemo(
    () => groupSearchResults(results),
    [results]
  );

  if (!trimmedQuery) {
    return null;
  }

  if (results.length === 0) {
    return (
      <div className={`${paddingClass} pt-2 pb-8`}>
        <p className="px-2 text-sm font-medium text-neutral-500 dark:text-neutral-400">
          未找到“{trimmedQuery}”的相关结果
        </p>
      </div>
    );
  }

  return (
    <div className="pt-2 pb-8">
      {groupedResults.map(group => (
        <div key={group.label} className={`${paddingClass} pb-5`}>
          <h3 className="mb-2 px-2 text-xs font-semibold tracking-wider text-neutral-500 uppercase dark:text-neutral-400">
            {group.label}
          </h3>
          <div className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/40">
            {group.items.map((item, index) => (
              <SettingsSearchResultRow
                key={item.id}
                item={item}
                isLast={index === group.items.length - 1}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SettingsSearchResults;
