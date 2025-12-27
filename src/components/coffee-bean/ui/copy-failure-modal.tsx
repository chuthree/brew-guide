'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils/classNameUtils';
import { useThemeColor } from '@/lib/hooks/useThemeColor';

interface CopyFailureModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  title?: string;
  className?: string;
}

const CopyFailureModal: React.FC<CopyFailureModalProps> = ({
  isOpen,
  onClose,
  content,
  title = '复制失败',
  className,
}) => {
  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.265 }}
          className="fixed inset-0 z-50 bg-black/50"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              ease: [0.33, 1, 0.68, 1],
              duration: 0.265,
            }}
            className={cn(
              'absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl dark:bg-neutral-900',
              className
            )}
          >
            {/* 拖动条 */}
            <div className="sticky top-0 z-10 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900">
              <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* 内容区域 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.265,
                delay: 0.05,
              }}
              className="pb-safe-bottom px-6"
            >
              <div className="flex flex-col space-y-4">
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                  {title}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  请手动复制以下内容：
                </p>
                <div className="relative">
                  <pre className="overflow-x-auto rounded-lg bg-neutral-100 p-4 text-xs text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
                    {content}
                  </pre>
                  <button
                    onClick={() => {
                      const textarea = document.createElement('textarea');
                      textarea.value = content;
                      document.body.appendChild(textarea);
                      textarea.select();
                      document.execCommand('copy');
                      document.body.removeChild(textarea);
                      onClose();
                    }}
                    className="absolute top-2 right-2 rounded-sm bg-neutral-200 px-2 py-1 text-xs text-neutral-700 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                  >
                    复制
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CopyFailureModal;
