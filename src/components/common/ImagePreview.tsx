'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

interface ImagePreviewProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  layoutId?: string; // 用于共享布局动画
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  src,
  alt,
  isOpen,
  onClose,
  layoutId = 'image-preview',
}) => {
  // 监听 ESC 键关闭
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-50/90 backdrop-blur-xs dark:bg-neutral-900/90"
          onClick={onClose}
        >
          {/* 图片容器 - 使用 layoutId 实现共享动画 */}
          <motion.div
            layoutId={layoutId}
            className="relative"
            onClick={e => e.stopPropagation()}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
          >
            <Image
              src={src}
              alt={alt}
              className="h-auto max-h-[90vh] w-auto max-w-[90vw] object-contain"
              width={1200}
              height={1200}
              quality={100}
              priority
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImagePreview;
