'use client';

import React from 'react';
import {
  getFlavorPeriodSettings,
  getDefaultFlavorPeriodByRoastLevelSync,
} from '@/lib/utils/flavorPeriodUtils';
import { getBeanRoasterName } from '@/lib/utils/coffeeBeanUtils';
import type { CoffeeBean } from '@/types/app';
import { cn } from '@/lib/utils/classNameUtils';

type FlavorStatusRingProps =
  | {
      bean: CoffeeBean;
      noteRating?: undefined;
      className?: string;
      muted?: boolean;
    }
  | {
      noteRating: number;
      bean?: undefined;
      className?: string;
      muted?: undefined;
    };

const NoteRatingRing: React.FC<{ rating: number; className?: string }> = ({
  rating,
  className,
}) => {
  const totalSegments = 5;
  const safeRating = Number.isFinite(rating) ? Math.max(0, rating) : 0;
  const activeSegments = Math.max(
    0,
    Math.min(totalSegments, Math.round(safeRating))
  );

  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  const segmentSpan = circumference / totalSegments;
  const gapLength = 2.4;
  const segmentLength = Math.max(1, segmentSpan - gapLength);

  return (
    <svg
      className={cn(
        'inline-block h-[1em] w-[1em] align-text-bottom',
        className
      )}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {Array.from({ length: totalSegments }).map((_, index) => (
        <circle
          key={`note-segment-bg-${index}`}
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${segmentLength} ${circumference}`}
          strokeDashoffset={-index * segmentSpan}
          transform="rotate(-90 12 12)"
          className="text-neutral-300 dark:text-neutral-600"
        />
      ))}

      {Array.from({ length: activeSegments }).map((_, index) => (
        <circle
          key={`note-segment-active-${index}`}
          cx="12"
          cy="12"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={`${segmentLength} ${circumference}`}
          strokeDashoffset={-index * segmentSpan}
          transform="rotate(-90 12 12)"
          className="text-yellow-500 dark:text-yellow-400"
        />
      ))}
    </svg>
  );
};

const FlavorStatusRing: React.FC<FlavorStatusRingProps> = ({
  className,
  ...props
}) => {
  if (typeof props.noteRating === 'number') {
    return <NoteRatingRing rating={props.noteRating} className={className} />;
  }

  const bean = props.bean;
  const muted = props.muted === true;

  if (muted) {
    return (
      <svg
        className={cn(
          'inline-block h-[1em] w-[1em] align-text-bottom text-neutral-300 dark:text-neutral-300/60',
          className
        )}
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.3"
        />
        <line
          x1="9.5"
          y1="14.5"
          x2="14.5"
          y2="9.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.3"
        />
      </svg>
    );
  }

  if (bean.isInTransit) {
    return (
      <svg
        className={cn(
          'inline-block h-[1em] w-[1em] align-text-bottom text-neutral-400 dark:text-neutral-400/60',
          className
        )}
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      </svg>
    );
  }

  if (bean.isFrozen) {
    return (
      <svg
        className={cn(
          'inline-block h-[1em] w-[1em] align-text-bottom text-blue-400 dark:text-blue-400/80',
          className
        )}
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
      </svg>
    );
  }

  if (!bean.roastDate) {
    return (
      <svg
        className={cn(
          'inline-block h-[1em] w-[1em] align-text-bottom text-neutral-300 dark:text-neutral-300/60',
          className
        )}
        viewBox="0 0 24 24"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeOpacity="0.3"
        />
      </svg>
    );
  }

  const today = new Date();
  const roastDate = new Date(bean.roastDate);
  const todayDate = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const roastDateOnly = new Date(
    roastDate.getFullYear(),
    roastDate.getMonth(),
    roastDate.getDate()
  );
  const daysSinceRoast = Math.ceil(
    (todayDate.getTime() - roastDateOnly.getTime()) / (1000 * 60 * 60 * 24)
  );

  let startDay = bean.startDay || 0;
  let endDay = bean.endDay || 0;

  if (startDay === 0 && endDay === 0) {
    const { customFlavorPeriod } = getFlavorPeriodSettings();
    const roasterName = getBeanRoasterName(bean) || undefined;
    const defaultPeriod = getDefaultFlavorPeriodByRoastLevelSync(
      bean.roastLevel || '',
      customFlavorPeriod,
      roasterName
    );
    startDay = defaultPeriod.startDay;
    endDay = defaultPeriod.endDay;
  }

  const radius = 9;
  const circumference = 2 * Math.PI * radius;
  let progress = 0;
  let colorClass = 'text-neutral-500 dark:text-neutral-500/60';
  let isDashed = false;

  if (daysSinceRoast < startDay) {
    progress =
      startDay > 0 ? Math.max(0, Math.min(1, daysSinceRoast / startDay)) : 1;
    colorClass = 'text-amber-500 dark:text-amber-500/60';
  } else if (daysSinceRoast <= endDay) {
    const duration = endDay - startDay;
    const remaining = endDay - daysSinceRoast;
    progress =
      duration > 0 ? Math.max(0, Math.min(1, remaining / duration)) : 0;
    colorClass = 'text-green-500 dark:text-green-500/60';
  } else {
    progress = 0;
    colorClass = 'text-neutral-300 dark:text-neutral-300/60';
    isDashed = true;
  }

  const strokeDashoffset = circumference * (1 - progress);

  return (
    <svg
      className={cn(
        'inline-block h-[1em] w-[1em] align-text-bottom',
        colorClass,
        className
      )}
      viewBox="0 0 24 24"
    >
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        opacity="0.2"
      />
      <circle
        cx="12"
        cy="12"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={isDashed ? '2 2' : `${circumference} ${circumference}`}
        strokeDashoffset={isDashed ? 0 : strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 12 12)"
      />
    </svg>
  );
};

export default FlavorStatusRing;
