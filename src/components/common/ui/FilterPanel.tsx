'use client';

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEventHandler,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
  type Variants,
} from 'framer-motion';
import { AlignLeft } from 'lucide-react';

const getFilterDuration = (distance: number) =>
  Math.min(0.32, Math.max(0.18, 0.2 + (distance - 80) * 0.00035));

// 筛选栏在文档流中展开，需要高度过渡让下方列表平顺让位。
const getFilterAnimation = (height: number, distance: number): Variants => ({
  open: (instant: boolean) => ({
    height,
    opacity: 1,
    transition: {
      duration: instant ? 0 : getFilterDuration(distance),
      ease: [0.23, 1, 0.32, 1],
      opacity: { duration: instant ? 0 : 0.12, ease: 'linear' },
    },
  }),
  closed: (instant: boolean) => ({
    height: 0,
    opacity: 0,
    transition: {
      duration: instant ? 0 : getFilterDuration(height) * 0.8,
      ease: [0.23, 1, 0.32, 1],
      opacity: { duration: instant ? 0 : 0.08, ease: 'linear' },
    },
  }),
});

interface FilterPanelProps {
  id: string;
  isOpen: boolean;
  panelRef: RefObject<HTMLDivElement | null>;
  keyboardInteraction: boolean;
  children: ReactNode;
}

function FilterPanelContent({
  contentRef,
  children,
}: {
  contentRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const isPresent = useIsPresent();
  return (
    <div
      ref={contentRef}
      inert={!isPresent}
      className="space-y-4 border-t border-neutral-200/50 px-6 py-4 dark:border-neutral-800/50"
    >
      {children}
    </div>
  );
}

export function FilterPanel({
  id,
  isOpen,
  panelRef,
  keyboardInteraction,
  children,
}: FilterPanelProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const instant = Boolean(reduceMotion) || keyboardInteraction;
  const [measurement, setMeasurement] = useState({ height: 0, distance: 0 });
  const filterAnimation = useMemo(
    () => getFilterAnimation(measurement.height, measurement.distance),
    [measurement]
  );

  useLayoutEffect(() => {
    if (!isOpen) return;
    const content = contentRef.current;
    if (!content) return;

    const measure = (opening = false) => {
      const height = content.getBoundingClientRect().height;
      const currentHeight =
        panelRef.current?.getBoundingClientRect().height ?? 0;
      setMeasurement(current =>
        !opening && current.height === height
          ? current
          : { height, distance: Math.abs(height - currentHeight) }
      );
    };
    measure(true);
    const observer = new ResizeObserver(() => measure());
    observer.observe(content);
    return () => observer.disconnect();
  }, [isOpen, panelRef]);

  return (
    <AnimatePresence custom={instant}>
      {isOpen && (
        <motion.div
          key="filter-panel"
          id={id}
          ref={panelRef}
          custom={instant}
          variants={filterAnimation}
          initial="closed"
          animate="open"
          exit="closed"
          className="overflow-hidden"
        >
          <FilterPanelContent contentRef={contentRef}>
            {children}
          </FilterPanelContent>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FilterPanelTrigger({
  panelId,
  isOpen,
  onClick,
}: {
  panelId: string;
  isOpen: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
}) {
  return (
    <button
      type="button"
      aria-controls={panelId}
      aria-expanded={isOpen}
      aria-label="筛选选项"
      onClick={onClick}
      className="mr-1 flex items-center pb-1.5 text-xs font-medium text-neutral-400 dark:text-neutral-600"
    >
      <AlignLeft size={12} aria-hidden="true" />
    </button>
  );
}

export function FilterButton({
  isActive,
  onClick,
  children,
  className = '',
  disabled = false,
}: {
  isActive: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={isActive}
      data-tab-active={isActive}
      className={`px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
        isActive
          ? 'bg-neutral-300/30 text-neutral-800 dark:bg-neutral-600/50 dark:text-neutral-200'
          : 'bg-neutral-200/30 text-neutral-400 dark:bg-neutral-800/50 dark:text-neutral-400'
      } ${disabled ? 'cursor-not-allowed opacity-40' : ''} ${className}`}
    >
      {children}
    </button>
  );
}
