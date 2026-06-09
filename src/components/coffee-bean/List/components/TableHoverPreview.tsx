'use client';

import React, { useEffect, useState } from 'react';
import {
  AnimatePresence,
  motion,
  MotionValue,
  useIsPresent,
} from 'framer-motion';

interface HoverPreviewBean {
  id: string;
  imageSrc: string;
}

interface TableHoverPreviewProps {
  previewBean: HoverPreviewBean | null;
  x: MotionValue<number>;
  y: MotionValue<number>;
  reducedMotion?: boolean;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];
const PREVIEW_MAX_WIDTH = 168;
const PREVIEW_MAX_HEIGHT = 176;
const PREVIEW_FALLBACK_SIZE = { width: 168, height: 168 };
const IMAGE_SIZE_CACHE = new Map<string, { width: number; height: number }>();

const fitPreviewSize = (width: number, height: number) => {
  if (!width || !height) return PREVIEW_FALLBACK_SIZE;

  const scale = Math.min(
    PREVIEW_MAX_WIDTH / width,
    PREVIEW_MAX_HEIGHT / height,
    1
  );

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
};

const FloatingPreviewCard: React.FC<{
  previewBean: HoverPreviewBean;
  x: MotionValue<number>;
  y: MotionValue<number>;
  reducedMotion: boolean;
}> = ({ previewBean, x, y, reducedMotion }) => {
  const isPresent = useIsPresent();
  const [frozenPosition, setFrozenPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [resolvedSize, setResolvedSize] = useState<{
    width: number;
    height: number;
  } | null>(() => IMAGE_SIZE_CACHE.get(previewBean.imageSrc) ?? null);

  useEffect(() => {
    if (!isPresent && frozenPosition === null) {
      setFrozenPosition({
        x: x.get(),
        y: y.get(),
      });
    }
  }, [frozenPosition, isPresent, x, y]);

  useEffect(() => {
    const cachedSize = IMAGE_SIZE_CACHE.get(previewBean.imageSrc);
    if (cachedSize) {
      setResolvedSize(cachedSize);
      return;
    }

    let isCancelled = false;
    setResolvedSize(null);

    const image = new Image();
    image.decoding = 'async';

    image.onload = () => {
      if (isCancelled) return;
      const size = fitPreviewSize(image.naturalWidth, image.naturalHeight);
      IMAGE_SIZE_CACHE.set(previewBean.imageSrc, size);
      setResolvedSize(size);
    };

    image.onerror = () => {
      if (isCancelled) return;
      IMAGE_SIZE_CACHE.set(previewBean.imageSrc, PREVIEW_FALLBACK_SIZE);
      setResolvedSize(PREVIEW_FALLBACK_SIZE);
    };

    image.src = previewBean.imageSrc;

    return () => {
      isCancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [previewBean.imageSrc]);

  if (!resolvedSize) return null;

  const floatingStyle = frozenPosition
    ? {
        x: frozenPosition.x,
        y: frozenPosition.y,
        willChange: 'transform' as const,
      }
    : {
        x,
        y,
        willChange: 'transform' as const,
      };

  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-80"
      style={floatingStyle}
      initial={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.97, filter: 'blur(5px)' }
      }
      animate={
        reducedMotion
          ? { opacity: 1 }
          : { opacity: 1, scale: 1, filter: 'blur(0px)' }
      }
      exit={
        reducedMotion
          ? { opacity: 0 }
          : { opacity: 0, scale: 0.985, filter: 'blur(3px)' }
      }
      transition={
        reducedMotion
          ? { duration: 0.1 }
          : {
              opacity: { duration: 0.16, ease: EASE_OUT },
              scale: { duration: 0.18, ease: EASE_OUT },
              filter: { duration: 0.16, ease: EASE_OUT },
            }
      }
    >
      <div
        className="relative overflow-hidden rounded-sm shadow-[0px_1px_2px_rgba(0,0,0,0.08),0px_4px_10px_-8px_rgba(0,0,0,0.22)] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.35),0px_4px_10px_-8px_rgba(0,0,0,0.55)]"
        style={{
          width: resolvedSize.width,
          height: resolvedSize.height,
        }}
      >
        <motion.img
          src={previewBean.imageSrc}
          alt=""
          className="block h-full w-full object-contain"
          loading="lazy"
          aria-hidden="true"
          initial={
            reducedMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(4px)' }
          }
          animate={
            reducedMotion ? { opacity: 1 } : { opacity: 1, filter: 'blur(0px)' }
          }
          exit={
            reducedMotion ? { opacity: 0 } : { opacity: 0, filter: 'blur(3px)' }
          }
          transition={
            reducedMotion
              ? { duration: 0.08 }
              : {
                  opacity: { duration: 0.14, ease: EASE_OUT },
                  filter: { duration: 0.14, ease: EASE_OUT },
                }
          }
        />
        <div className="pointer-events-none absolute inset-0 rounded-sm [outline:1px_solid_rgba(0,0,0,0.1)] -outline-offset-1 dark:outline-[rgba(255,255,255,0.1)]" />
      </div>
    </motion.div>
  );
};

const TableHoverPreview: React.FC<TableHoverPreviewProps> = ({
  previewBean,
  x,
  y,
  reducedMotion = false,
}) => {
  return (
    <AnimatePresence initial={false}>
      {previewBean && (
        <FloatingPreviewCard
          key={`${previewBean.id}-${previewBean.imageSrc}`}
          previewBean={previewBean}
          x={x}
          y={y}
          reducedMotion={reducedMotion}
        />
      )}
    </AnimatePresence>
  );
};

export type { HoverPreviewBean };
export default TableHoverPreview;
