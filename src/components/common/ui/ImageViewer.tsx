'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import gsap from 'gsap';

interface ImageViewerProps {
  id?: string;
  isOpen: boolean;
  /** 正面图片URL */
  imageUrl: string;
  /** 背面图片URL（可选） */
  backImageUrl?: string;
  alt: string;
  onClose: () => void;
}

const ImageViewer: React.FC<ImageViewerProps> = ({
  id = 'image-viewer',
  isOpen,
  imageUrl,
  backImageUrl,
  alt,
  onClose,
}) => {
  const [frontError, setFrontError] = useState(false);
  const [backError, setBackError] = useState(false);
  const [_isFlipped, setIsFlipped] = useState(false);

  // GSAP refs
  const cardRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const currentRotation = useRef(0);

  // 适配历史栈
  useModalHistory({
    id,
    isOpen,
    onClose,
  });

  // 重置状态当弹窗打开时
  useEffect(() => {
    if (isOpen) {
      setFrontError(false);
      setBackError(false);
      setIsFlipped(false);
      currentRotation.current = 0;

      // 初始化卡片位置
      if (cardRef.current) {
        gsap.set(cardRef.current, { rotateY: 0 });
      }
    }
  }, [isOpen]);

  // 初始化 GSAP 动画
  useEffect(() => {
    if (!isOpen || !cardRef.current) return;

    // 设置3D透视效果
    gsap.set(cardRef.current.parentElement, { perspective: 1000 });
    gsap.set(cardRef.current, { transformStyle: 'preserve-3d' });

    // 背面初始化为翻转状态
    if (backRef.current) {
      gsap.set(backRef.current, { rotateY: 180, backfaceVisibility: 'hidden' });
    }
    if (frontRef.current) {
      gsap.set(frontRef.current, { rotateY: 0, backfaceVisibility: 'hidden' });
    }
  }, [isOpen]);

  // 翻转动画 - 始终朝同一方向旋转
  const flip = useCallback(() => {
    if (!cardRef.current) return;

    const targetRotation = currentRotation.current + 180;

    gsap.to(cardRef.current, {
      rotateY: targetRotation,
      duration: 0.5,
      ease: 'sine.inOut',
      onComplete: () => {
        currentRotation.current = targetRotation;
        setIsFlipped(prev => !prev);
      },
    });
  }, []);

  // 处理点击翻转
  const handleFlipClick = useCallback(() => {
    if (!backImageUrl) return;
    flip();
  }, [backImageUrl, flip]);

  // 渲染错误状态
  const renderError = () => (
    <div className="flex h-full w-full items-center justify-center p-4 text-center">
      <div>
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
        <p className="text-neutral-500 dark:text-neutral-400">图片加载失败</p>
      </div>
    </div>
  );

  // 是否有背面图片
  const hasBackImage = !!backImageUrl;

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
            initial={{ scale: 0.96 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative max-h-[90vh] overflow-visible"
            onClick={e => {
              // 单图模式：点击任意位置关闭；双图模式：阻止冒泡（由图片处理翻转）
              if (!hasBackImage) {
                onClose();
              } else {
                e.stopPropagation();
              }
            }}
          >
            {hasBackImage ? (
              /* 有背面图片时：使用3D翻转效果 */
              <div style={{ perspective: 1000 }}>
                <div
                  ref={cardRef}
                  className="relative"
                  style={{ transformStyle: 'preserve-3d' }}
                >
                  {/* 正面 */}
                  <div ref={frontRef} style={{ backfaceVisibility: 'hidden' }}>
                    {frontError ? (
                      renderError()
                    ) : (
                      <Image
                        src={imageUrl}
                        alt={alt}
                        className="max-h-[80vh] w-auto cursor-pointer select-none"
                        width={0}
                        height={1000}
                        style={{ background: 'transparent' }}
                        onError={() => setFrontError(true)}
                        onClick={handleFlipClick}
                        draggable={false}
                        priority
                      />
                    )}
                  </div>

                  {/* 背面 */}
                  <div
                    ref={backRef}
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    {backError ? (
                      renderError()
                    ) : (
                      <Image
                        src={backImageUrl}
                        alt={`${alt} - 背面`}
                        className="max-h-[80vh] w-auto cursor-pointer select-none"
                        width={0}
                        height={1000}
                        style={{ background: 'transparent' }}
                        onError={() => setBackError(true)}
                        onClick={handleFlipClick}
                        draggable={false}
                        priority
                      />
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* 单图模式：直接显示，无3D效果 */
              <div className="relative flex min-h-[280px] items-center justify-center">
                {frontError ? (
                  renderError()
                ) : (
                  <Image
                    src={imageUrl}
                    alt={alt}
                    className="max-h-[80vh] w-auto"
                    width={0}
                    height={1000}
                    style={{ background: 'transparent' }}
                    onError={() => setFrontError(true)}
                    priority
                  />
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ImageViewer;
