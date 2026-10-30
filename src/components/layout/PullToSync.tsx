'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type TouchEvent,
  type MouseEvent,
} from 'react';
import { ArrowDown, LoaderCircle } from 'lucide-react';
import { createPortal } from 'react-dom';
import {
  FEEDBACK_PILL_CLASS_NAME,
  showToast,
} from '@/components/common/feedback/LightToast';
import hapticsUtils from '@/lib/ui/haptics';

const TRIGGER_DISTANCE = 120;
const MAX_OFFSET = 80;

interface PullToSyncProps {
  enabled: boolean;
  contextKey: string;
  indicatorHost: HTMLElement | null;
  hapticFeedback: boolean;
  onSync: () => Promise<{ success: boolean; message?: string }>;
  children: ReactNode;
}

interface Gesture {
  id: number;
  x: number;
  y: number;
  target: Element;
  contextKey: string;
  ready: boolean;
}

// 只检查导航触控区域，内容列表的位置不影响同步手势。
export function isAtTop(target: Element, boundary: HTMLElement): boolean {
  for (
    let element: Element | null = target;
    element;
    element = element.parentElement
  ) {
    if (element.scrollTop > 1) return false;
    if (element === boundary) return true;
  }
  return false;
}

export function getPullDistance(dx: number, dy: number): number | null {
  if (dy < 0 || (Math.abs(dx) > 8 && Math.abs(dx) > dy)) return null;
  return dy < 8 ? 0 : dy;
}

export default function PullToSync({
  enabled,
  contextKey,
  indicatorHost,
  hapticFeedback,
  onSync,
  children,
}: PullToSyncProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const busyRef = useRef(false);
  const suppressClickRef = useRef(false);
  const mountedRef = useRef(false);
  const [pull, setPull] = useState({ distance: 0, ready: false, contextKey });
  const [isSyncing, setIsSyncing] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const resetGesture = useCallback(() => {
    gestureRef.current = null;
    setPull({ distance: 0, ready: false, contextKey });
  }, [contextKey]);

  const handleStart = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      resetGesture();
      suppressClickRef.current = false;
      const target = event.target;
      const surface = surfaceRef.current;
      if (
        !enabled ||
        busyRef.current ||
        event.touches.length !== 1 ||
        !(target instanceof Element) ||
        !surface?.contains(target) ||
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="slider"], [role="dialog"], [data-no-pull-sync]'
        ) ||
        !isAtTop(target, surface)
      )
        return;
      const touch = event.touches[0];
      gestureRef.current = {
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        target,
        contextKey,
        ready: false,
      };
    },
    [enabled, contextKey, resetGesture]
  );

  const handleMove = useCallback(
    (event: TouchEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      if (!gesture) return;
      const touch = event.touches[0];
      const surface = surfaceRef.current;
      if (
        !enabled ||
        event.touches.length !== 1 ||
        touch.identifier !== gesture.id ||
        gesture.contextKey !== contextKey ||
        !surface ||
        !isAtTop(gesture.target, surface)
      ) {
        resetGesture();
        return;
      }
      const dx = touch.clientX - gesture.x;
      const dy = touch.clientY - gesture.y;
      const distance = getPullDistance(dx, dy);
      if (distance === null) {
        resetGesture();
        return;
      }
      if (distance > 8) suppressClickRef.current = true;
      const ready = distance >= TRIGGER_DISTANCE;
      if (ready && !gesture.ready && hapticFeedback) hapticsUtils.light();
      gesture.ready = ready;
      setPull({ distance, ready, contextKey });
    },
    [enabled, contextKey, hapticFeedback, resetGesture]
  );

  const handleEnd = useCallback(
    async (event: TouchEvent<HTMLDivElement>) => {
      const gesture = gestureRef.current;
      const touch = event.changedTouches[0];
      resetGesture();
      if (
        !gesture ||
        !enabled ||
        busyRef.current ||
        event.touches.length ||
        gesture.contextKey !== contextKey ||
        !gesture.ready ||
        !touch ||
        touch.identifier !== gesture.id ||
        (getPullDistance(
          touch.clientX - gesture.x,
          touch.clientY - gesture.y
        ) ?? 0) < TRIGGER_DISTANCE ||
        !surfaceRef.current ||
        !isAtTop(gesture.target, surfaceRef.current)
      )
        return;
      busyRef.current = true;
      setIsSyncing(true);
      try {
        const result = await onSync();
        if (!mountedRef.current) return;
        setAnnouncement(
          result.message || (result.success ? '同步完成' : '同步失败，请重试')
        );
        if (hapticFeedback) {
          if (result.success) hapticsUtils.success();
          else hapticsUtils.error();
        }
        showToast({
          type: result.success ? 'success' : 'error',
          title:
            result.message ||
            (result.success ? '同步完成' : '同步失败，请重试'),
          duration: result.success ? 2500 : 5000,
        });
      } catch (error) {
        if (mountedRef.current) {
          const message =
            error instanceof Error ? error.message : '同步失败，请重试';
          setAnnouncement(message);
          showToast({ type: 'error', title: message, duration: 5000 });
        }
      } finally {
        busyRef.current = false;
        if (mountedRef.current) setIsSyncing(false);
      }
    },
    [enabled, contextKey, hapticFeedback, onSync, resetGesture]
  );

  const handleClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (suppressClickRef.current && event.detail !== 0) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
      }
    },
    []
  );

  const distance =
    enabled && pull.contextKey === contextKey ? pull.distance : 0;
  const visible = isSyncing || distance > 8;
  const offset = isSyncing ? 56 : MAX_OFFSET * (1 - Math.exp(-distance / 120));
  const label = isSyncing ? '正在同步' : pull.ready ? '松开同步' : '下拉同步';

  return (
    <div
      ref={surfaceRef}
      className={`contents ${enabled ? '[&>*]:overscroll-y-none' : ''}`}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={resetGesture}
      onClickCapture={handleClickCapture}
    >
      {children}
      {indicatorHost &&
        createPortal(
          <>
            <div
              className="pt-safe-top pointer-events-none absolute inset-x-0 top-0 flex justify-center overflow-hidden"
              aria-hidden="true"
            >
              <div
                className={`${FEEDBACK_PILL_CLASS_NAME} flex items-center gap-2 ${distance > 0 && !isSyncing ? '' : 'transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]'} motion-reduce:transition-none`}
                style={{
                  marginBottom: 40,
                  transform: `translateY(calc(-100% + ${visible ? offset : -4}px))`,
                  opacity: visible
                    ? Math.min(1, (isSyncing ? 120 : distance) / 40)
                    : 0,
                }}
              >
                {isSyncing ? (
                  <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                ) : (
                  <ArrowDown
                    className="size-4 transition-transform duration-150 motion-reduce:transition-none"
                    style={{
                      transform: pull.ready ? 'rotate(180deg)' : 'none',
                    }}
                  />
                )}
                <span>{label}</span>
              </div>
            </div>
            <span
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only"
            >
              {isSyncing ? '正在同步数据' : announcement}
            </span>
          </>,
          indicatorHost
        )}
    </div>
  );
}
