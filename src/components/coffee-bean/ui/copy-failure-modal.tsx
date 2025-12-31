'use client';

import React, { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/classNameUtils';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { copyToClipboard } from '@/lib/utils/exportUtils';
import { showToast } from '@/components/common/feedback/LightToast';

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
  const [isCopying, setIsCopying] = useState(false);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: isOpen });

  const handleRetry = useCallback(async () => {
    setIsCopying(true);
    try {
      const result = await copyToClipboard(content);
      if (result.success) {
        showToast({
          type: 'success',
          title: '已复制到剪贴板',
          duration: 2000,
        });
        onClose();
      } else {
        showToast({
          type: 'error',
          title: '复制失败，请手动选择复制',
          duration: 2000,
        });
      }
    } finally {
      setIsCopying(false);
    }
  }, [content, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.265 }}
          className="fixed inset-0 z-50 bg-black/50"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              ease: [0.33, 1, 0.68, 1],
              duration: 0.265,
            }}
            onClick={e => e.stopPropagation()}
            className={cn(
              'absolute inset-x-0 bottom-0 max-h-[85vh] overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl dark:bg-neutral-900',
              className
            )}
          >
            {/* 拖动条 */}
            <div
              className="sticky top-0 z-10 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900"
              onClick={onClose}
            >
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
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-100">
                    {title}
                  </h3>
                  <button
                    onClick={onClose}
                    className="rounded-full p-1.5 transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  >
                    <X className="h-5 w-5 text-neutral-500" />
                  </button>
                </div>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  请手动复制以下内容：
                </p>
                <div className="relative">
                  <pre className="max-h-[50vh] overflow-auto rounded-lg bg-neutral-100 p-4 text-xs break-all whitespace-pre-wrap text-neutral-800 select-text dark:bg-neutral-800 dark:text-neutral-200">
                    {content}
                  </pre>
                  <button
                    onClick={handleRetry}
                    disabled={isCopying}
                    className="absolute top-2 right-2 rounded-md bg-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-300 disabled:opacity-50 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                  >
                    {isCopying ? '复制中...' : '重试复制'}
                  </button>
                </div>
                <div className="pb-4">
                  <button
                    onClick={onClose}
                    className="w-full rounded-xl bg-neutral-200 py-3 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-600"
                  >
                    关闭
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
