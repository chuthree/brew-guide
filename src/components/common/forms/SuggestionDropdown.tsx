'use client';

import React, {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/classNameUtils';

const DROPDOWN_ITEM_HEIGHT = 32;
export const DROPDOWN_MAX_HEIGHT = 280;
const DROPDOWN_OVERSCAN = 4;
export const SUGGESTION_DROPDOWN_AVAILABLE_HEIGHT_VAR =
  '--suggestion-dropdown-available-height';
export const SUGGESTION_DROPDOWN_Z_INDEX = 80;

interface SuggestionDropdownProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  'onSelect'
> {
  suggestions: string[];
  onSelect: (value: string) => void;
  isRemovableSuggestion?: (value: string) => boolean;
  onRemoveSuggestion?: (value: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

const SuggestionDropdown = React.forwardRef<
  HTMLDivElement,
  SuggestionDropdownProps
>(
  (
    {
      suggestions,
      onSelect,
      isRemovableSuggestion = () => false,
      onRemoveSuggestion,
      className,
      style,
      onTouchStart,
      ...dropdownProps
    },
    ref
  ) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [scrollTop, setScrollTop] = useState(0);
    const [removedSuggestions, setRemovedSuggestions] = useState<Set<string>>(
      () => new Set()
    );
    const visibleSuggestionValues = useMemo(
      () =>
        suggestions.filter(suggestion => !removedSuggestions.has(suggestion)),
      [removedSuggestions, suggestions]
    );
    const totalHeight = visibleSuggestionValues.length * DROPDOWN_ITEM_HEIGHT;
    const viewportHeight = Math.min(DROPDOWN_MAX_HEIGHT, totalHeight);

    const { visibleSuggestions, offsetY } = useMemo(() => {
      const startIndex = Math.max(
        0,
        Math.floor(scrollTop / DROPDOWN_ITEM_HEIGHT) - DROPDOWN_OVERSCAN
      );
      const visibleCount =
        Math.ceil(viewportHeight / DROPDOWN_ITEM_HEIGHT) +
        DROPDOWN_OVERSCAN * 2;
      const endIndex = Math.min(
        visibleSuggestionValues.length,
        startIndex + visibleCount
      );

      return {
        visibleSuggestions: visibleSuggestionValues
          .slice(startIndex, endIndex)
          .map(suggestion => ({ suggestion })),
        offsetY: startIndex * DROPDOWN_ITEM_HEIGHT,
      };
    }, [scrollTop, visibleSuggestionValues, viewportHeight]);

    useImperativeHandle(ref, () => scrollRef.current as HTMLDivElement, []);

    useEffect(() => {
      setScrollTop(0);
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
    }, [suggestions]);

    return (
      <div
        {...dropdownProps}
        ref={scrollRef}
        data-vaul-no-drag
        onTouchStart={onTouchStart}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        style={{
          ...style,
          maxHeight: `min(var(${SUGGESTION_DROPDOWN_AVAILABLE_HEIGHT_VAR}, ${DROPDOWN_MAX_HEIGHT}px), ${DROPDOWN_MAX_HEIGHT}px)`,
        }}
        className={cn(
          'pointer-events-auto overflow-auto overscroll-contain rounded-md border border-neutral-200/50 bg-white py-1 shadow-lg dark:border-neutral-800/50 dark:bg-neutral-900',
          className
        )}
      >
        <div className="relative" style={{ height: totalHeight }}>
          <div
            className="absolute right-0 left-0"
            style={{ transform: `translateY(${offsetY}px)` }}
          >
            {visibleSuggestions.map(({ suggestion }) => {
              const removable =
                Boolean(onRemoveSuggestion) &&
                isRemovableSuggestion(suggestion);

              return (
                <div
                  key={suggestion}
                  style={{ height: DROPDOWN_ITEM_HEIGHT }}
                  className="flex w-full items-center text-xs font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                >
                  <button
                    type="button"
                    onMouseDown={event => {
                      event.preventDefault();
                    }}
                    onClick={event => {
                      event.preventDefault();
                      event.stopPropagation();
                      onSelect(suggestion);
                    }}
                    onTouchStart={event => event.stopPropagation()}
                    className="flex h-full min-w-0 flex-1 cursor-pointer items-center px-3 text-left"
                  >
                    <span className="min-w-0 truncate">{suggestion}</span>
                  </button>

                  {removable && (
                    <button
                      type="button"
                      aria-label={`移除 ${suggestion}`}
                      onMouseDown={event => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={event => {
                        event.preventDefault();
                        event.stopPropagation();
                        setRemovedSuggestions(current => {
                          const next = new Set(current);
                          next.add(suggestion);
                          return next;
                        });
                        onRemoveSuggestion?.(suggestion);
                      }}
                      className="mr-2 flex size-5 shrink-0 items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
);

SuggestionDropdown.displayName = 'SuggestionDropdown';

export default SuggestionDropdown;
