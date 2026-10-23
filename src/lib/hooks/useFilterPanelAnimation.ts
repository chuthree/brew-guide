'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion, type Variants } from 'framer-motion';

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

export function useFilterPanelAnimation(isOpen: boolean) {
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const filterContentRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [keyboardInteraction, setKeyboardInteraction] = useState(false);
  const [measurement, setMeasurement] = useState({ height: 0, distance: 0 });
  const filterAnimation = useMemo(
    () => getFilterAnimation(measurement.height, measurement.distance),
    [measurement]
  );

  useLayoutEffect(() => {
    if (!isOpen) return;
    const content = filterContentRef.current;
    if (!content) return;

    const measure = (opening = false) => {
      const height = content.getBoundingClientRect().height;
      const currentHeight =
        filterDropdownRef.current?.getBoundingClientRect().height ?? 0;
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
  }, [isOpen]);

  return {
    filterDropdownRef,
    filterContentRef,
    filterAnimation,
    instantFilterTransition: Boolean(reduceMotion) || keyboardInteraction,
    setKeyboardInteraction,
  };
}
