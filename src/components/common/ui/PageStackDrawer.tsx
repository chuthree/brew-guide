'use client';

import React from 'react';
import { Drawer } from 'vaul';
import { motion, useAnimationControls } from 'framer-motion';

import { useMultiStepModalHistory } from '@/lib/hooks/useModalHistory';
import { modalHistory } from '@/lib/navigation/modalHistory';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { DRAWER_TRANSITION } from './ActionDrawer';

interface PageStackDrawerProps {
  isOpen: boolean;
  title: string;
  activeKey: string;
  canGoBack: boolean;
  doneLabel?: string;
  backLabel?: string;
  doneDisabled?: boolean;
  onCancel: () => void;
  onBack: () => void;
  onDone: () => void;
  children: React.ReactNode;
  historyId: string;
}

export function useDrawerPageStack<PageKey extends string>(
  initialPage: PageKey,
  isOpen: boolean,
  historyId: string,
  onClose: () => void
) {
  const [stack, setStack] = React.useState<PageKey[]>([initialPage]);

  React.useEffect(() => {
    if (!isOpen) {
      setStack([initialPage]);
    }
  }, [initialPage, isOpen]);

  useMultiStepModalHistory({
    id: historyId,
    isOpen,
    step: stack.length,
    onStepChange: step => {
      setStack(current => current.slice(0, Math.max(1, step)));
    },
    onClose,
  });

  const push = React.useCallback((page: PageKey) => {
    setStack(current => [...current, page]);
  }, []);

  const replace = React.useCallback((page: PageKey) => {
    setStack(current =>
      current.length === 0 ? [page] : [...current.slice(0, -1), page]
    );
  }, []);

  const back = React.useCallback(() => {
    modalHistory.back();
  }, []);

  const reset = React.useCallback(() => {
    setStack([initialPage]);
  }, [initialPage]);

  return {
    currentPage: stack[stack.length - 1] || initialPage,
    depth: stack.length,
    canGoBack: stack.length > 1,
    push,
    replace,
    back,
    reset,
  };
}

const PageStackDrawer: React.FC<PageStackDrawerProps> = ({
  isOpen,
  title,
  activeKey,
  canGoBack,
  doneLabel = '完成',
  backLabel,
  doneDisabled = false,
  onCancel,
  onBack,
  onDone,
  children,
}) => {
  const headerRef = React.useRef<HTMLDivElement>(null);
  const pageContentRef = React.useRef<HTMLDivElement | null>(null);
  const [bodyHeight, setBodyHeight] = React.useState<number | 'auto'>('auto');
  const [maxBodyHeight, setMaxBodyHeight] = React.useState<number | undefined>(
    undefined
  );
  const pageControls = useAnimationControls();

  useThemeColor({ useOverlay: true, enabled: isOpen });

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        if (canGoBack) {
          onBack();
          return;
        }
        onCancel();
      }
    },
    [canGoBack, onBack, onCancel]
  );

  const updateMaxBodyHeight = React.useCallback(() => {
    if (typeof window === 'undefined') return;

    const headerHeight = headerRef.current?.offsetHeight || 0;
    setMaxBodyHeight(Math.max(160, window.innerHeight * 0.88 - headerHeight));
  }, []);

  React.useEffect(() => {
    if (!isOpen) {
      setBodyHeight('auto');
      return;
    }

    updateMaxBodyHeight();
    window.addEventListener('resize', updateMaxBodyHeight);
    return () => window.removeEventListener('resize', updateMaxBodyHeight);
  }, [isOpen, updateMaxBodyHeight]);

  const updateBodyHeight = React.useCallback(() => {
    const content = pageContentRef.current;
    if (!content) {
      setBodyHeight('auto');
      return;
    }

    const measuredHeight = content.scrollHeight;
    setBodyHeight(
      maxBodyHeight
        ? Math.min(measuredHeight, maxBodyHeight)
        : measuredHeight || 'auto'
    );
  }, [maxBodyHeight]);

  React.useLayoutEffect(() => {
    if (!isOpen) return;

    void pageControls.start({
      opacity: [0, 1],
      x: [canGoBack ? 18 : -18, 0],
      transition: DRAWER_TRANSITION,
    });
  }, [activeKey, canGoBack, isOpen, pageControls]);

  React.useLayoutEffect(() => {
    if (!isOpen) return;

    const content = pageContentRef.current;
    if (!content) return;

    updateBodyHeight();

    const observer = new ResizeObserver(updateBodyHeight);
    observer.observe(content);

    return () => observer.disconnect();
  }, [activeKey, isOpen, updateBodyHeight]);

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/50" />
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-[61] mx-auto flex max-h-[88vh] max-w-md flex-col rounded-t-3xl bg-neutral-50 outline-none dark:bg-neutral-900"
          aria-describedby={undefined}
        >
          <div className="flex min-h-0 flex-col">
            <div
              ref={headerRef}
              className="grid shrink-0 grid-cols-[minmax(76px,1fr)_auto_minmax(76px,1fr)] items-center px-6 py-5"
            >
              <button
                type="button"
                onClick={canGoBack ? onBack : onCancel}
                className="w-fit cursor-pointer rounded-full bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-600 transition active:scale-95 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {canGoBack ? backLabel || '返回' : '取消'}
              </button>
              <Drawer.Title className="max-w-48 truncate px-3 text-center text-base font-semibold text-neutral-900 dark:text-neutral-50">
                {title}
              </Drawer.Title>
              <button
                type="button"
                onClick={onDone}
                disabled={doneDisabled}
                className="ml-auto w-fit cursor-pointer rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-800 transition active:scale-95 disabled:cursor-default disabled:opacity-30 disabled:active:scale-100 dark:bg-neutral-800 dark:text-neutral-100"
              >
                {doneLabel}
              </button>
            </div>

            <motion.div
              initial={false}
              animate={{ height: bodyHeight }}
              transition={DRAWER_TRANSITION}
              className="relative min-h-0 overflow-hidden"
              style={{ maxHeight: maxBodyHeight }}
            >
              <motion.div
                initial={false}
                animate={pageControls}
                transition={DRAWER_TRANSITION}
                className="h-full min-h-0 overflow-y-auto"
                style={{
                  maxHeight: maxBodyHeight,
                  scrollPaddingBottom:
                    'calc(env(safe-area-inset-bottom) + 20px)',
                }}
              >
                <div
                  ref={pageContentRef}
                  style={{
                    paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
                  }}
                >
                  {children}
                </div>
              </motion.div>
            </motion.div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
};

export default PageStackDrawer;
