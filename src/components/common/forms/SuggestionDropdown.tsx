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
const DROPDOWN_MAX_HEIGHT = 280;
const DROPDOWN_OVERSCAN = 4;

interface SuggestionDropdownProps {
  suggestions: string[];
  onSelect: (value: string) => void;
  isRemovableSuggestion?: (value: string) => boolean;
  onRemoveSuggestion?: (value: string) => void;
  className?: string;
  onTouchStart?: (event: React.TouchEvent<HTMLDivElement>) => void;
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
      onTouchStart,
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
          .map((suggestion, index) => ({
            suggestion,
            index: startIndex + index,
          })),
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
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        style={{ maxHeight: DROPDOWN_MAX_HEIGHT }}
        className={cn(
          'absolute right-0 left-0 z-50 mt-1 overflow-auto rounded-md border border-neutral-200/50 bg-white py-1 shadow-lg dark:border-neutral-800/50 dark:bg-neutral-900',
          className
        )}
      >
        <div className="relative" style={{ height: totalHeight }}>
          <div
            className="absolute right-0 left-0"
            style={{ transform: `translateY(${offsetY}px)` }}
          >
            {visibleSuggestions.map(({ suggestion, index }) => {
              const removable =
                Boolean(onRemoveSuggestion) &&
                isRemovableSuggestion(suggestion);

              return (
                <div
                  key={`${suggestion}-${index}`}
                  style={{ height: DROPDOWN_ITEM_HEIGHT }}
                  className="flex w-full items-center text-xs font-medium text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
                >
                  <button
                    type="button"
                    onMouseDown={event => {
                      event.preventDefault();
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
                        setRemovedSuggestions(current => {
                          const next = new Set(current);
                          next.add(suggestion);
                          return next;
                        });
                        onRemoveSuggestion?.(suggestion);
                      }}
                      className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                      <X className="h-3 w-3" />
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
