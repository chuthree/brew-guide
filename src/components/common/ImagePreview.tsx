'use client';

import React, { useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { Trash2 } from 'lucide-react';

interface ImagePreviewProps {
  id?: string;
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
  layoutId?: string; // 用于共享布局动画
  onDelete?: () => void; // 删除图片回调
}

const ImagePreview: React.FC<ImagePreviewProps> = ({
  id = 'image-preview',
  src,
  alt,
  isOpen,
  onClose,
  layoutId = 'image-preview',
  onDelete,
}) => {
  // 适配历史栈
  useModalHistory({
    id,
    isOpen,
    onClose,
  });

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

          {/* 删除按钮 */}
          {onDelete && (
            <motion.button
              initial={{ opacity: 0, filter: 'blur(2px)', scale: 0.95 }}
              animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, filter: 'blur(2px)', scale: 0.95 }}
              transition={{ delay: 0.1 }}
              type="button"
              onClick={e => {
                e.stopPropagation();
                onDelete();
              }}
              className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-red-500/90 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-red-600"
            >
              <Trash2 className="h-4 w-4" />
              移除
            </motion.button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImagePreview;
