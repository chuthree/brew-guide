'use client';

import React from 'react';
import { Search } from 'lucide-react';
import SearchEmptyIcon from '@public/images/icons/ui/settings-search-empty.svg';
import type { SettingsSearchItem } from './settingsSearch';

interface SettingsSearchResultsProps {
  query: string;
  results: SettingsSearchItem[];
  paddingClass?: string;
  onSelect: (item: SettingsSearchItem) => void;
}

const SettingsSearchResultRow: React.FC<{
  item: SettingsSearchItem;
  isLast: boolean;
  onSelect: (item: SettingsSearchItem) => void;
}> = ({ item, isLast, onSelect }) => {
  const selectSearchResult = React.useCallback(() => {
    onSelect(item);
  }, [item, onSelect]);
  const Icon = item.icon ?? Search;
  const entryPath = item.entryPath?.join(' → ');

  return (
    <button
      type="button"
      onClick={selectSearchResult}
      className="flex w-full cursor-pointer items-stretch pr-3.5 pl-[7px] text-left text-sm font-medium text-neutral-800 transition-colors active:bg-black/5 dark:text-neutral-200 dark:active:bg-white/5"
    >
      <div className="flex items-center pr-[7px]">
        <div className="flex size-7 items-center justify-center rounded-md bg-neutral-200/30 dark:bg-neutral-700/10">
          <Icon className="size-4 stroke-[1.5px] text-neutral-600 dark:text-neutral-300" />
        </div>
      </div>

      <div
        className={`flex min-w-0 flex-1 items-center justify-between border-b py-3.5 ${
          !isLast ? 'border-black/5 dark:border-white/5' : 'border-transparent'
        }`}
      >
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          <span className="max-w-full truncate leading-none">{item.label}</span>
          {entryPath && (
            <span className="max-w-full truncate text-xs font-normal text-neutral-400 dark:text-neutral-500">
              {entryPath}
            </span>
          )}
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

  if (!trimmedQuery) {
    return null;
  }

  if (results.length === 0) {
    return (
      <div
        className={`${paddingClass} flex min-h-[calc(100dvh-14rem)] flex-col items-center justify-center pt-2 pb-8 text-center text-neutral-700 dark:text-neutral-200`}
      >
        <SearchEmptyIcon
          aria-hidden="true"
          className="mb-5 h-32 w-32 [&_path]:stroke-[0.9px]"
        />
        <p className="max-w-72 text-base leading-relaxed font-medium">
          未找到「{trimmedQuery}」的相关结果
        </p>
      </div>
    );
  }

  return (
    <div className={`${paddingClass} pt-2 pb-8`}>
      <div className="overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/40">
        {results.map((item, index) => (
          <SettingsSearchResultRow
            key={item.id}
            item={item}
            isLast={index === results.length - 1}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

export default SettingsSearchResults;
