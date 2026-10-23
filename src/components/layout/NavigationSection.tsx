'use client';

import type { CSSProperties, ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Only mobile navigation uses presence: desktop content is removed immediately.
export default function NavigationSection({
  open,
  animated,
  children,
  className,
  style,
}: {
  open: boolean;
  animated: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  if (!animated) {
    return open ? (
      <div className={className} style={style}>{children}</div>
    ) : null;
  }

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="section"
          className={className}
          style={{ ...style, overflow: 'hidden' }}
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
