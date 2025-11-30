'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalHistory } from '@/lib/hooks/useModalHistory';

interface ImageViewerProps {
  id?: string;
  isOpen: boolean;
  imageUrl: string;
  alt: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  id = 'image-viewer',
  isOpen,
  imageUrl,
  alt,
  onClose,
}) => {
  const [hasError, setHasError] = useState(false);

  // 适配历史栈
  useModalHistory({
    id,
    isOpen,
    onClose,
  });

  // 重置错误状态当弹窗打开时
  React.useEffect(() => {
    if (isOpen) {
      setHasError(false);
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-100 flex items-center justify-center bg-neutral-50/90 p-4 backdrop-blur-xs dark:bg-neutral-900/90"
          onClick={e => {
            e.stopPropagation();
            onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="relative max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative flex min-h-[280px] items-center justify-center">
              {hasError ? (
                <div className="p-4 text-center text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="mx-auto mb-2 h-12 w-12 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p>图片加载失败</p>
                </div>
              ) : (
                <Image
                  src={imageUrl}
                  alt={alt}
                  className="max-h-[80vh] w-auto"
                  width={0}
                  height={1000}
                  style={{
                    background: 'transparent',
                  }}
                  onError={() => setHasError(true)}
                  priority
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageViewer;
