'use client';

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { calcInputWidth } from '../utils';
import SuggestionDropdown from '@/components/common/forms/SuggestionDropdown';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from '@floating-ui/react';

interface TagAutocompleteInputProps {
  placeholder: string;
  suggestions: string[];
  onCommit: (value: string) => void;
  onBackspaceEmpty?: () => string | undefined;
  isCustomPreset?: (value: string) => boolean;
  onRemovePreset?: (value: string) => void;
}

const COMMIT_KEYS = new Set(['Enter', ',', '，', '、', ';', '；']);

const getActiveSuggestionQuery = (value: string) => {
  const segments = value.split(/[,，、;；]/);
  return (segments[segments.length - 1] || '').trim();
};

const TagAutocompleteInput: React.FC<TagAutocompleteInputProps> = ({
  placeholder,
  suggestions,
  onCommit,
  onBackspaceEmpty,
  isCustomPreset = () => false,
  onRemovePreset,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [removedSuggestions, setRemovedSuggestions] = useState<Set<string>>(
    () => new Set()
  );
  const closeTimerRef = useRef<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: 'bottom-start',
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: 'listbox' });
  const { getFloatingProps } = useInteractions([dismiss, role]);

  const setInputElement = useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      refs.setReference(node);
    },
    [refs]
  );

  const setFloatingElement = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs]
  );

  const filteredSuggestions = useMemo(() => {
    const query = getActiveSuggestionQuery(inputValue).toLowerCase();
    const visibleSuggestions = suggestions.filter(
      suggestion => !removedSuggestions.has(suggestion)
    );

    if (!query) {
      return visibleSuggestions;
    }

    return visibleSuggestions.filter(suggestion =>
      suggestion.toLowerCase().includes(query)
    );
  }, [inputValue, removedSuggestions, suggestions]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const commitValue = (value: string) => {
    const nextValue = value.trim();
    if (!nextValue) return;

    onCommit(nextValue);
    setInputValue('');
    setIsOpen(false);
  };

  const handleFocus = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    if (filteredSuggestions.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlur = () => {
    closeTimerRef.current = window.setTimeout(() => {
      commitValue(inputValue);
      setIsOpen(false);
    }, 120);
  };

  return (
    <span className="relative inline-flex max-w-full">
      <input
        ref={setInputElement}
        type="text"
        value={inputValue}
        placeholder={placeholder}
        onChange={event => {
          const nextValue = event.currentTarget.value;
          setInputValue(nextValue);
          setIsOpen(filteredSuggestions.length > 0 || nextValue.trim() !== '');
        }}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;

          if (COMMIT_KEYS.has(event.key)) {
            if (inputValue.trim()) {
              event.preventDefault();
              commitValue(inputValue);
            }
          }

          if (
            event.key === 'Backspace' &&
            !inputValue.trim() &&
            onBackspaceEmpty
          ) {
            event.preventDefault();
            const restoredValue = onBackspaceEmpty();
            if (restoredValue) {
              setInputValue(restoredValue);
              setIsOpen(true);
            }
          }

          if (event.key === 'Escape') {
            setIsOpen(false);
          }
        }}
        className="max-w-full bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700 placeholder:text-neutral-400 focus:outline-none dark:bg-neutral-800/40 dark:text-neutral-300 dark:placeholder:text-neutral-500"
        style={{ width: calcInputWidth(inputValue, placeholder) }}
      />

      {isOpen && filteredSuggestions.length > 0 && (
        <FloatingPortal>
          <SuggestionDropdown
            ref={setFloatingElement}
            suggestions={filteredSuggestions}
            onSelect={suggestion => {
              commitValue(suggestion);
              inputRef.current?.focus();
            }}
            isRemovableSuggestion={isCustomPreset}
            onRemoveSuggestion={
              onRemovePreset
                ? suggestion => {
                    setRemovedSuggestions(current => {
                      const next = new Set(current);
                      next.add(suggestion);
                      return next;
                    });
                    onRemovePreset(suggestion);
                    if (inputValue === suggestion) {
                      setInputValue('');
                    }
                  }
                : undefined
            }
            style={{
              ...floatingStyles,
              zIndex: 50,
              minWidth: 128,
            }}
            {...getFloatingProps()}
          />
        </FloatingPortal>
      )}
    </span>
  );
};

export default TagAutocompleteInput;
