'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';

interface SwipeExitHintProps {
  show: boolean;
  swipeCount: number;
}

export const SwipeExitHint = ({ show, swipeCount }: SwipeExitHintProps) => {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setVisible(true);
    } else {
      // 延迟隐藏以显示动画
      const timer = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ duration: 0.3 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-black/80 backdrop-blur-sm text-white px-4 py-3 rounded-full shadow-lg">
            <div className="flex items-center gap-2 text-sm font-medium">
              <div className="flex items-center gap-1">
                <ChevronLeft size={16} className="text-green-400" />
                <ChevronLeft size={16} className={swipeCount >= 1 ? "text-green-400" : "text-gray-400"} />
              </div>
              <span>
                {swipeCount === 0 && "再次从左侧滑动退出"}
                {swipeCount === 1 && "再次侧滑退出应用"}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};