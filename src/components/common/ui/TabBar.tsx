'use client';

import { useLayoutEffect, useRef, type ComponentProps } from 'react';
import { animate, type AnimationPlaybackControls } from 'framer-motion';
import { cn } from '@/lib/utils/classNameUtils';
import {
  getHorizontalWheelDelta,
  getNextHorizontalScrollLeft,
} from '@/lib/hooks/useHorizontalWheelScroll';
import styles from './TabBar.module.css';

/** Shared category scrolling and indicator; callers only own selection and content. */
export default function TabBar({
  children,
  className,
  multiple = false,
  ...props
}: Omit<ComponentProps<'div'>, 'ref'> & { multiple?: boolean }) {
  const barRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const previousTab = useRef<HTMLElement | null>(null);
  const animation = useRef<AnimationPlaybackControls | null>(null);

  useLayoutEffect(() => () => {
    animation.current?.stop();
    animation.current = null;
  }, []);

  useLayoutEffect(() => {
    const bar = barRef.current;
    const indicator = indicatorRef.current;
    if (!bar || !indicator) return;

    const scroller =
      bar.querySelector<HTMLElement>('[data-category-scroll]') ?? bar;
    const isScrollable = () =>
      ['auto', 'scroll'].includes(getComputedStyle(scroller).overflowX) &&
      scroller.scrollWidth > scroller.clientWidth;
    const scrollTarget = (tab: HTMLElement | null, center: boolean) => {
      const current = scroller.scrollLeft;
      if (!tab || !scroller.contains(tab) || !isScrollable()) return current;
      const viewport = scroller.getBoundingClientRect();
      const target = tab.getBoundingClientRect();
      if (
        !center &&
        target.left >= viewport.left &&
        target.right <= viewport.right
      ) {
        return current;
      }
      const scale = viewport.width / scroller.offsetWidth || 1;
      return Math.max(
        0,
        Math.min(
          scroller.scrollWidth - scroller.clientWidth,
          current +
            (target.left + target.width / 2 - viewport.left - viewport.width / 2) / scale
        )
      );
    };
    const updateEdges = () => {
      const scrollable = isScrollable();
      bar.dataset.scrollLeft = String(scrollable && scroller.scrollLeft > 1);
      bar.dataset.scrollRight = String(
        scrollable &&
          scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 1
      );
    };

    const stop = () => {
      animation.current?.stop();
      animation.current = null;
    };
    const update = (smooth: boolean, center = false) => {
      if (multiple) {
        stop();
        indicator.hidden = true;
        updateEdges();
        return;
      }
      const tab = bar.querySelector<HTMLElement>('[data-tab-active="true"]');
      stop();
      const fromScroll = scroller.scrollLeft;
      const toScroll = center ? scrollTarget(tab, true) : fromScroll;
      updateEdges();
      if (!tab || !tab.getClientRects().length) {
        indicator.hidden = true;
        previousTab.current = null;
        return;
      }

      // 背景按钮也需要选中项定位，只是不绘制下划线。
      if (parseFloat(getComputedStyle(tab).borderBottomWidth) === 0) {
        indicator.hidden = true;
        if (center && fromScroll !== toScroll) scroller.scrollLeft = toScroll;
        previousTab.current = tab;
        updateEdges();
        return;
      }

      const bounds = bar.getBoundingClientRect();
      const target = tab.getBoundingClientRect();
      const scaleX = bounds.width / bar.offsetWidth || 1;
      const scaleY = bounds.height / bar.offsetHeight || 1;
      const viewport = scroller.getBoundingClientRect();
      const scrollScale = viewport.width / scroller.offsetWidth || 1;
      const delta = scroller.contains(tab)
        ? (toScroll - fromScroll) * scrollScale
        : 0;
      let left = target.left - delta;
      let right = target.right - delta;
      // Clip to the scrolling viewport, without putting the line below its masks.
      for (
        let parent = tab.parentElement;
        parent && parent !== bar;
        parent = parent.parentElement
      ) {
        if (getComputedStyle(parent).overflowX !== 'visible') {
          const viewport = parent.getBoundingClientRect();
          left = Math.max(left, viewport.left);
          right = Math.min(right, viewport.right);
        }
      }
      const x = (left - bounds.left) / scaleX - bar.clientLeft;
      const y = (target.bottom - bounds.top) / scaleY - bar.clientTop - 1;
      const width = Math.max(0, right - left) / scaleX;
      const current = indicator.getBoundingClientRect();
      const fromX = (current.left - bounds.left) / scaleX - bar.clientLeft;
      const fromY = (current.top - bounds.top) / scaleY - bar.clientTop;
      const fromWidth = current.width / scaleX;
      const canAnimate =
        smooth && !indicator.hidden &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const barScrollLeft = bar.scrollLeft;
      const barScrollTop = bar.scrollTop;
      // One clock drives both positions. All geometry is read before animation.
      const draw = (progress: number) => {
        const scroll = fromScroll + (toScroll - fromScroll) * progress;
        if (center && fromScroll !== toScroll) scroller.scrollLeft = scroll;
        const currentX =
          fromX + (x - fromX) * progress +
          (bar === scroller ? scroll : barScrollLeft);
        const currentY = fromY + (y - fromY) * progress + barScrollTop;
        const currentWidth = fromWidth + (width - fromWidth) * progress;
        indicator.style.transform = `translate(${currentX}px, ${currentY}px) scaleX(${currentWidth})`;
        indicator.hidden = currentWidth === 0;
      };
      previousTab.current = tab;
      if (canAnimate) {
        animation.current = animate(0, 1, {
          duration: 0.18,
          ease: [0.23, 1, 0.32, 1],
          onUpdate: draw,
          onComplete: () => {
            animation.current = null;
            updateEdges();
          },
        });
      } else {
        draw(1);
        updateEdges();
      }
    };

    const selectedTab = bar.querySelector('[data-tab-active="true"]');
    if (selectedTab !== previousTab.current) update(true, true);
    else if (!animation.current) update(false);
    const reposition = () => {
      if (!animation.current) update(false);
    };
    let viewportWidth = scroller.clientWidth;
    const resize = () => {
      stop();
      const widthChanged = scroller.clientWidth !== viewportWidth;
      viewportWidth = scroller.clientWidth;
      if (!multiple && widthChanged) {
        const nextScrollLeft = scrollTarget(
          bar.querySelector('[data-tab-active="true"]'),
          false
        );
        if (scroller.scrollLeft !== nextScrollLeft) {
          scroller.scrollLeft = nextScrollLeft;
        }
      }
      reposition();
    };
    const handleClick = (event: MouseEvent) => {
      const tab = (event.target as Element).closest<HTMLElement>(
        '[data-tab-active="true"]'
      );
      if (tab && event.detail < 2) {
        update(true, true);
      }
    };
    const handleWheel = (event: WheelEvent) => {
      stop();
      if (!isScrollable()) return;
      const { nextScrollLeft, shouldConsume } = getNextHorizontalScrollLeft({
        scrollLeft: scroller.scrollLeft,
        scrollWidth: scroller.scrollWidth,
        clientWidth: scroller.clientWidth,
        delta: getHorizontalWheelDelta(event, scroller.clientWidth),
      });
      if (!shouldConsume) return;
      event.preventDefault();
      scroller.scrollLeft = nextScrollLeft;
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target as Element).closest('[data-tab-active]')) stop();
    };
    // ResizeObserver's first delivery is registration, not a layout change.
    let initialObservation = true;
    const observer = new ResizeObserver(() => {
      if (!initialObservation) resize();
      initialObservation = false;
    });
    observer.observe(bar);
    observer.observe(scroller);
    bar
      .querySelectorAll<HTMLElement>('[data-tab-active]')
      .forEach(tab => observer.observe(tab));
    bar.addEventListener('scroll', reposition, true);
    bar.addEventListener('click', handleClick);
    scroller.addEventListener('pointerdown', handlePointerDown);
    scroller.addEventListener('touchmove', stop, { passive: true });
    scroller.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', resize);
    return () => {
      observer.disconnect();
      bar.removeEventListener('scroll', reposition, true);
      bar.removeEventListener('click', handleClick);
      scroller.removeEventListener('pointerdown', handlePointerDown);
      scroller.removeEventListener('touchmove', stop);
      scroller.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', resize);
    };
  });

  return (
    <div
      {...props}
      ref={barRef}
      data-multiple={multiple}
      className={cn(styles.bar, className)}
    >
      {children}
      <span
        ref={indicatorRef}
        aria-hidden="true"
        hidden
        className={cn(styles.indicator, 'bg-neutral-800 dark:bg-white')}
      />
    </div>
  );
}
