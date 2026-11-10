'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  autoUpdate,
  flip,
  FloatingPortal,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import { Check, ChevronsUpDown } from 'lucide-react';
import {
  settingMenuSurface,
  settingMenuViewport,
  settingMenuItem,
} from './settingMenuStyles';

interface SettingComboboxProps {
  value: string;
  options: readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  onOpen?: () => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
}

export default function SettingCombobox({
  value,
  options,
  onChange,
  onOpen,
  ariaLabel,
  placeholder,
  disabled = false,
}: SettingComboboxProps) {
  const [expanded, setExpanded] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const matches = options.filter(
    option =>
      option.value !== value.trim() &&
      (!filtering ||
        `${option.label} ${option.value}`
          .toLowerCase()
          .includes(value.trim().toLowerCase()))
  );
  const open = expanded && !disabled && matches.length > 0;
  const activeOption = matches[activeIndex];
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: setExpanded,
    placement: 'bottom-end',
    strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(4),
      flip({ padding: 12 }),
      shift({ padding: 12 }),
      size({
        padding: 12,
        apply({ availableHeight, availableWidth, elements }) {
          Object.assign(elements.floating.style, {
            maxWidth: `${Math.max(0, availableWidth)}px`,
          });
          elements.floating.style.setProperty(
            '--setting-menu-height',
            `${Math.max(0, availableHeight)}px`
          );
        },
      }),
    ],
  });
  const dismiss = useDismiss(context);
  const { getReferenceProps, getFloatingProps } = useInteractions([dismiss]);
  const setReference = useCallback(
    (node: HTMLDivElement | null) => refs.setReference(node),
    [refs]
  );
  const setFloating = useCallback(
    (node: HTMLDivElement | null) => refs.setFloating(node),
    [refs]
  );

  useEffect(() => {
    if (open && activeOption)
      document
        .getElementById(`${listId}-${activeIndex}`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [open, activeOption, activeIndex, listId]);

  const showOptions = useCallback(() => {
    onOpen?.();
    setFiltering(false);
    setActiveIndex(-1);
    setExpanded(true);
  }, [onOpen]);
  const toggle = useCallback(() => {
    input.current?.focus();
    setFiltering(false);
    setActiveIndex(-1);
    setExpanded(!open);
    if (!open) onOpen?.();
  }, [open, onOpen]);
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
      setFiltering(true);
      setActiveIndex(-1);
      setExpanded(true);
    },
    [onChange]
  );
  const select = useCallback(
    (next: string) => {
      onChange(next);
      input.current?.focus();
      setExpanded(false);
      setActiveIndex(-1);
    },
    [onChange]
  );
  const chooseOption = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => select(event.currentTarget.value),
    [select]
  );
  const keepInputFocus = useCallback(
    (event: MouseEvent) => event.preventDefault(),
    []
  );
  const keyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        setExpanded(true);
        if (matches.length)
          setActiveIndex(index =>
            event.key === 'ArrowDown'
              ? (index + 1) % matches.length
              : index < 0
                ? matches.length - 1
                : (index - 1 + matches.length) % matches.length
          );
      } else if (open && event.key === 'Enter') {
        event.preventDefault();
        if (activeOption) select(activeOption.value);
        else setExpanded(false);
      } else if (open && event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setExpanded(false);
      } else if (event.key === 'Tab') setExpanded(false);
    },
    [matches.length, open, activeOption, select]
  );
  const blur = useCallback(() => setExpanded(false), []);

  return (
    <>
      <div
        ref={setReference}
        data-vaul-no-drag
        className="setting-control flex w-full min-w-0 items-center gap-2"
      >
        <input
          {...getReferenceProps()}
          onKeyDown={keyDown}
          ref={input}
          value={value}
          onChange={change}
          onFocus={showOptions}
          onBlur={blur}
          role="combobox"
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={
            open && activeOption ? `${listId}-${activeIndex}` : undefined
          }
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder={placeholder}
          disabled={disabled}
          className="setting-control min-w-0 flex-1 rounded-none border-0 bg-transparent p-0 text-right text-sm font-normal text-neutral-600 shadow-none select-text placeholder:text-neutral-400 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-neutral-600 disabled:opacity-40 dark:text-neutral-300 dark:placeholder:text-neutral-500 dark:focus-visible:outline-neutral-300"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={`展开${ariaLabel}选项`}
          aria-expanded={open}
          disabled={disabled}
          onMouseDown={keepInputFocus}
          onClick={toggle}
          className="-my-1 -mr-1 flex size-6 shrink-0 items-center justify-center text-neutral-400 disabled:opacity-40 dark:text-neutral-500"
        >
          <ChevronsUpDown className="size-4" />
        </button>
      </div>
      {open && (
        <FloatingPortal>
          <div
            {...getFloatingProps()}
            ref={setFloating}
            style={floatingStyles}
            data-vaul-no-drag
            className={settingMenuSurface}
          >
            <div
              id={listId}
              role="listbox"
              aria-label={ariaLabel}
              className={`max-h-(--setting-menu-height) [scrollbar-width:none] overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden ${settingMenuViewport}`}
            >
              {matches.map((option, index) => (
                <button
                  key={option.value}
                  id={`${listId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={value === option.value}
                  tabIndex={-1}
                  value={option.value}
                  onMouseDown={keepInputFocus}
                  onClick={chooseOption}
                  data-highlighted={index === activeIndex ? '' : undefined}
                  title={
                    option.label === option.value
                      ? option.value
                      : `${option.label} · ${option.value}`
                  }
                  className={`w-full text-right hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 ${settingMenuItem}`}
                >
                  <span className="min-w-0 wrap-anywhere">{option.label}</span>
                  {value === option.value && (
                    <Check className="absolute right-2 size-4 text-neutral-600 dark:text-neutral-300" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
