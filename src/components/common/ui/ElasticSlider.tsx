'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from 'framer-motion';
import { cn } from '@/lib/utils/classNameUtils';

const CLICK_THRESHOLD = 3;
const DEAD_ZONE = 32;
const MAX_CURSOR_RANGE = 200;
const MAX_STRETCH = 8;
const HANDLE_BUFFER = 8;
const LABEL_OFFSET = 16;
const VALUE_OFFSET = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function decimalsForStep(step: number): number {
  const text = step.toString();
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

function roundValue(value: number, step: number): number {
  const rounded = Math.round(value / step) * step;
  return Number(rounded.toFixed(decimalsForStep(step)));
}

function snapToDecile(value: number, min: number, max: number): number {
  const range = max - min;
  if (range <= 0) return min;

  const normalized = (value - min) / range;
  const nearest = Math.round(normalized * 10) / 10;

  return Math.abs(normalized - nearest) <= 0.03125
    ? min + nearest * range
    : value;
}

export type ElasticSliderProps = {
  label: string;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  onValueCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
  height?: React.CSSProperties['height'];
  radius?: React.CSSProperties['borderRadius'];
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  handleClassName?: string;
  hashMarkClassName?: string;
  textClassName?: string;
  labelClassName?: string;
  valueClassName?: string;
  'aria-label'?: string;
};

type ElasticSliderStyle = React.CSSProperties & {
  '--elastic-slider-height'?: string;
  '--elastic-slider-radius'?: string;
};

function toCssLength(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

export function ElasticSlider({
  label,
  value: valueProp,
  defaultValue,
  onValueChange,
  onValueCommit,
  min = 0,
  max = 1,
  step = 0.01,
  formatValue,
  height,
  radius,
  className,
  trackClassName,
  fillClassName,
  handleClassName,
  hashMarkClassName,
  textClassName,
  labelClassName,
  valueClassName,
  'aria-label': ariaLabel,
}: ElasticSliderProps) {
  const isControlled = valueProp !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(
    defaultValue ?? min
  );
  const safeStep = step > 0 ? step : 1;
  const safeMax = max > min ? max : min + safeStep;
  const value = clamp(
    roundValue(isControlled ? valueProp : uncontrolledValue, safeStep),
    min,
    safeMax
  );
  const range = safeMax - min;
  const percentage = ((value - min) / range) * 100;
  const displayValue = formatValue
    ? formatValue(value)
    : value.toFixed(decimalsForStep(safeStep));

  const wrapperRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const valueRef = useRef<HTMLSpanElement>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const wrapperRectRef = useRef<DOMRect | null>(null);
  const scaleRef = useRef(1);
  const pendingPointerFocusRef = useRef(false);
  const isClickRef = useRef(true);
  const animRef = useRef<ReturnType<typeof animate> | null>(null);
  const currentValueRef = useRef(value);

  const [isInteracting, setIsInteracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [keyboardFocusRing, setKeyboardFocusRing] = useState(false);
  const [dodge, setDodge] = useState({ left: 38, right: 72 });

  const shouldReduceMotion = useReducedMotion();
  const isActive = isInteracting || isHovered;
  const fillPercent = useMotionValue(percentage);
  const fillWidth = useTransform(fillPercent, pct => `${pct}%`);
  const handleLeft = useTransform(
    fillPercent,
    pct => `max(4px, calc(${pct}% - 8px))`
  );
  const rubberStretch = useMotionValue(0);
  const rubberWidth = useTransform(
    rubberStretch,
    stretch => `calc(100% + ${Math.abs(stretch)}px)`
  );
  const rubberX = useTransform(rubberStretch, stretch =>
    stretch < 0 ? stretch : 0
  );

  const setValue = useCallback(
    (nextValue: number) => {
      const next = clamp(roundValue(nextValue, safeStep), min, safeMax);
      currentValueRef.current = next;

      if (!isControlled) {
        setUncontrolledValue(next);
      }

      if (next !== value) {
        onValueChange?.(next);
      }
    },
    [isControlled, min, onValueChange, safeMax, safeStep, value]
  );

  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!isInteracting && !animRef.current) {
      fillPercent.jump(percentage);
    }
  }, [fillPercent, isInteracting, percentage]);

  const percentFromValue = useCallback(
    (nextValue: number) => ((nextValue - min) / range) * 100,
    [min, range]
  );

  const positionToValue = useCallback(
    (clientX: number) => {
      const rect = wrapperRectRef.current;
      if (!rect) return min;

      const sceneX = (clientX - rect.left) / scaleRef.current;
      const nativeWidth = wrapperRef.current?.offsetWidth ?? rect.width;
      const percent = clamp(sceneX / nativeWidth, 0, 1);

      return clamp(min + percent * range, min, safeMax);
    },
    [min, range, safeMax]
  );

  const animateFillTo = useCallback(
    (targetPercent: number) => {
      animRef.current?.stop();

      if (shouldReduceMotion) {
        fillPercent.jump(targetPercent);
        animRef.current = null;
        return;
      }

      animRef.current = animate(fillPercent, targetPercent, {
        type: 'spring',
        stiffness: 300,
        damping: 25,
        mass: 0.8,
        onComplete: () => {
          animRef.current = null;
        },
      });
    },
    [fillPercent, shouldReduceMotion]
  );

  const computeRubberStretch = useCallback((clientX: number, sign: number) => {
    const rect = wrapperRectRef.current;
    if (!rect) return 0;

    const distancePast = sign < 0 ? rect.left - clientX : clientX - rect.right;
    const overflow = Math.max(0, distancePast - DEAD_ZONE);

    return (
      sign * MAX_STRETCH * Math.sqrt(Math.min(overflow / MAX_CURSOR_RANGE, 1))
    );
  }, []);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    pointerDownPos.current = { x: event.clientX, y: event.clientY };
    isClickRef.current = true;
    setIsInteracting(true);
    pendingPointerFocusRef.current = true;
    setKeyboardFocusRing(false);
    trackRef.current?.focus({ preventScroll: true });

    requestAnimationFrame(() => {
      pendingPointerFocusRef.current = false;
    });

    const wrapper = wrapperRef.current;
    if (wrapper) {
      const rect = wrapper.getBoundingClientRect();
      wrapperRectRef.current = rect;
      scaleRef.current = rect.width / wrapper.offsetWidth;
    }
  }, []);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      event.stopPropagation();

      if (!isInteracting || !pointerDownPos.current) return;

      const dx = event.clientX - pointerDownPos.current.x;
      const dy = event.clientY - pointerDownPos.current.y;

      if (isClickRef.current && Math.hypot(dx, dy) > CLICK_THRESHOLD) {
        isClickRef.current = false;
        setIsDragging(true);
      }

      if (isClickRef.current) return;

      const rect = wrapperRectRef.current;
      if (rect && !shouldReduceMotion) {
        if (event.clientX < rect.left) {
          rubberStretch.jump(computeRubberStretch(event.clientX, -1));
        } else if (event.clientX > rect.right) {
          rubberStretch.jump(computeRubberStretch(event.clientX, 1));
        } else {
          rubberStretch.jump(0);
        }
      }

      const nextValue = positionToValue(event.clientX);
      animRef.current?.stop();
      animRef.current = null;
      fillPercent.jump(percentFromValue(nextValue));
      setValue(nextValue);
    },
    [
      computeRubberStretch,
      fillPercent,
      isInteracting,
      percentFromValue,
      positionToValue,
      rubberStretch,
      setValue,
      shouldReduceMotion,
    ]
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      event.stopPropagation();

      if (!isInteracting) return;

      if (isClickRef.current) {
        const rawValue = positionToValue(event.clientX);
        const discreteSteps = range / safeStep;
        const snapped =
          discreteSteps <= 10
            ? clamp(
                min + Math.round((rawValue - min) / safeStep) * safeStep,
                min,
                safeMax
              )
            : snapToDecile(rawValue, min, safeMax);

        animateFillTo(percentFromValue(snapped));
        setValue(snapped);
      }

      onValueCommit?.(currentValueRef.current);

      if (!shouldReduceMotion && rubberStretch.get() !== 0) {
        animate(rubberStretch, 0, {
          type: 'spring',
          visualDuration: 0.35,
          bounce: 0.15,
        });
      }

      setIsInteracting(false);
      setIsDragging(false);
      pointerDownPos.current = null;
    },
    [
      animateFillTo,
      isInteracting,
      min,
      onValueCommit,
      percentFromValue,
      positionToValue,
      range,
      rubberStretch,
      safeMax,
      safeStep,
      setValue,
      shouldReduceMotion,
    ]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const arrowStep = event.shiftKey ? safeStep * 10 : safeStep;
      let next: number | null = null;

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          next = value + arrowStep;
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          next = value - arrowStep;
          break;
        case 'Home':
          next = min;
          break;
        case 'End':
          next = safeMax;
          break;
        default:
          return;
      }

      event.preventDefault();
      setKeyboardFocusRing(true);

      const snapped = clamp(roundValue(next, safeStep), min, safeMax);
      animateFillTo(percentFromValue(snapped));
      setValue(snapped);
      onValueCommit?.(snapped);
    },
    [
      animateFillTo,
      min,
      onValueCommit,
      percentFromValue,
      safeMax,
      safeStep,
      setValue,
      value,
    ]
  );

  const handleFocus = useCallback(() => {
    if (!pendingPointerFocusRef.current) {
      setKeyboardFocusRing(true);
    }
  }, []);

  const handleBlur = useCallback(() => {
    setKeyboardFocusRing(false);
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const measure = () => {
      const trackWidth = wrapper.offsetWidth;
      if (trackWidth <= 0) return;

      const left = labelRef.current
        ? ((LABEL_OFFSET + labelRef.current.offsetWidth + HANDLE_BUFFER) /
            trackWidth) *
          100
        : 38;
      const right = valueRef.current
        ? ((trackWidth -
            VALUE_OFFSET -
            valueRef.current.offsetWidth -
            HANDLE_BUFFER) /
            trackWidth) *
          100
        : 72;

      setDodge(prev =>
        prev.left === left && prev.right === right ? prev : { left, right }
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(wrapper);

    if (labelRef.current) observer.observe(labelRef.current);
    if (valueRef.current) observer.observe(valueRef.current);

    return () => observer.disconnect();
  }, [displayValue, label]);

  const valueDodge = percentage < dodge.left || percentage > dodge.right;
  const handleOpacity = !isActive
    ? 0
    : valueDodge
      ? 0.1
      : isDragging
        ? 0.65
        : 0.42;
  const discreteSteps = range / safeStep;
  const hashMarkCount = discreteSteps <= 10 ? discreteSteps - 1 : 9;
  const hashMarkPct = (index: number) =>
    discreteSteps <= 10
      ? (((index + 1) * safeStep) / range) * 100
      : (index + 1) * 10;
  const sliderStyle: ElasticSliderStyle = {};
  const cssHeight = toCssLength(height);
  const cssRadius = toCssLength(radius);

  if (cssHeight) {
    sliderStyle['--elastic-slider-height'] = cssHeight;
  }

  if (cssRadius) {
    sliderStyle['--elastic-slider-radius'] = cssRadius;
  }

  return (
    <div
      ref={wrapperRef}
      data-slot="elastic-slider"
      className={cn(
        'relative h-[var(--elastic-slider-height)] [--elastic-slider-height:2.25rem] [--elastic-slider-radius:0.75rem]',
        className
      )}
      style={sliderStyle}
    >
      <motion.div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        data-slot="elastic-slider-track"
        data-active={isActive}
        data-focus-visible={keyboardFocusRing}
        aria-label={ariaLabel ?? label}
        aria-orientation="horizontal"
        aria-valuemin={min}
        aria-valuemax={safeMax}
        aria-valuenow={value}
        aria-valuetext={displayValue}
        className={cn(
          'group/elastic-slider absolute inset-0 cursor-pointer touch-none overflow-hidden rounded-[var(--elastic-slider-radius)] bg-neutral-100 outline-none select-none dark:bg-neutral-800/80',
          'data-[focus-visible=true]:ring-2 data-[focus-visible=true]:ring-neutral-400/40 data-[focus-visible=true]:ring-offset-1 data-[focus-visible=true]:ring-offset-white dark:data-[focus-visible=true]:ring-neutral-500/50 dark:data-[focus-visible=true]:ring-offset-neutral-900',
          trackClassName
        )}
        style={{ width: rubberWidth, x: rubberX }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          data-slot="elastic-slider-hash-marks"
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
        >
          {Array.from({ length: hashMarkCount }, (_, index) => (
            <div
              key={index}
              className={cn(
                'absolute top-1/2 h-2 w-px -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent transition-colors duration-200 group-data-[active=true]/elastic-slider:bg-neutral-400/25 dark:group-data-[active=true]/elastic-slider:bg-neutral-500/40',
                hashMarkClassName
              )}
              style={{ left: `${hashMarkPct(index)}%` }}
            />
          ))}
        </div>

        <motion.div
          data-slot="elastic-slider-fill"
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 bg-neutral-200/80 transition-colors group-data-[active=true]/elastic-slider:bg-neutral-300/60 dark:bg-neutral-700/55 dark:group-data-[active=true]/elastic-slider:bg-neutral-600/45',
            fillClassName
          )}
          style={{ width: fillWidth }}
        />

        <motion.div
          data-slot="elastic-slider-handle"
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 h-5 w-1 rounded-full bg-neutral-500 dark:bg-neutral-400',
            handleClassName
          )}
          style={{ left: handleLeft, y: '-50%' }}
          animate={{
            opacity: handleOpacity,
            scaleX: isActive ? 1 : 0.25,
            scaleY: isActive && valueDodge ? 0.75 : 1,
          }}
          transition={
            shouldReduceMotion
              ? { duration: 0 }
              : {
                  scaleX: {
                    type: 'spring',
                    visualDuration: 0.25,
                    bounce: 0.15,
                  },
                  scaleY: {
                    type: 'spring',
                    visualDuration: 0.2,
                    bounce: 0.1,
                  },
                  opacity: { duration: 0.15 },
                }
          }
        />

        <span
          ref={labelRef}
          data-slot="elastic-slider-label"
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 left-3 inline-flex max-w-[calc(100%-5rem)] -translate-y-1/2 items-center truncate text-sm leading-none font-medium text-neutral-500 transition-colors dark:text-neutral-400',
            textClassName,
            labelClassName
          )}
        >
          {label}
        </span>

        <span
          ref={valueRef}
          data-slot="elastic-slider-value"
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 font-mono text-sm leading-none font-medium text-neutral-500 tabular-nums transition-colors group-data-[active=true]/elastic-slider:text-neutral-700 dark:text-neutral-400 dark:group-data-[active=true]/elastic-slider:text-neutral-200',
            textClassName,
            valueClassName
          )}
        >
          {displayValue}
        </span>
      </motion.div>
    </div>
  );
}

export default ElasticSlider;
