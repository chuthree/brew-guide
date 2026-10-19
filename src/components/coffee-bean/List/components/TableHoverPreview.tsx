'use client';

import React from 'react';
import {
  AnimatePresence,
  domAnimation,
  LazyMotion,
  m,
  MotionValue,
} from 'framer-motion';

interface HoverPreviewBean {
  imageSrc: string;
}

interface TableHoverPreviewProps {
  previewBean: HoverPreviewBean | null;
  x: MotionValue<number>;
  y: MotionValue<number>;
  reducedMotion?: boolean;
}

const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

const TableHoverPreview: React.FC<TableHoverPreviewProps> = ({
  previewBean,
  x,
  y,
  reducedMotion = false,
}) => (
  <LazyMotion features={domAnimation}>
    <AnimatePresence initial={false}>
      {previewBean && (
        <m.div
          key="preview"
          className="pointer-events-none fixed top-0 left-0 z-80"
          style={{ x, y }}
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
          <div className="relative overflow-hidden rounded-sm shadow-[0px_1px_2px_rgba(0,0,0,0.08),0px_4px_10px_-8px_rgba(0,0,0,0.22)] dark:shadow-[0px_1px_2px_rgba(0,0,0,0.35),0px_4px_10px_-8px_rgba(0,0,0,0.55)]">
            <img
              key={previewBean.imageSrc}
              src={previewBean.imageSrc}
              alt=""
              className="block h-auto max-h-[176px] w-auto max-w-[168px] object-contain"
            />
            <div className="pointer-events-none absolute inset-0 rounded-sm [outline:1px_solid_rgba(0,0,0,0.1)] -outline-offset-1 dark:outline-[rgba(255,255,255,0.1)]" />
          </div>
        </m.div>
      )}
    </AnimatePresence>
  </LazyMotion>
);

export type { HoverPreviewBean };
export default TableHoverPreview;
